"""
Model Builder / Python Lab for Scorelect v2.0
=============================================
Enhanced version with:
- Training dataset vs Target dataset support
- Custom code execution
- Function discovery endpoint
- Use existing xP/xG values as features

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

try:
    from imblearn.over_sampling import SMOTE
    SMOTE_AVAILABLE = True
except ImportError:
    SMOTE_AVAILABLE = False

firebase_db = None

def init_firebase(db):
    global firebase_db
    firebase_db = db
    logging.info("Model Lab: Firebase initialized")

def get_db():
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
    # Helper function to safely get column as Series
    def safe_get_column(df, col, default_value):
        if col in df.columns:
            return df[col]
        return pd.Series([default_value] * len(df), index=df.index)
    
    df['x'] = pd.to_numeric(safe_get_column(df, 'x', 0), errors='coerce').fillna(0)
    df['y'] = pd.to_numeric(safe_get_column(df, 'y', 0), errors='coerce').fillna(0)
    
    GOAL_X, GOAL_Y = 145, 44
    df['dist'] = np.sqrt((GOAL_X - df['x'])**2 + (GOAL_Y - df['y'])**2)
    df['angle'] = np.degrees(np.arctan2(GOAL_Y - df['y'], GOAL_X - df['x']))
    df['angle_abs'] = df['angle'].abs()
    df['dist_squared'] = df['dist'] ** 2
    df['dist_log'] = np.log1p(df['dist'])
    df['dist_angle_interaction'] = df['dist'] * df['angle_abs'] / 90
    df['dist_to_sideline'] = np.minimum(df['y'], 88 - df['y'])
    
    pressure_map = {'none': 0, 'low': 0.33, 'medium': 0.67, 'high': 1.0, 'n': 0, 'y': 1, '': 0}
    df['pressure_value'] = safe_get_column(df, 'pressure', '').astype(str).str.lower().map(pressure_map).fillna(0)
    
    position_map = {'goalkeeper': 0, 'back': 1, 'defender': 1, 'midfielder': 2, 'forward': 3, 'attacker': 3}
    df['position_value'] = safe_get_column(df, 'position', '').astype(str).str.lower().map(lambda p: position_map.get(p.strip(), 2))
    
    df['is_right_foot'] = safe_get_column(df, 'foot', '').astype(str).str.lower().str.contains('right', na=False).astype(int)
    df['is_left_foot'] = safe_get_column(df, 'foot', '').astype(str).str.lower().str.contains('left', na=False).astype(int)
    
    action_col = safe_get_column(df, 'action', '').astype(str).str.lower()
    df['is_setplay'] = action_col.str.contains(r'\b(free|penalty|45|sideline|mark)\b', case=False, regex=True, na=False).astype(int)
    df['is_penalty'] = action_col.str.contains(r'\bpenalty\b', case=False, regex=True, na=False).astype(int)
    df['is_free'] = action_col.str.contains(r'\bfree\b', case=False, regex=True, na=False).astype(int)
    df['is_45'] = action_col.str.contains(r'\b45\b', case=False, regex=True, na=False).astype(int)
    
    df['is_central'] = ((df['angle_abs'] < 30) & (df['dist'] < 35)).astype(int)
    df['is_long_shot'] = (df['dist'] > 40).astype(int)
    df['is_very_close'] = (df['dist'] < 15).astype(int)
    df['is_extreme_angle'] = (df['angle_abs'] > 50).astype(int)
    
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
    games_ref = db.collection("savedGames").document(uid).collection("games").where("datasetName", "==", dataset_name)
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


def create_model(algorithm, params=None):
    """Create a model instance based on algorithm name."""
    params = params or {}
    
    if algorithm == 'random_forest':
        return RandomForestClassifier(n_estimators=params.get('n_estimators', 100), max_depth=params.get('max_depth', 10), random_state=42, n_jobs=-1)
    elif algorithm == 'gradient_boosting':
        return GradientBoostingClassifier(n_estimators=params.get('n_estimators', 100), learning_rate=params.get('learning_rate', 0.1), max_depth=params.get('max_depth', 3), random_state=42)
    elif algorithm == 'logistic_regression':
        return LogisticRegression(C=params.get('C', 1.0), random_state=42, max_iter=1000)
    elif algorithm == 'mlp':
        return MLPClassifier(hidden_layer_sizes=(100, 50), learning_rate_init=params.get('learning_rate_init', 0.001), random_state=42, max_iter=500)
    elif algorithm == 'knn':
        return KNeighborsClassifier(n_neighbors=params.get('n_neighbors', 5))
    else:
        return RandomForestClassifier(n_estimators=100, random_state=42)


def calculate_metrics(y_true, y_pred, y_proba):
    """Calculate model evaluation metrics."""
    return {
        'accuracy': float(accuracy_score(y_true, y_pred)),
        'f1_score': float(f1_score(y_true, y_pred, zero_division=0)),
        'precision': float(precision_score(y_true, y_pred, zero_division=0)),
        'recall': float(recall_score(y_true, y_pred, zero_division=0)),
        'auc_roc': float(roc_auc_score(y_true, y_proba)) if len(set(y_true)) > 1 else 0.5,
    }


@model_lab_bp.route('/datasets', methods=['GET'])
def api_get_datasets():
    """Get list of datasets with shot counts for a user."""
    try:
        uid = request.args.get('uid')
        if not uid:
            return jsonify({'error': 'uid required'}), 400
        
        db = get_db()
        datasets = {}
        
        for doc in db.collection('savedGames').document(uid).collection('games').stream():
            game_data = doc.to_dict()
            ds_name = game_data.get('datasetName', 'Uncategorized')
            shots = len(game_data.get('gameData', []))
            
            if ds_name not in datasets:
                datasets[ds_name] = {'name': ds_name, 'games': 0, 'shots': 0}
            datasets[ds_name]['games'] += 1
            datasets[ds_name]['shots'] += shots
        
        return jsonify({'datasets': sorted(datasets.values(), key=lambda x: x['shots'], reverse=True)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@model_lab_bp.route('/run-visual', methods=['POST'])
def api_run_visual_model():
    """Train and evaluate a model (without applying to data)."""
    try:
        data = request.json
        uid, config, dataset_name = data.get('uid'), data.get('config'), data.get('dataset_name')
        
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
        
        X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=(1 - train_size), random_state=42, stratify=y)
        
        if balance_classes and SMOTE_AVAILABLE and y_train.sum() > 5:
            try:
                smote = SMOTE(random_state=42)
                X_train, y_train = smote.fit_resample(X_train, y_train)
            except:
                pass
        
        model = create_model(algorithm, params)
        model.fit(X_train, y_train)
        
        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)[:, 1]
        
        metrics = calculate_metrics(y_test, y_pred, y_proba)
        
        return jsonify({
            'success': True,
            'metrics': metrics,
            'execution_time': round(time.time() - start_time, 2),
            'dataset_info': {'name': dataset_name, 'total_shots': len(df), 'train_samples': len(X_train), 'test_samples': len(X_test)}
        })
    except Exception as e:
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
        
        X_train, X_test, y_train, y_test = train_test_split(X_scaled, y_full, test_size=(1 - train_size), random_state=42, stratify=y_full)
        
        if balance_classes and SMOTE_AVAILABLE and y_train.sum() > 5:
            try:
                smote = SMOTE(random_state=42)
                X_train, y_train = smote.fit_resample(X_train, y_train)
            except:
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
                    'modelConfig': {'algorithm': algorithm, 'features': available_features, 'target': target_field, 'metrics': metrics}
                })
                games_updated += 1
        
        # Save to history
        try:
            from firebase_admin import firestore as fs
            db.collection('modelLabRuns').add({
                'uid': uid, 'type': 'applied_to_data', 'algorithm': algorithm, 'config': config, 
                'source_dataset': dataset_name, 'target_dataset': target_dataset,
                'target_field': target_field, 'metrics': metrics, 'shots_updated': shots_updated, 
                'games_updated': games_updated, 'execution_time': round(time.time() - start_time, 2), 
                'timestamp': fs.SERVER_TIMESTAMP
            })
        except:
            pass
        
        return jsonify({
            'success': True, 'metrics': metrics, 'shots_updated': shots_updated, 
            'games_updated': games_updated, 'execution_time': round(time.time() - start_time, 2)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()}), 500


@model_lab_bp.route('/reset-values', methods=['POST'])
def api_reset_values():
    """Reset all xP or xG values to 0 for a specific dataset."""
    try:
        data = request.json
        uid, dataset_name, target_field = data.get('uid'), data.get('dataset_name'), data.get('target_field', 'xP')
        
        if not all([uid, dataset_name]):
            return jsonify({'error': 'uid and dataset_name required'}), 400
        if target_field not in ['xP', 'xG']:
            return jsonify({'error': 'target_field must be "xP" or "xG"'}), 400
        
        db = get_db()
        games_ref = db.collection("savedGames").document(uid).collection("games").where("datasetName", "==", dataset_name)
        shots_reset, games_updated = 0, 0
        
        for game_doc in games_ref.stream():
            game_data = game_doc.to_dict()
            game_shots = game_data.get('gameData', [])
            for shot in game_shots:
                shot[target_field] = 0
                shots_reset += 1
            db.collection("savedGames").document(uid).collection("games").document(game_doc.id).update({'gameData': game_shots})
            games_updated += 1
        
        return jsonify({'success': True, 'shots_reset': shots_reset, 'games_updated': games_updated, 'target_field': target_field})
    except Exception as e:
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
    return jsonify({'success': True, 'functions': functions, 'smote_available': SMOTE_AVAILABLE})


@model_lab_bp.route('/run-custom-code', methods=['POST'])
def api_run_custom_code():
    """Execute custom Python code with access to the dataset."""
    try:
        data = request.json
        uid, code, dataset_name = data.get('uid'), data.get('code', ''), data.get('dataset_name')
        target_field = data.get('target_field', 'xP')
        apply_results = data.get('apply_results', False)
        
        if not all([uid, code, dataset_name]):
            return jsonify({'error': 'uid, code, and dataset_name required'}), 400
        
        start_time = time.time()
        df, game_docs = load_dataset(uid, dataset_name)
        
        # Restricted execution environment - all imports pre-loaded
        exec_globals = {
            '__builtins__': {'print': print, 'len': len, 'range': range, 'list': list, 'dict': dict,
                            'str': str, 'int': int, 'float': float, 'bool': bool, 'tuple': tuple,
                            'set': set, 'sum': sum, 'min': min, 'max': max, 'abs': abs, 'round': round,
                            'sorted': sorted, 'enumerate': enumerate, 'zip': zip, 'any': any, 'all': all,
                            'isinstance': isinstance, 'hasattr': hasattr, 'getattr': getattr, 'setattr': setattr},
            'pd': pd, 'np': np, 'df': df.copy(),
            'StandardScaler': StandardScaler, 'train_test_split': train_test_split,
            'RandomForestClassifier': RandomForestClassifier, 'GradientBoostingClassifier': GradientBoostingClassifier,
            'LogisticRegression': LogisticRegression, 'MLPClassifier': MLPClassifier, 'KNeighborsClassifier': KNeighborsClassifier,
            'accuracy_score': accuracy_score, 'f1_score': f1_score, 'roc_auc_score': roc_auc_score,
            'precision_score': precision_score, 'recall_score': recall_score,
            'engineer_features': engineer_features, 'create_model': create_model, 'calculate_metrics': calculate_metrics,
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
                        'gameData': game_shots, 'lastModelUpdate': datetime.utcnow().isoformat()
                    })
                    games_updated += 1
        
        # Save code run to history if there are metrics
        if metrics:
            try:
                from firebase_admin import firestore as fs
                db.collection('modelLabRuns').add({
                    'uid': uid, 
                    'type': 'custom_code',
                    'source': 'code_editor',
                    'algorithm': 'custom_code',
                    'model_type': 'custom_code',
                    'code': code[:5000],  # Limit code size stored
                    'dataset_name': dataset_name,
                    'target_field': target_field,
                    'metrics': metrics,
                    'shots_updated': shots_updated,
                    'games_updated': games_updated,
                    'execution_time': round(time.time() - start_time, 2),
                    'timestamp': fs.SERVER_TIMESTAMP
                })
            except Exception as save_err:
                logging.warning(f"Could not save code run to history: {save_err}")
        
        return jsonify({
            'success': True, 'output': output, 'metrics': metrics,
            'predictions_count': len(predictions), 'shots_updated': shots_updated,
            'games_updated': games_updated, 'execution_time': round(time.time() - start_time, 2)
        })
    except SyntaxError as e:
        return jsonify({'success': False, 'error': f'Syntax Error: {str(e)}', 'line': e.lineno}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()}), 500


@model_lab_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'module': 'model_lab', 'smote_available': SMOTE_AVAILABLE, 'version': '2.0.0'})


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
        return jsonify({'error': str(e)}), 500


@model_lab_bp.route('/presets', methods=['POST'])
def api_save_preset():
    """Save a model preset."""
    try:
        data = request.json
        uid = data.get('uid')
        name = data.get('name')
        config = data.get('config')
        preset_type = data.get('type', 'visual')  # 'visual' or 'code'
        code = data.get('code', '')
        
        if not all([uid, name, config]):
            return jsonify({'error': 'uid, name, and config required'}), 400
        
        db = get_db()
        
        # Check if preset with same name exists
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
            # Update existing
            db.collection('modelLabPresets').document(existing_doc.id).update(preset_data)
            return jsonify({'success': True, 'message': 'Preset updated', 'id': existing_doc.id})
        else:
            # Create new
            preset_data['created_at'] = datetime.utcnow().isoformat()
            doc_ref = db.collection('modelLabPresets').add(preset_data)
            return jsonify({'success': True, 'message': 'Preset saved', 'id': doc_ref[1].id})
    except Exception as e:
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
        return jsonify({'error': str(e)}), 500