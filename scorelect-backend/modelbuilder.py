"""
Model Builder / Python Lab for Scorelect v2.2
=============================================
Enhanced version with:
- Training dataset vs Target dataset support
- Custom code execution
- Function discovery endpoint
- Use existing xP/xG values as features
- FIXED: Firestore queries now work without composite indexes (with fallback)
- OPTIMIZED: Reduced memory usage and faster queries
- NEW: Custom model plugin system support

Add to app.py:
    from modelbuilder import model_lab_bp, init_firebase
    init_firebase(db)
    app.register_blueprint(model_lab_bp)
"""

from flask import Blueprint, request, jsonify
import pandas as pd
import numpy as np
import traceback
import time
import logging
import sys
from io import StringIO
from datetime import datetime

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score

# Import custom models
try:
    from custom_models import (
        get_available_models, 
        get_model, 
        run_custom_model,
        AVAILABLE_MODELS
    )
    CUSTOM_MODELS_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Custom models not available: {e}")
    CUSTOM_MODELS_AVAILABLE = False
    AVAILABLE_MODELS = {}

try:
    from imblearn.over_sampling import SMOTE
    SMOTE_AVAILABLE = True
except ImportError:
    SMOTE_AVAILABLE = False

firebase_db = None


def init_firebase(db):
    """Initialize Firebase database reference."""
    global firebase_db
    firebase_db = db
    logging.info("Model Lab: Firebase initialized")


def get_db():
    """Get Firebase database reference, initializing if needed."""
    global firebase_db
    if firebase_db is None:
        from firebase_admin import firestore
        firebase_db = firestore.client()
    return firebase_db


model_lab_bp = Blueprint('model_lab', __name__, url_prefix='/api/model-lab')
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def engineer_features(df):
    """Generate engineered features from raw shot data."""
    
    def safe_get_column(df, col, default_value):
        """Safely get a column, returning a default Series if not found."""
        if col in df.columns:
            return df[col]
        return pd.Series([default_value] * len(df), index=df.index)
    
    # Basic coordinates
    df['x'] = pd.to_numeric(safe_get_column(df, 'x', 0), errors='coerce').fillna(0)
    df['y'] = pd.to_numeric(safe_get_column(df, 'y', 0), errors='coerce').fillna(0)
    
    # Distance and angle calculations
    GOAL_X, GOAL_Y = 145, 44
    df['dist'] = np.sqrt((GOAL_X - df['x'])**2 + (GOAL_Y - df['y'])**2)
    df['angle'] = np.degrees(np.arctan2(GOAL_Y - df['y'], GOAL_X - df['x']))
    df['angle_abs'] = df['angle'].abs()
    df['dist_squared'] = df['dist'] ** 2
    df['dist_log'] = np.log1p(df['dist'])
    df['dist_angle_interaction'] = df['dist'] * df['angle_abs'] / 90
    df['dist_to_sideline'] = np.minimum(df['y'], 88 - df['y'])
    
    # Pressure encoding
    pressure_map = {'none': 0, 'low': 0.33, 'medium': 0.67, 'high': 1.0, 'n': 0, 'y': 1, '': 0}
    df['pressure_value'] = safe_get_column(df, 'pressure', '').astype(str).str.lower().map(pressure_map).fillna(0)
    
    # Position encoding
    position_map = {'goalkeeper': 0, 'back': 1, 'defender': 1, 'midfielder': 2, 'forward': 3, 'attacker': 3}
    df['position_value'] = safe_get_column(df, 'position', '').astype(str).str.lower().map(lambda p: position_map.get(p.strip(), 2))
    
    # Foot encoding
    df['is_right_foot'] = safe_get_column(df, 'foot', '').astype(str).str.lower().str.contains('right', na=False).astype(int)
    df['is_left_foot'] = safe_get_column(df, 'foot', '').astype(str).str.lower().str.contains('left', na=False).astype(int)
    
    # Action type encoding
    action_col = safe_get_column(df, 'action', '').astype(str).str.lower()
    df['is_setplay'] = action_col.str.contains(r'free|penalty|45|sideline|mark', case=False, regex=True, na=False).astype(int)
    df['is_penalty'] = action_col.str.contains(r'penalty', case=False, regex=True, na=False).astype(int)
    df['is_free'] = action_col.str.contains(r'free', case=False, regex=True, na=False).astype(int)
    df['is_45'] = action_col.str.contains(r'45', case=False, regex=True, na=False).astype(int)
    
    # Position-based features
    df['is_central'] = ((df['angle_abs'] < 30) & (df['dist'] < 35)).astype(int)
    df['is_long_shot'] = (df['dist'] > 40).astype(int)
    df['is_very_close'] = (df['dist'] < 15).astype(int)
    df['is_extreme_angle'] = (df['angle_abs'] > 50).astype(int)
    
    # Outcome encoding
    goal_outcomes = {'goal', 'scores goal', 'made goal'}
    point_outcomes = {'point', 'over', 'scores point', 'made point', 'free', 'fortyfive'}
    df['is_goal'] = action_col.apply(lambda x: any(g in x for g in goal_outcomes)).astype(int)
    df['is_point'] = action_col.apply(lambda x: any(p in x for p in point_outcomes)).astype(int)
    df['scored'] = ((df['is_goal'] == 1) | (df['is_point'] == 1)).astype(int)
    
    # Preserve existing model values
    df['existing_xP'] = pd.to_numeric(safe_get_column(df, 'xP', 0), errors='coerce').fillna(0)
    df['existing_xG'] = pd.to_numeric(safe_get_column(df, 'xG', 0), errors='coerce').fillna(0)
    
    return df


def load_dataset(uid, dataset_name):
    """Load dataset from Firestore and return engineered DataFrame."""
    db = get_db()
    games_ref = db.collection("savedGames").document(uid).collection("games")\
        .where("datasetName", "==", dataset_name)
    
    all_shots = []
    game_docs = []
    
    for game_doc in games_ref.stream():
        game_data = game_doc.to_dict()
        game_shots = game_data.get('gameData', [])
        game_docs.append({
            'id': game_doc.id,
            'data': game_data,
            'shot_indices': list(range(len(all_shots), len(all_shots) + len(game_shots)))
        })
        for idx, shot in enumerate(game_shots):
            shot['_game_id'] = game_doc.id
            shot['_shot_idx'] = idx
            all_shots.append(shot)
    
    if not all_shots:
        raise ValueError(f"No shots found in dataset '{dataset_name}'")
    
    df = pd.DataFrame(all_shots)
    df = engineer_features(df)
    return df, game_docs


def load_dataset_raw(uid, dataset_name):
    """Load dataset from Firestore WITHOUT engineering features (for custom models)."""
    db = get_db()
    games_ref = db.collection("savedGames").document(uid).collection("games")\
        .where("datasetName", "==", dataset_name)
    
    all_shots = []
    game_docs = []
    
    for game_doc in games_ref.stream():
        game_data = game_doc.to_dict()
        game_shots = game_data.get('gameData', [])
        game_docs.append({
            'id': game_doc.id,
            'data': game_data,
            'shot_indices': list(range(len(all_shots), len(all_shots) + len(game_shots)))
        })
        for idx, shot in enumerate(game_shots):
            shot['_game_id'] = game_doc.id
            shot['_shot_idx'] = idx
            all_shots.append(shot)
    
    if not all_shots:
        raise ValueError(f"No shots found in dataset '{dataset_name}'")
    
    df = pd.DataFrame(all_shots)
    return df, game_docs


def create_model(algorithm, params=None):
    """Create a model instance based on algorithm name."""
    params = params or {}
    
    if algorithm == 'random_forest':
        return RandomForestClassifier(
            n_estimators=params.get('n_estimators', 100),
            max_depth=params.get('max_depth', 10),
            random_state=42,
            n_jobs=-1
        )
    elif algorithm == 'gradient_boosting':
        return GradientBoostingClassifier(
            n_estimators=params.get('n_estimators', 100),
            learning_rate=params.get('learning_rate', 0.1),
            max_depth=params.get('max_depth', 3),
            random_state=42
        )
    elif algorithm == 'logistic_regression':
        return LogisticRegression(
            C=params.get('C', 1.0),
            random_state=42,
            max_iter=1000
        )
    elif algorithm == 'mlp':
        return MLPClassifier(
            hidden_layer_sizes=(100, 50),
            learning_rate_init=params.get('learning_rate_init', 0.001),
            random_state=42,
            max_iter=500
        )
    elif algorithm == 'knn':
        return KNeighborsClassifier(n_neighbors=params.get('n_neighbors', 5))
    else:
        return RandomForestClassifier(n_estimators=100, random_state=42)


def calculate_metrics(y_true, y_pred, y_proba):
    """
    Calculate model evaluation metrics.
    
    PRIMARY METRIC: Brier Score (lower is better)
    For probability models like xP/xG, Brier Score is more appropriate than
    accuracy because it measures how close predicted probabilities are to
    actual outcomes, rather than treating 0.51 and 0.49 as completely different.
    """
    from sklearn.metrics import brier_score_loss, log_loss
    
    # Primary metrics for probability models
    brier = float(brier_score_loss(y_true, y_proba))
    avg_predicted = float(np.mean(y_proba))
    avg_actual = float(np.mean(y_true))
    calibration_error = abs(avg_predicted - avg_actual)
    
    # Expected vs Actual
    expected_total = float(np.sum(y_proba))
    actual_total = float(np.sum(y_true))
    expected_vs_actual_ratio = expected_total / actual_total if actual_total > 0 else 1.0
    
    # Log loss (penalises confident wrong predictions)
    try:
        logloss = float(log_loss(y_true, y_proba))
    except:
        logloss = None
    
    return {
        # PRIMARY METRICS (for ranking)
        'brier_score': brier,
        'calibration_error': calibration_error,
        'log_loss': logloss,
        
        # Calibration details
        'avg_predicted_prob': avg_predicted,
        'avg_actual_outcome': avg_actual,
        'expected_total': expected_total,
        'actual_total': actual_total,
        'expected_vs_actual_ratio': expected_vs_actual_ratio,
        
        # Secondary metrics
        'auc_roc': float(roc_auc_score(y_true, y_proba)) if len(set(y_true)) > 1 else 0.5,
        'f1_score': float(f1_score(y_true, y_pred, zero_division=0)),
        'precision': float(precision_score(y_true, y_pred, zero_division=0)),
        'recall': float(recall_score(y_true, y_pred, zero_division=0)),
        
        # Legacy accuracy (kept for reference, not for ranking)
        'accuracy': float(accuracy_score(y_true, y_pred)),
    }


# =============================================================================
# CUSTOM MODEL ENDPOINTS
# =============================================================================

@model_lab_bp.route('/custom-models', methods=['GET'])
def api_get_custom_models():
    """Get list of available custom models."""
    try:
        if not CUSTOM_MODELS_AVAILABLE:
            return jsonify({
                'success': False, 
                'error': 'Custom models module not available',
                'models': []
            }), 200
        
        models = get_available_models()
        return jsonify({
            'success': True,
            'models': models,
            'count': len(models)
        })
    except Exception as e:
        logging.error(f"Error getting custom models: {e}")
        return jsonify({'error': str(e)}), 500


@model_lab_bp.route('/run-custom-model', methods=['POST'])
def api_run_custom_model():
    """
    Run a custom model from the registry.
    
    Request body:
    {
        "uid": "user_id",
        "model_key": "cmc_v3",
        "training_dataset": "dataset_name",
        "target_dataset": "dataset_name" (optional, defaults to training_dataset),
        "apply_to_target": true/false,
        "target_field": "xP" or "xG",
        "run_name": "optional name for this run"
    }
    """
    try:
        if not CUSTOM_MODELS_AVAILABLE:
            return jsonify({'error': 'Custom models module not available'}), 400
        
        data = request.json
        uid = data.get('uid')
        model_key = data.get('model_key')
        training_dataset = data.get('training_dataset')
        target_dataset = data.get('target_dataset', training_dataset)
        apply_to_target = data.get('apply_to_target', False)
        target_field = data.get('target_field', 'xP')
        run_name = data.get('run_name', '').strip()
        
        if not all([uid, model_key, training_dataset]):
            return jsonify({'error': 'uid, model_key, and training_dataset required'}), 400
        
        if model_key not in AVAILABLE_MODELS:
            return jsonify({
                'error': f'Unknown model: {model_key}',
                'available': list(AVAILABLE_MODELS.keys())
            }), 400
        
        start_time = time.time()
        db = get_db()
        
        # Load training data (raw - the custom model will engineer its own features)
        logging.info(f"Loading training dataset: {training_dataset}")
        train_df, train_game_docs = load_dataset_raw(uid, training_dataset)
        logging.info(f"Loaded {len(train_df)} shots for training")
        
        # Load target data if different
        if target_dataset != training_dataset:
            logging.info(f"Loading target dataset: {target_dataset}")
            target_df, target_game_docs = load_dataset_raw(uid, target_dataset)
            logging.info(f"Loaded {len(target_df)} shots for prediction")
        else:
            target_df, target_game_docs = train_df, train_game_docs
        
        # Run the custom model
        logging.info(f"Running custom model: {model_key}")
        result = run_custom_model(
            model_key=model_key,
            train_df=train_df,
            target_df=target_df if apply_to_target else None,
            apply_to_target=apply_to_target,
            target_field=target_field
        )
        
        metrics = result['metrics']
        predictions = result.get('predictions', [])
        
        # Update target dataset if predictions were generated
        shots_updated, games_updated = 0, 0
        
        if apply_to_target and predictions:
            logging.info(f"Applying {len(predictions)} predictions to target dataset")
            
            for game_info in target_game_docs:
                game_data = game_info['data']
                game_shots = game_data.get('gameData', [])
                updated = False
                
                for local_idx, global_idx in enumerate(game_info['shot_indices']):
                    if local_idx < len(game_shots) and global_idx < len(predictions):
                        game_shots[local_idx][target_field] = round(float(predictions[global_idx]), 4)
                        shots_updated += 1
                        updated = True
                
                if updated:
                    db.collection("savedGames").document(uid).collection("games").document(game_info['id']).update({
                        'gameData': game_shots,
                        'lastModelUpdate': datetime.utcnow().isoformat(),
                        'modelConfig': {
                            'model_key': model_key,
                            'model_name': result['model_name'],
                            'target': target_field,
                            'metrics': metrics
                        }
                    })
                    games_updated += 1
        
        execution_time = round(time.time() - start_time, 2)
        
        # Save to history
        try:
            from firebase_admin import firestore as fs
            
            if not run_name:
                run_name = f"{result['model_name']} - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
            
            db.collection('modelLabRuns').add({
                'uid': uid,
                'type': 'custom_model',
                'source': 'custom_model_registry',
                'model_key': model_key,
                'model_type': model_key,
                'algorithm': model_key,
                'model_name': result['model_name'],
                'run_name': run_name,
                'training_dataset': training_dataset,
                'target_dataset': target_dataset,
                'target_field': target_field,
                'metrics': metrics,
                'features_used': metrics.get('features_used', []),
                'train_samples': metrics.get('train_samples', 0),
                'test_samples': metrics.get('test_samples', 0),
                'shots_updated': shots_updated,
                'games_updated': games_updated,
                'execution_time': execution_time,
                'timestamp': fs.SERVER_TIMESTAMP
            })
            logging.info(f"Saved custom model run to history")
        except Exception as save_err:
            logging.warning(f"Could not save to history: {save_err}")
        
        return jsonify({
            'success': True,
            'model_key': model_key,
            'model_name': result['model_name'],
            'metrics': metrics,
            'shots_updated': shots_updated,
            'games_updated': games_updated,
            'execution_time': execution_time,
            'dataset_info': {
                'training_dataset': training_dataset,
                'target_dataset': target_dataset,
                'training_shots': len(train_df),
                'target_shots': len(target_df) if apply_to_target else 0
            }
        })
        
    except Exception as e:
        logging.error(f"Error running custom model: {e}")
        return jsonify({
            'success': False, 
            'error': str(e), 
            'traceback': traceback.format_exc()
        }), 500


@model_lab_bp.route('/custom-model-info/<model_key>', methods=['GET'])
def api_get_custom_model_info(model_key):
    """Get detailed info about a specific custom model."""
    try:
        if not CUSTOM_MODELS_AVAILABLE:
            return jsonify({'error': 'Custom models module not available'}), 400
        
        if model_key not in AVAILABLE_MODELS:
            return jsonify({
                'error': f'Unknown model: {model_key}',
                'available': list(AVAILABLE_MODELS.keys())
            }), 404
        
        model = get_model(model_key)
        return jsonify({
            'success': True,
            'model': model.get_info()
        })
    except Exception as e:
        logging.error(f"Error getting model info: {e}")
        return jsonify({'error': str(e)}), 500


# =============================================================================
# ORIGINAL API ENDPOINTS (unchanged)
# =============================================================================

@model_lab_bp.route('/datasets', methods=['GET'])
def api_get_datasets():
    """Get list of datasets with game counts for a user - MEMORY OPTIMIZED."""
    try:
        uid = request.args.get('uid')
        if not uid:
            return jsonify({'error': 'uid required'}), 400
        
        db = get_db()
        datasets = {}
        
        docs = db.collection('savedGames').document(uid).collection('games')\
            .select(['datasetName']).stream()
        
        for doc in docs:
            game_data = doc.to_dict()
            ds_name = game_data.get('datasetName', 'Uncategorized') if game_data else 'Uncategorized'
            
            if ds_name not in datasets:
                datasets[ds_name] = {'name': ds_name, 'games': 0}
            datasets[ds_name]['games'] += 1
        
        return jsonify({'datasets': sorted(datasets.values(), key=lambda x: x['games'], reverse=True)})
    except Exception as e:
        logging.error(f"Error in api_get_datasets: {e}")
        return jsonify({'error': str(e)}), 500


@model_lab_bp.route('/dataset-stats', methods=['GET'])
def api_get_dataset_stats():
    """Get detailed stats for a SINGLE dataset."""
    try:
        uid = request.args.get('uid')
        dataset_name = request.args.get('dataset_name')
        
        if not uid or not dataset_name:
            return jsonify({'error': 'uid and dataset_name required'}), 400
        
        db = get_db()
        
        docs = db.collection('savedGames').document(uid).collection('games')\
            .where('datasetName', '==', dataset_name)\
            .select(['gameData']).stream()
        
        total_shots = 0
        total_games = 0
        
        for doc in docs:
            game_data = doc.to_dict()
            game_data_field = game_data.get('gameData', []) if game_data else []
            total_shots += len(game_data_field) if isinstance(game_data_field, list) else 0
            total_games += 1
        
        return jsonify({
            'success': True,
            'dataset_name': dataset_name,
            'games': total_games,
            'shots': total_shots
        })
    except Exception as e:
        logging.error(f"Error in api_get_dataset_stats: {e}")
        return jsonify({'error': str(e)}), 500


@model_lab_bp.route('/datasets-quick', methods=['GET'])
def api_get_datasets_quick():
    """Get just dataset names quickly - OPTIMIZED for speed."""
    try:
        uid = request.args.get('uid')
        if not uid:
            return jsonify({'error': 'uid required'}), 400
        
        db = get_db()
        
        docs = db.collection('savedGames').document(uid).collection('games')\
            .select(['datasetName']).stream()
        
        datasets = set()
        for doc in docs:
            game_data = doc.to_dict()
            ds_name = game_data.get('datasetName', 'Uncategorized') if game_data else 'Uncategorized'
            datasets.add(ds_name)
        
        return jsonify({'datasets': sorted(list(datasets))})
    except Exception as e:
        logging.error(f"Error in api_get_datasets_quick: {e}")
        return jsonify({'error': str(e)}), 500


@model_lab_bp.route('/run-visual', methods=['POST'])
def api_run_visual_model():
    """Train and evaluate a model (without applying to data)."""
    try:
        data = request.json
        uid = data.get('uid')
        config = data.get('config')
        dataset_name = data.get('dataset_name')
        run_name = data.get('run_name', '').strip()
        
        if not all([uid, config, dataset_name]):
            return jsonify({'error': 'uid, config, and dataset_name required'}), 400
        
        start_time = time.time()
        df, _ = load_dataset(uid, dataset_name)
        
        algorithm = config.get('algorithm', 'random_forest')
        features = config.get('features', ['dist', 'angle_abs', 'pressure_value', 'is_setplay'])
        train_size = config.get('train_size', 0.8)
        balance_classes = config.get('balance_classes', False)
        params = config.get('algorithm_params', {})
        
        y = df['scored']
        available_features = [f for f in features if f in df.columns]
        X = df[available_features].fillna(0)
        
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=(1 - train_size), random_state=42, stratify=y
        )
        
        if balance_classes and SMOTE_AVAILABLE and y_train.sum() > 5:
            try:
                smote = SMOTE(random_state=42)
                X_train, y_train = smote.fit_resample(X_train, y_train)
            except Exception:
                pass
        
        model = create_model(algorithm, params)
        model.fit(X_train, y_train)
        
        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)[:, 1]
        
        metrics = calculate_metrics(y_test, y_pred, y_proba)
        execution_time = round(time.time() - start_time, 2)
        
        # Save to history
        try:
            from firebase_admin import firestore as fs
            if not run_name:
                algo_display = algorithm.replace('_', ' ').title()
                run_name = f"{algo_display} - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
            
            db = get_db()
            db.collection('modelLabRuns').add({
                'uid': uid,
                'type': 'visual_training',
                'source': 'visual_builder',
                'algorithm': algorithm,
                'model_type': algorithm,
                'run_name': run_name,
                'config': config,
                'dataset_name': dataset_name,
                'metrics': metrics,
                'features_used': available_features,
                'train_samples': int(len(X_train)),
                'test_samples': int(len(X_test)),
                'total_shots': int(len(df)),
                'execution_time': execution_time,
                'timestamp': fs.SERVER_TIMESTAMP
            })
            logging.info(f"Saved visual run to modelLabRuns for user {uid}")
        except Exception as save_err:
            logging.warning(f"Could not save visual run to history: {save_err}")
        
        return jsonify({
            'success': True,
            'metrics': metrics,
            'execution_time': execution_time,
            'dataset_info': {
                'name': dataset_name,
                'total_shots': len(df),
                'train_samples': len(X_train),
                'test_samples': len(X_test)
            }
        })
    except Exception as e:
        logging.error(f"Error in api_run_visual_model: {e}")
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()}), 500


@model_lab_bp.route('/apply-model', methods=['POST'])
def api_apply_model():
    """Train a model on source dataset and apply predictions to target dataset."""
    try:
        data = request.json
        uid = data.get('uid')
        config = data.get('config')
        dataset_name = data.get('dataset_name')
        target_dataset = data.get('target_dataset', dataset_name)
        target_field = data.get('target_field', 'xP')
        run_name = data.get('run_name', '').strip()
        
        if not all([uid, config, dataset_name]):
            return jsonify({'error': 'uid, config, and dataset_name required'}), 400
        if target_field not in ['xP', 'xG']:
            return jsonify({'error': 'target_field must be "xP" or "xG"'}), 400
        
        start_time = time.time()
        db = get_db()
        
        # Load training data
        df_train, train_game_docs = load_dataset(uid, dataset_name)
        
        # Load target data (may be same or different)
        if target_dataset == dataset_name:
            df_target, target_game_docs = df_train, train_game_docs
        else:
            df_target, target_game_docs = load_dataset(uid, target_dataset)
        
        algorithm = config.get('algorithm', 'random_forest')
        features = config.get('features', ['dist', 'angle_abs', 'pressure_value', 'is_setplay'])
        train_size = config.get('train_size', 0.8)
        balance_classes = config.get('balance_classes', False)
        params = config.get('algorithm_params', {})
        
        y_full = df_train['is_goal'] if target_field == 'xG' else df_train['scored']
        available_features = [f for f in features if f in df_train.columns]
        X_full = df_train[available_features].fillna(0)
        
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X_full)
        
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y_full, test_size=(1 - train_size), random_state=42, stratify=y_full
        )
        
        if balance_classes and SMOTE_AVAILABLE and y_train.sum() > 5:
            try:
                smote = SMOTE(random_state=42)
                X_train, y_train = smote.fit_resample(X_train, y_train)
            except Exception:
                pass
        
        model = create_model(algorithm, params)
        model.fit(X_train, y_train)
        
        y_pred = model.predict(X_test)
        y_proba_test = model.predict_proba(X_test)[:, 1]
        metrics = calculate_metrics(y_test, y_pred, y_proba_test)
        
        # Get predictions for target data
        X_target = df_target[available_features].fillna(0)
        X_target_scaled = scaler.transform(X_target)
        all_predictions = model.predict_proba(X_target_scaled)[:, 1]
        
        # Update target dataset
        shots_updated, games_updated = 0, 0
        
        for game_info in target_game_docs:
            game_data = game_info['data']
            game_shots = game_data.get('gameData', [])
            updated = False
            
            for local_idx, global_idx in enumerate(game_info['shot_indices']):
                if local_idx < len(game_shots) and global_idx < len(all_predictions):
                    game_shots[local_idx][target_field] = round(float(all_predictions[global_idx]), 4)
                    shots_updated += 1
                    updated = True
            
            if updated:
                db.collection("savedGames").document(uid).collection("games").document(game_info['id']).update({
                    'gameData': game_shots,
                    'lastModelUpdate': datetime.utcnow().isoformat(),
                    'modelConfig': {
                        'algorithm': algorithm,
                        'features': available_features,
                        'target': target_field,
                        'metrics': metrics
                    }
                })
                games_updated += 1
        
        execution_time = round(time.time() - start_time, 2)
        
        # Save to history
        try:
            from firebase_admin import firestore as fs
            if not run_name:
                algo_display = algorithm.replace('_', ' ').title()
                run_name = f"{algo_display} Applied - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
            
            db.collection('modelLabRuns').add({
                'uid': uid,
                'type': 'applied_to_data',
                'source': 'visual_builder',
                'algorithm': algorithm,
                'model_type': algorithm,
                'run_name': run_name,
                'config': config,
                'source_dataset': dataset_name,
                'target_dataset': target_dataset,
                'target_field': target_field,
                'metrics': metrics,
                'features_used': available_features,
                'shots_updated': shots_updated,
                'games_updated': games_updated,
                'execution_time': execution_time,
                'timestamp': fs.SERVER_TIMESTAMP
            })
            logging.info(f"Saved applied model run to modelLabRuns for user {uid}")
        except Exception as save_err:
            logging.warning(f"Could not save applied model run to history: {save_err}")
        
        return jsonify({
            'success': True,
            'metrics': metrics,
            'shots_updated': shots_updated,
            'games_updated': games_updated,
            'execution_time': execution_time
        })
    except Exception as e:
        logging.error(f"Error in api_apply_model: {e}")
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()}), 500


@model_lab_bp.route('/history', methods=['GET'])
def api_get_history():
    """Get model run history for leaderboard - with fallback for missing index."""
    try:
        uid = request.args.get('uid')
        if not uid:
            return jsonify({'error': 'uid required'}), 400
        
        db = get_db()
        runs = []
        
        try:
            from firebase_admin import firestore as fs
            lab_runs = db.collection('modelLabRuns')\
                .where('uid', '==', uid)\
                .order_by('timestamp', direction=fs.Query.DESCENDING)\
                .limit(50).stream()
            
            for doc in lab_runs:
                run_data = doc.to_dict()
                run_data['id'] = doc.id
                if 'algorithm' in run_data and 'model_type' not in run_data:
                    run_data['model_type'] = run_data['algorithm']
                if run_data.get('timestamp'):
                    run_data['timestamp'] = run_data['timestamp'].isoformat() if hasattr(run_data['timestamp'], 'isoformat') else str(run_data['timestamp'])
                runs.append(run_data)
                
        except Exception as e:
            logging.warning(f"Indexed query failed, using fallback: {e}")
            try:
                lab_runs_fallback = db.collection('modelLabRuns')\
                    .where('uid', '==', uid)\
                    .limit(100).stream()
                
                for doc in lab_runs_fallback:
                    run_data = doc.to_dict()
                    run_data['id'] = doc.id
                    if 'algorithm' in run_data and 'model_type' not in run_data:
                        run_data['model_type'] = run_data['algorithm']
                    if run_data.get('timestamp'):
                        run_data['timestamp'] = run_data['timestamp'].isoformat() if hasattr(run_data['timestamp'], 'isoformat') else str(run_data['timestamp'])
                    runs.append(run_data)
                
                runs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
                runs = runs[:50]
                
            except Exception as fallback_err:
                logging.error(f"Fallback query also failed: {fallback_err}")
        
        return jsonify({'success': True, 'history': runs})
    except Exception as e:
        logging.error(f"Error in api_get_history: {e}")
        return jsonify({'error': str(e)}), 500


@model_lab_bp.route('/reset-values', methods=['POST'])
def api_reset_values():
    """Reset all xP or xG values to 0 for a specific dataset."""
    try:
        data = request.json
        uid = data.get('uid')
        dataset_name = data.get('dataset_name')
        target_field = data.get('target_field', 'xP')
        
        if not all([uid, dataset_name]):
            return jsonify({'error': 'uid and dataset_name required'}), 400
        if target_field not in ['xP', 'xG']:
            return jsonify({'error': 'target_field must be "xP" or "xG"'}), 400
        
        db = get_db()
        games_ref = db.collection("savedGames").document(uid).collection("games")\
            .where("datasetName", "==", dataset_name)
        
        shots_reset, games_updated = 0, 0
        
        for game_doc in games_ref.stream():
            game_data = game_doc.to_dict()
            game_shots = game_data.get('gameData', [])
            for shot in game_shots:
                shot[target_field] = 0
                shots_reset += 1
            db.collection("savedGames").document(uid).collection("games").document(game_doc.id).update({
                'gameData': game_shots
            })
            games_updated += 1
        
        return jsonify({
            'success': True,
            'shots_reset': shots_reset,
            'games_updated': games_updated,
            'target_field': target_field
        })
    except Exception as e:
        logging.error(f"Error in api_reset_values: {e}")
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@model_lab_bp.route('/functions', methods=['GET'])
def api_get_functions():
    """Return available functions for the code editor."""
    functions = [
        {'name': 'engineer_features', 'description': 'Generate engineered features from raw shot data', 'params': ['df']},
        {'name': 'load_dataset', 'description': 'Load dataset from Firestore by name', 'params': ['uid', 'dataset_name']},
        {'name': 'create_model', 'description': 'Create a scikit-learn model instance', 'params': ['algorithm', 'params']},
        {'name': 'calculate_metrics', 'description': 'Calculate accuracy, F1, precision, recall, AUC-ROC', 'params': ['y_true', 'y_pred', 'y_proba']},
        {'name': 'StandardScaler', 'description': 'Scale features to zero mean and unit variance', 'params': []},
        {'name': 'train_test_split', 'description': 'Split data into training and test sets', 'params': ['X', 'y', 'test_size', 'random_state']},
        {'name': 'RandomForestClassifier', 'description': 'Random forest ensemble classifier', 'params': ['n_estimators', 'max_depth']},
        {'name': 'GradientBoostingClassifier', 'description': 'Gradient boosting classifier', 'params': ['n_estimators', 'learning_rate']},
        {'name': 'LogisticRegression', 'description': 'Logistic regression classifier', 'params': ['C', 'max_iter']},
        {'name': 'MLPClassifier', 'description': 'Multi-layer perceptron neural network', 'params': ['hidden_layer_sizes', 'learning_rate_init']},
    ]
    
    # Add custom models info
    if CUSTOM_MODELS_AVAILABLE:
        functions.append({
            'name': 'Custom Models',
            'description': f'Available custom models: {", ".join(AVAILABLE_MODELS.keys())}',
            'params': ['model_key']
        })
    
    return jsonify({
        'success': True, 
        'functions': functions, 
        'smote_available': SMOTE_AVAILABLE,
        'custom_models_available': CUSTOM_MODELS_AVAILABLE
    })


@model_lab_bp.route('/run-custom-code', methods=['POST'])
def api_run_custom_code():
    """Execute custom Python code with access to the dataset."""
    try:
        data = request.json
        uid = data.get('uid')
        code = data.get('code', '')
        dataset_name = data.get('dataset_name')
        target_field = data.get('target_field', 'xP')
        apply_results = data.get('apply_results', False)
        run_name = data.get('run_name', '').strip()
        
        if not all([uid, code, dataset_name]):
            return jsonify({'error': 'uid, code, and dataset_name required'}), 400
        
        start_time = time.time()
        df, game_docs = load_dataset(uid, dataset_name)
        
        # Restricted execution environment - all imports pre-loaded
        exec_globals = {
            '__builtins__': {
                'print': print, 'len': len, 'range': range, 'list': list, 'dict': dict,
                'str': str, 'int': int, 'float': float, 'bool': bool, 'tuple': tuple,
                'set': set, 'sum': sum, 'min': min, 'max': max, 'abs': abs, 'round': round,
                'sorted': sorted, 'enumerate': enumerate, 'zip': zip, 'any': any, 'all': all,
                'isinstance': isinstance, 'hasattr': hasattr, 'getattr': getattr, 'setattr': setattr
            },
            'pd': pd,
            'np': np,
            'df': df.copy(),
            'StandardScaler': StandardScaler,
            'train_test_split': train_test_split,
            'cross_val_score': cross_val_score,
            'RandomForestClassifier': RandomForestClassifier,
            'GradientBoostingClassifier': GradientBoostingClassifier,
            'LogisticRegression': LogisticRegression,
            'MLPClassifier': MLPClassifier,
            'KNeighborsClassifier': KNeighborsClassifier,
            'accuracy_score': accuracy_score,
            'f1_score': f1_score,
            'roc_auc_score': roc_auc_score,
            'precision_score': precision_score,
            'recall_score': recall_score,
            'engineer_features': engineer_features,
            'create_model': create_model,
            'calculate_metrics': calculate_metrics,
        }
        
        if SMOTE_AVAILABLE:
            exec_globals['SMOTE'] = SMOTE
        
        exec_locals = {}
        old_stdout = sys.stdout
        sys.stdout = StringIO()
        
        try:
            exec(code, exec_globals, exec_locals)
            output = sys.stdout.getvalue()
        finally:
            sys.stdout = old_stdout
        
        result = exec_locals.get('result', {})
        predictions = result.get('predictions', [])
        metrics = result.get('metrics', {})
        
        shots_updated, games_updated = 0, 0
        
        if apply_results and len(predictions) == len(df):
            db = get_db()
            for game_info in game_docs:
                game_shots = game_info['data'].get('gameData', [])
                updated = False
                for local_idx, global_idx in enumerate(game_info['shot_indices']):
                    if local_idx < len(game_shots) and global_idx < len(predictions):
                        game_shots[local_idx][target_field] = round(float(predictions[global_idx]), 4)
                        shots_updated += 1
                        updated = True
                if updated:
                    db.collection("savedGames").document(uid).collection("games").document(game_info['id']).update({
                        'gameData': game_shots,
                        'lastModelUpdate': datetime.utcnow().isoformat()
                    })
                    games_updated += 1
        
        execution_time = round(time.time() - start_time, 2)
        
        # Save code run to history
        if metrics:
            try:
                from firebase_admin import firestore as fs
                db = get_db()
                
                if not run_name:
                    run_name = f"Code Run {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
                
                db.collection('modelLabRuns').add({
                    'uid': uid,
                    'type': 'custom_code',
                    'source': 'code_editor',
                    'algorithm': 'custom_code',
                    'model_type': 'custom_code',
                    'run_name': run_name,
                    'code': code[:5000],
                    'dataset_name': dataset_name,
                    'target_field': target_field,
                    'metrics': metrics,
                    'shots_updated': shots_updated,
                    'games_updated': games_updated,
                    'execution_time': execution_time,
                    'timestamp': fs.SERVER_TIMESTAMP
                })
                logging.info(f"Saved code run to modelLabRuns for user {uid}")
            except Exception as save_err:
                logging.warning(f"Could not save code run to history: {save_err}")
        
        return jsonify({
            'success': True,
            'output': output,
            'metrics': metrics,
            'predictions_count': len(predictions),
            'shots_updated': shots_updated,
            'games_updated': games_updated,
            'execution_time': execution_time
        })
    except SyntaxError as e:
        return jsonify({'success': False, 'error': f'Syntax Error: {str(e)}', 'line': e.lineno}), 400
    except Exception as e:
        logging.error(f"Error in api_run_custom_code: {e}")
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()}), 500


@model_lab_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'module': 'model_lab',
        'smote_available': SMOTE_AVAILABLE,
        'custom_models_available': CUSTOM_MODELS_AVAILABLE,
        'available_custom_models': list(AVAILABLE_MODELS.keys()) if CUSTOM_MODELS_AVAILABLE else [],
        'version': '2.2.0'
    })


@model_lab_bp.route('/presets', methods=['GET'])
def api_get_presets():
    """Get saved model presets for a user."""
    try:
        uid = request.args.get('uid')
        if not uid:
            return jsonify({'error': 'uid required'}), 400
        
        db = get_db()
        presets_ref = db.collection('modelLabPresets').where('uid', '==', uid).stream()
        
        presets = []
        for doc in presets_ref:
            preset = doc.to_dict()
            preset['id'] = doc.id
            presets.append(preset)
        
        return jsonify({'success': True, 'presets': presets})
    except Exception as e:
        logging.error(f"Error in api_get_presets: {e}")
        return jsonify({'error': str(e)}), 500


@model_lab_bp.route('/presets', methods=['POST'])
def api_save_preset():
    """Save a model preset."""
    try:
        data = request.json
        uid = data.get('uid')
        name = data.get('name')
        config = data.get('config')
        preset_type = data.get('type', 'visual')
        code = data.get('code', '')
        
        if not all([uid, name, config]):
            return jsonify({'error': 'uid, name, and config required'}), 400
        
        db = get_db()
        
        existing = db.collection('modelLabPresets')\
            .where('uid', '==', uid)\
            .where('name', '==', name)\
            .limit(1).stream()
        
        preset_data = {
            'uid': uid,
            'name': name,
            'config': config,
            'type': preset_type,
            'code': code[:10000] if code else '',
            'updated_at': datetime.utcnow().isoformat()
        }
        
        existing_doc = None
        for doc in existing:
            existing_doc = doc
            break
        
        if existing_doc:
            db.collection('modelLabPresets').document(existing_doc.id).update(preset_data)
            return jsonify({'success': True, 'message': 'Preset updated', 'id': existing_doc.id})
        else:
            preset_data['created_at'] = datetime.utcnow().isoformat()
            doc_ref = db.collection('modelLabPresets').add(preset_data)
            return jsonify({'success': True, 'message': 'Preset saved', 'id': doc_ref[1].id})
    except Exception as e:
        logging.error(f"Error in api_save_preset: {e}")
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500


@model_lab_bp.route('/presets/<preset_id>', methods=['DELETE'])
def api_delete_preset(preset_id):
    """Delete a model preset."""
    try:
        uid = request.args.get('uid')
        if not uid:
            return jsonify({'error': 'uid required'}), 400
        
        db = get_db()
        doc_ref = db.collection('modelLabPresets').document(preset_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return jsonify({'error': 'Preset not found'}), 404
        
        if doc.to_dict().get('uid') != uid:
            return jsonify({'error': 'Unauthorized'}), 403
        
        doc_ref.delete()
        return jsonify({'success': True, 'message': 'Preset deleted'})
    except Exception as e:
        logging.error(f"Error in api_delete_preset: {e}")
        return jsonify({'error': str(e)}), 500


@model_lab_bp.route('/predict', methods=['POST'])
def api_predict():
    """Apply a trained model configuration to predict xP/xG for a set of shots."""
    try:
        data = request.json
        uid = data.get('uid')
        model_config = data.get('model_config', {})
        shots = data.get('shots', [])
        training_dataset = data.get('training_dataset')
        target_field = data.get('target_field', 'xP')
        
        if not uid:
            return jsonify({'error': 'uid required'}), 400
        if not shots:
            return jsonify({'error': 'shots array required'}), 400
        if not model_config:
            return jsonify({'error': 'model_config required'}), 400
        
        start_time = time.time()
        
        df_shots = pd.DataFrame(shots)
        df_shots = engineer_features(df_shots)
        
        algorithm = model_config.get('algorithm', 'random_forest')
        features = model_config.get('features', ['dist', 'angle_abs', 'pressure_value', 'is_setplay'])
        params = model_config.get('algorithm_params', {})
        
        available_features = [f for f in features if f in df_shots.columns]
        if not available_features:
            return jsonify({'error': 'No valid features found in shot data'}), 400
        
        X_predict = df_shots[available_features].fillna(0)
        
        if training_dataset:
            try:
                df_train, _ = load_dataset(uid, training_dataset)
                
                y_train = df_train['is_goal'] if target_field == 'xG' else df_train['scored']
                X_train = df_train[available_features].fillna(0)
                
                scaler = StandardScaler()
                X_train_scaled = scaler.fit_transform(X_train)
                X_predict_scaled = scaler.transform(X_predict)
                
                model = create_model(algorithm, params)
                model.fit(X_train_scaled, y_train)
                
                predictions = model.predict_proba(X_predict_scaled)[:, 1].tolist()
                
                execution_time = round(time.time() - start_time, 2)
                
                return jsonify({
                    'success': True,
                    'predictions': predictions,
                    'model_info': {
                        'algorithm': algorithm,
                        'features_used': available_features,
                        'training_samples': len(df_train),
                        'prediction_samples': len(df_shots),
                        'execution_time': execution_time
                    }
                })
                
            except Exception as train_err:
                logging.warning(f"Could not train from dataset, using fallback: {train_err}")
        
        # Fallback: Use distance-based heuristic predictions
        predictions = []
        
        for _, shot in df_shots.iterrows():
            dist = shot.get('dist', 30)
            is_setplay = shot.get('is_setplay', 0)
            
            if target_field == 'xG':
                if dist <= 6:
                    prob = 0.45
                elif dist <= 10:
                    prob = 0.32
                elif dist <= 14:
                    prob = 0.22
                elif dist <= 20:
                    prob = 0.12
                else:
                    prob = 0.05
            else:
                if is_setplay:
                    if dist <= 20:
                        prob = 0.82
                    elif dist <= 30:
                        prob = 0.68
                    elif dist <= 40:
                        prob = 0.52
                    elif dist <= 45:
                        prob = 0.42
                    else:
                        prob = 0.30
                else:
                    if dist <= 15:
                        prob = 0.58
                    elif dist <= 20:
                        prob = 0.48
                    elif dist <= 25:
                        prob = 0.40
                    elif dist <= 30:
                        prob = 0.32
                    elif dist <= 35:
                        prob = 0.25
                    elif dist <= 40:
                        prob = 0.18
                    else:
                        prob = 0.12
            
            predictions.append(round(prob, 4))
        
        execution_time = round(time.time() - start_time, 2)
        
        return jsonify({
            'success': True,
            'predictions': predictions,
            'model_info': {
                'algorithm': 'distance_heuristic',
                'features_used': ['dist', 'is_setplay'],
                'prediction_samples': len(df_shots),
                'execution_time': execution_time,
                'note': 'Using fallback distance-based model'
            }
        })
        
    except Exception as e:
        logging.error(f"Error in api_predict: {e}")
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()}), 500