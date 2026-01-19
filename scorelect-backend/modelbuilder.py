"""
Model Builder for Scorelect - Simplified v5.0
=============================================
Clean API for running custom models from custom_models.py

Endpoints:
- GET  /api/model-lab/custom-models     - List available models
- POST /api/model-lab/test-model        - Test run (no DB updates)
- POST /api/model-lab/run-model         - Run and apply to database
- GET  /api/model-lab/datasets          - List user datasets
- GET  /api/model-lab/leaderboard       - Get leaderboard entries

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
from datetime import datetime

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

firebase_db = None


def init_firebase(db):
    """Initialize Firebase database reference."""
    global firebase_db
    firebase_db = db
    logging.info("Model Lab: Firebase initialized")


def get_db():
    """Get Firebase database reference."""
    global firebase_db
    if firebase_db is None:
        from firebase_admin import firestore
        firebase_db = firestore.client()
    return firebase_db


model_lab_bp = Blueprint('model_lab', __name__, url_prefix='/api/model-lab')
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# =============================================================================
# DATASET LOADING
# =============================================================================

def load_dataset_raw(uid, dataset_name):
    """
    Load dataset from Firestore without feature engineering.
    Memory optimized - loads one game at a time.
    """
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
            'shot_indices': list(range(len(all_shots), len(all_shots) + len(game_shots)))
        })
        
        for idx, shot in enumerate(game_shots):
            shot['_game_id'] = game_doc.id
            shot['_shot_idx'] = idx
            all_shots.append(shot)
        
        # Don't keep full game_data in memory - we only need shot_indices and id
        del game_data
    
    if not all_shots:
        raise ValueError(f"No shots found in dataset '{dataset_name}'")
    
    df = pd.DataFrame(all_shots)
    
    # Clear the list to free memory
    del all_shots
    
    return df, game_docs


# =============================================================================
# API ENDPOINTS
# =============================================================================

@model_lab_bp.route('/custom-models', methods=['GET'])
def api_get_custom_models():
    """Get list of available custom models."""
    try:
        if not CUSTOM_MODELS_AVAILABLE:
            return jsonify({'success': False, 'error': 'Custom models not available', 'models': []})
        
        models = get_available_models()
        return jsonify({'success': True, 'models': models, 'count': len(models)})
    except Exception as e:
        logger.error(f"Error getting custom models: {e}")
        return jsonify({'error': str(e)}), 500


@model_lab_bp.route('/test-model', methods=['POST'])
def api_test_model():
    """
    Test run a model - train and evaluate but DON'T update database.
    
    Request body:
    {
        "uid": "user_id",
        "model_key": "example",
        "training_dataset": "dataset_name",
        "target_dataset": "dataset_name" (optional),
        "target_field": "xP" or "xG"
    }
    """
    try:
        if not CUSTOM_MODELS_AVAILABLE:
            return jsonify({'error': 'Custom models not available'}), 400
        
        data = request.json
        uid = data.get('uid')
        model_key = data.get('model_key')
        training_dataset = data.get('training_dataset')
        target_dataset = data.get('target_dataset', training_dataset)
        target_field = data.get('target_field', 'xP')
        
        if not all([uid, model_key, training_dataset]):
            return jsonify({'error': 'uid, model_key, and training_dataset required'}), 400
        
        if model_key not in AVAILABLE_MODELS:
            return jsonify({'error': f'Unknown model: {model_key}', 'available': list(AVAILABLE_MODELS.keys())}), 400
        
        start_time = time.time()
        
        # Load training data
        train_df, _ = load_dataset_raw(uid, training_dataset)
        logger.info(f"Test run: Loaded {len(train_df)} shots from {training_dataset}")
        
        # Load target data if different
        if target_dataset != training_dataset:
            target_df, _ = load_dataset_raw(uid, target_dataset)
        else:
            target_df = train_df
        
        # Run model (with predictions but no DB updates)
        result = run_custom_model(
            model_key=model_key,
            train_df=train_df,
            target_df=target_df,
            apply_to_target=True,
            target_field=target_field
        )
        
        execution_time = round(time.time() - start_time, 2)
        
        # Save to leaderboard (even for test runs)
        try:
            from firebase_admin import firestore as fs
            
            # Get model info for storing
            model_instance = get_model(model_key)
            model_info = model_instance.get_info()
            
            run_name = f"Test: {result['model_name']} - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
            
            db = get_db()
            db.collection('modelLabLeaderboard').add({
                'uid': uid,
                'year': '2026',  # Default to current year for tests
                'run_type': 'test',  # Mark as test run
                'model_key': model_key,
                'model_name': result['model_name'],
                'run_name': run_name,
                'training_dataset': training_dataset,
                'target_dataset': target_dataset,
                'target_field': target_field,
                'metrics': {
                    'brier_score': result['metrics'].get('brier_score'),
                    'calibration_error': result['metrics'].get('calibration_error'),
                    'auc_roc': result['metrics'].get('auc_roc'),
                    'f1_score': result['metrics'].get('f1_score'),
                    'accuracy': result['metrics'].get('accuracy'),
                },
                'model_config': {
                    'features': model_info.get('features', []),
                    'params': model_info.get('params', {}),
                    'description': model_info.get('description', ''),
                },
                'execution_time': execution_time,
                'timestamp': fs.SERVER_TIMESTAMP
            })
            logger.info(f"Saved test run to leaderboard")
        except Exception as save_err:
            logger.warning(f"Could not save test run to leaderboard: {save_err}")
        
        # Save to leaderboard (as test run)
        try:
            from firebase_admin import firestore as fs
            
            # Get model info for storing
            model_instance = get_model(model_key)
            model_info = model_instance.get_info()
            
            run_name = f"[Test] {result['model_name']} - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
            
            db = get_db()
            db.collection('modelLabLeaderboard').add({
                'uid': uid,
                'year': '2026',  # Default to current year
                'run_type': 'test',  # Mark as test run
                'model_key': model_key,
                'model_name': result['model_name'],
                'run_name': run_name,
                'training_dataset': training_dataset,
                'target_dataset': target_dataset,
                'target_field': target_field,
                'metrics': {
                    'brier_score': result['metrics'].get('brier_score'),
                    'calibration_error': result['metrics'].get('calibration_error'),
                    'auc_roc': result['metrics'].get('auc_roc'),
                    'f1_score': result['metrics'].get('f1_score'),
                    'accuracy': result['metrics'].get('accuracy'),
                },
                'model_config': {
                    'features': model_info.get('features', []),
                    'target': model_info.get('target', 'scored'),
                    'params': model_info.get('params', {}),
                    'description': model_info.get('description', ''),
                },
                'execution_time': execution_time,
                'timestamp': fs.SERVER_TIMESTAMP
            })
            logger.info(f"Saved test run to leaderboard")
        except Exception as save_err:
            logger.warning(f"Could not save test run to leaderboard: {save_err}")
        
        return jsonify({
            'success': True,
            'test_run': True,  # Flag that this was a test
            'model_key': model_key,
            'model_name': result['model_name'],
            'metrics': result['metrics'],
            'execution_time': execution_time,
            'dataset_info': {
                'training_dataset': training_dataset,
                'target_dataset': target_dataset,
                'training_shots': len(train_df),
                'target_shots': len(target_df),
            }
        })
        
    except Exception as e:
        logger.error(f"Error in test run: {e}")
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()}), 500


@model_lab_bp.route('/run-model', methods=['POST'])
def api_run_model():
    """
    Run a model and apply predictions to database.
    
    Request body:
    {
        "uid": "user_id",
        "model_key": "example",
        "training_dataset": "dataset_name",
        "target_dataset": "dataset_name" (optional),
        "target_field": "xP" or "xG",
        "run_name": "optional name",
        "leaderboard_year": "2026" (default)
    }
    """
    try:
        if not CUSTOM_MODELS_AVAILABLE:
            return jsonify({'error': 'Custom models not available'}), 400
        
        data = request.json
        uid = data.get('uid')
        model_key = data.get('model_key')
        training_dataset = data.get('training_dataset')
        target_dataset = data.get('target_dataset', training_dataset)
        target_field = data.get('target_field', 'xP')
        run_name = data.get('run_name', '').strip()
        leaderboard_year = data.get('leaderboard_year', '2026')
        
        if not all([uid, model_key, training_dataset]):
            return jsonify({'error': 'uid, model_key, and training_dataset required'}), 400
        
        if model_key not in AVAILABLE_MODELS:
            return jsonify({'error': f'Unknown model: {model_key}', 'available': list(AVAILABLE_MODELS.keys())}), 400
        
        start_time = time.time()
        db = get_db()
        
        # Load training data
        train_df, train_game_docs = load_dataset_raw(uid, training_dataset)
        logger.info(f"Run: Loaded {len(train_df)} shots from {training_dataset}")
        
        # Load target data if different
        if target_dataset != training_dataset:
            target_df, target_game_docs = load_dataset_raw(uid, target_dataset)
        else:
            target_df, target_game_docs = train_df, train_game_docs
        
        # Run model
        result = run_custom_model(
            model_key=model_key,
            train_df=train_df,
            target_df=target_df,
            apply_to_target=True,
            target_field=target_field
        )
        
        metrics = result['metrics']
        predictions = result.get('predictions', [])
        
        # Update target dataset with predictions
        shots_updated, games_updated = 0, 0
        
        if predictions:
            logger.info(f"Applying {len(predictions)} predictions to {target_dataset}")
            
            # Re-fetch games one at a time to apply predictions (memory efficient)
            for game_info in target_game_docs:
                game_ref = db.collection("savedGames").document(uid).collection("games").document(game_info['id'])
                game_doc = game_ref.get()
                
                if not game_doc.exists:
                    continue
                
                game_data = game_doc.to_dict()
                game_shots = game_data.get('gameData', [])
                updated = False
                
                for local_idx, global_idx in enumerate(game_info['shot_indices']):
                    if local_idx < len(game_shots) and global_idx < len(predictions):
                        game_shots[local_idx][target_field] = round(float(predictions[global_idx]), 4)
                        shots_updated += 1
                        updated = True
                
                if updated:
                    game_ref.update({
                        'gameData': game_shots,
                        'lastModelUpdate': datetime.utcnow().isoformat(),
                        'modelConfig': {
                            'model_key': model_key,
                            'model_name': result['model_name'],
                            'target': target_field,
                        }
                    })
                    games_updated += 1
                
                # Free memory after each game
                del game_data, game_shots
        
        execution_time = round(time.time() - start_time, 2)
        
        # Save to leaderboard
        try:
            from firebase_admin import firestore as fs
            
            # Get model info for storing
            model_instance = get_model(model_key)
            model_info = model_instance.get_info()
            
            if not run_name:
                run_name = f"{result['model_name']} - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
            
            db.collection('modelLabLeaderboard').add({
                'uid': uid,
                'year': leaderboard_year,
                'run_type': 'applied',  # Mark as applied run
                'model_key': model_key,
                'model_name': result['model_name'],
                'run_name': run_name,
                'training_dataset': training_dataset,
                'target_dataset': target_dataset,
                'target_field': target_field,
                'metrics': {
                    'brier_score': metrics.get('brier_score'),
                    'calibration_error': metrics.get('calibration_error'),
                    'auc_roc': metrics.get('auc_roc'),
                    'f1_score': metrics.get('f1_score'),
                    'accuracy': metrics.get('accuracy'),
                },
                'model_config': {
                    'features': model_info.get('features', []),
                    'params': model_info.get('params', {}),
                    'description': model_info.get('description', ''),
                },
                'shots_updated': shots_updated,
                'games_updated': games_updated,
                'execution_time': execution_time,
                'timestamp': fs.SERVER_TIMESTAMP
            })
            logger.info(f"Saved to {leaderboard_year} leaderboard")
        except Exception as save_err:
            logger.warning(f"Could not save to leaderboard: {save_err}")
        
        return jsonify({
            'success': True,
            'test_run': False,
            'model_key': model_key,
            'model_name': result['model_name'],
            'metrics': metrics,
            'shots_updated': shots_updated,
            'games_updated': games_updated,
            'execution_time': execution_time,
            'leaderboard_year': leaderboard_year,
            'dataset_info': {
                'training_dataset': training_dataset,
                'target_dataset': target_dataset,
                'training_shots': len(train_df),
                'target_shots': len(target_df),
            }
        })
        
    except Exception as e:
        logger.error(f"Error running model: {e}")
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()}), 500


@model_lab_bp.route('/datasets', methods=['GET'])
def api_get_datasets():
    """Get list of user's datasets with basic info (no full game data loaded)."""
    try:
        uid = request.args.get('uid')
        if not uid:
            return jsonify({'error': 'uid required'}), 400
        
        db = get_db()
        games_ref = db.collection("savedGames").document(uid).collection("games")
        
        # Only select fields we need - NOT the full gameData array
        datasets = {}
        for game_doc in games_ref.select(['datasetName']).stream():
            game_data = game_doc.to_dict()
            dataset_name = game_data.get('datasetName', 'Unnamed')
            
            if dataset_name not in datasets:
                datasets[dataset_name] = {'name': dataset_name, 'games': 0}
            
            datasets[dataset_name]['games'] += 1
        
        return jsonify({
            'success': True,
            'datasets': list(datasets.values()),
            'dataset_names': list(datasets.keys())
        })
        
    except Exception as e:
        logger.error(f"Error getting datasets: {e}")
        return jsonify({'error': str(e)}), 500


@model_lab_bp.route('/leaderboard', methods=['GET'])
def api_get_leaderboard():
    """Get leaderboard entries for a specific year."""
    try:
        uid = request.args.get('uid')
        year = request.args.get('year', '2026')
        
        if not uid:
            return jsonify({'error': 'uid required'}), 400
        
        db = get_db()
        
        # Query leaderboard for this user and year
        leaderboard_ref = db.collection('modelLabLeaderboard')\
            .where('uid', '==', uid)\
            .where('year', '==', year)\
            .order_by('timestamp', direction='DESCENDING')\
            .limit(100)
        
        entries = []
        for doc in leaderboard_ref.stream():
            entry = doc.to_dict()
            entry['id'] = doc.id
            # Convert timestamp
            if entry.get('timestamp'):
                entry['timestamp'] = entry['timestamp'].isoformat() if hasattr(entry['timestamp'], 'isoformat') else str(entry['timestamp'])
            entries.append(entry)
        
        return jsonify({
            'success': True,
            'year': year,
            'entries': entries,
            'count': len(entries)
        })
        
    except Exception as e:
        logger.error(f"Error getting leaderboard: {e}")
        # Return empty leaderboard on error (likely no composite index yet)
        return jsonify({
            'success': True,
            'year': year,
            'entries': [],
            'count': 0,
            'note': 'Leaderboard may need index creation'
        })


@model_lab_bp.route('/leaderboard/<entry_id>', methods=['DELETE'])
def api_delete_leaderboard_entry(entry_id):
    """Delete a leaderboard entry."""
    try:
        uid = request.args.get('uid')
        if not uid:
            return jsonify({'error': 'uid required'}), 400
        
        db = get_db()
        doc_ref = db.collection('modelLabLeaderboard').document(entry_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return jsonify({'error': 'Entry not found'}), 404
        
        # Verify ownership
        if doc.to_dict().get('uid') != uid:
            return jsonify({'error': 'Not authorized'}), 403
        
        doc_ref.delete()
        return jsonify({'success': True, 'deleted': entry_id})
        
    except Exception as e:
        logger.error(f"Error deleting entry: {e}")
        return jsonify({'error': str(e)}), 500


# =============================================================================
# QUICK ENDPOINTS (for faster loading)
# =============================================================================

@model_lab_bp.route('/datasets-quick', methods=['GET'])
def api_get_datasets_quick():
    """Quick endpoint - just returns dataset names WITHOUT loading game data."""
    try:
        uid = request.args.get('uid')
        if not uid:
            return jsonify({'error': 'uid required'}), 400
        
        db = get_db()
        games_ref = db.collection("savedGames").document(uid).collection("games")
        
        # Only select the datasetName field - don't load gameData!
        dataset_names = set()
        for game_doc in games_ref.select(['datasetName']).stream():
            game_data = game_doc.to_dict()
            dataset_name = game_data.get('datasetName')
            if dataset_name:
                dataset_names.add(dataset_name)
        
        return jsonify({
            'success': True,
            'datasets': sorted(list(dataset_names))
        })
        
    except Exception as e:
        logger.error(f"Error getting datasets quick: {e}")
        return jsonify({'error': str(e)}), 500