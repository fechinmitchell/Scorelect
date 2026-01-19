"""
Model Lab Backend - Simplified Custom Model System
"""

from flask import Blueprint, request, jsonify
import logging
import time
import traceback
from datetime import datetime

logger = logging.getLogger(__name__)

model_lab_bp = Blueprint('model_lab', __name__, url_prefix='/api/model-lab')

# Global db reference
_db = None

def init_firebase(db):
    global _db
    _db = db
    logger.info("Model Lab: Firebase initialized")

def get_db():
    global _db
    return _db

# Import custom models
try:
    from custom_models import AVAILABLE_MODELS, run_custom_model, get_model
    CUSTOM_MODELS_AVAILABLE = True
    logger.info(f"Custom models loaded: {list(AVAILABLE_MODELS.keys())}")
except ImportError as e:
    CUSTOM_MODELS_AVAILABLE = False
    AVAILABLE_MODELS = {}
    logger.warning(f"Custom models not available: {e}")


def load_dataset_raw(uid, dataset_name):
    """Load a dataset's shots into a DataFrame - memory optimized."""
    import pandas as pd
    
    db = get_db()
    games_ref = db.collection("savedGames").document(uid).collection("games")
    query = games_ref.where("datasetName", "==", dataset_name)
    
    all_shots = []
    game_docs = []  # Store minimal info for later updates
    
    for doc in query.stream():
        game_data = doc.to_dict()
        shots = game_data.get('gameData', [])
        
        # Track which shots belong to which game
        shot_indices = []
        for i, shot in enumerate(shots):
            shot_indices.append(len(all_shots))
            all_shots.append(shot)
        
        game_docs.append({
            'id': doc.id,
            'shot_indices': shot_indices
        })
        
        # Free memory
        del game_data, shots
    
    df = pd.DataFrame(all_shots)
    return df, game_docs


@model_lab_bp.route('/custom-models', methods=['GET'])
def api_get_custom_models():
    """Get list of available custom models."""
    try:
        if not CUSTOM_MODELS_AVAILABLE:
            return jsonify({'models': [], 'error': 'Custom models not loaded'})
        
        models = []
        for key, model_class in AVAILABLE_MODELS.items():
            instance = model_class()
            info = instance.get_info()
            models.append({
                'key': key,
                'name': info['name'],
                'description': info['description'],
                'features': info['features'],
            })
        
        return jsonify({'models': models})
        
    except Exception as e:
        logger.error(f"Error getting models: {e}")
        return jsonify({'models': [], 'error': str(e)})


@model_lab_bp.route('/test-model', methods=['POST'])
def api_test_model():
    """Test run a model - train and evaluate, saves to leaderboard."""
    try:
        if not CUSTOM_MODELS_AVAILABLE:
            return jsonify({'error': 'Custom models not available'}), 400
        
        data = request.json
        uid = data.get('uid')
        model_key = data.get('model_key')
        training_dataset = data.get('training_dataset')
        target_dataset = data.get('target_dataset', training_dataset)
        target_field = data.get('target_field', 'xP')
        leaderboard_year = data.get('leaderboard_year', '2026')
        
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
        
        # Run model
        result = run_custom_model(
            model_key=model_key,
            train_df=train_df,
            target_df=target_df,
            apply_to_target=True,
            target_field=target_field
        )
        
        execution_time = round(time.time() - start_time, 2)
        
        # Save to leaderboard
        leaderboard_saved = False
        leaderboard_error = None
        try:
            model_instance = get_model(model_key)
            model_info = model_instance.get_info()
            
            run_name = f"Test: {result['model_name']} - {datetime.utcnow().strftime('%m/%d %H:%M')}"
            
            db = get_db()
            db.collection('modelLabLeaderboard').add({
                'uid': uid,
                'year': leaderboard_year,
                'run_type': 'test',
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
                'created_at': datetime.utcnow().isoformat()
            })
            leaderboard_saved = True
            logger.info(f"Saved test run to {leaderboard_year} leaderboard")
        except Exception as save_err:
            leaderboard_error = str(save_err)
            logger.error(f"Could not save to leaderboard: {save_err}")
        
        return jsonify({
            'success': True,
            'test_run': True,
            'leaderboard_saved': leaderboard_saved,
            'leaderboard_error': leaderboard_error,
            'leaderboard_year': leaderboard_year,
            'model_key': model_key,
            'model_name': result['model_name'],
            'metrics': result['metrics'],
            'execution_time': execution_time,
        })
        
    except Exception as e:
        logger.error(f"Error in test run: {e}")
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()}), 500


@model_lab_bp.route('/run-model', methods=['POST'])
def api_run_model():
    """Run a model and apply predictions to database."""
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
            return jsonify({'error': f'Unknown model: {model_key}'}), 400
        
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
                
                del game_data, game_shots
        
        execution_time = round(time.time() - start_time, 2)
        
        # Save to leaderboard
        leaderboard_saved = False
        try:
            model_instance = get_model(model_key)
            model_info = model_instance.get_info()
            
            if not run_name:
                run_name = f"{result['model_name']} - {datetime.utcnow().strftime('%m/%d %H:%M')}"
            
            db.collection('modelLabLeaderboard').add({
                'uid': uid,
                'year': leaderboard_year,
                'run_type': 'applied',
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
                'created_at': datetime.utcnow().isoformat()
            })
            leaderboard_saved = True
            logger.info(f"Saved to {leaderboard_year} leaderboard")
        except Exception as save_err:
            logger.error(f"Could not save to leaderboard: {save_err}")
        
        return jsonify({
            'success': True,
            'test_run': False,
            'leaderboard_saved': leaderboard_saved,
            'model_key': model_key,
            'model_name': result['model_name'],
            'metrics': metrics,
            'shots_updated': shots_updated,
            'games_updated': games_updated,
            'execution_time': execution_time,
            'leaderboard_year': leaderboard_year,
        })
        
    except Exception as e:
        logger.error(f"Error running model: {e}")
        return jsonify({'success': False, 'error': str(e), 'traceback': traceback.format_exc()}), 500


@model_lab_bp.route('/datasets', methods=['GET'])
def api_get_datasets():
    """Get list of datasets for a user."""
    try:
        uid = request.args.get('uid')
        if not uid:
            return jsonify({'error': 'uid required'}), 400
        
        db = get_db()
        games_ref = db.collection("savedGames").document(uid).collection("games")
        
        datasets = {}
        for doc in games_ref.stream():
            game = doc.to_dict()
            dataset_name = game.get('datasetName', 'Uncategorized')
            shot_count = len(game.get('gameData', []))
            
            if dataset_name not in datasets:
                datasets[dataset_name] = {'games': 0, 'shots': 0}
            datasets[dataset_name]['games'] += 1
            datasets[dataset_name]['shots'] += shot_count
        
        return jsonify({
            'datasets': [
                {'name': name, **stats}
                for name, stats in sorted(datasets.items())
            ]
        })
        
    except Exception as e:
        logger.error(f"Error getting datasets: {e}")
        return jsonify({'error': str(e)}), 500


@model_lab_bp.route('/datasets-quick', methods=['GET'])
def api_get_datasets_quick():
    """Get just dataset names - memory efficient."""
    try:
        uid = request.args.get('uid')
        if not uid:
            return jsonify({'error': 'uid required'}), 400
        
        db = get_db()
        games_ref = db.collection("savedGames").document(uid).collection("games")
        
        # Only fetch datasetName field
        dataset_names = set()
        for doc in games_ref.select(['datasetName']).stream():
            data = doc.to_dict()
            if data.get('datasetName'):
                dataset_names.add(data['datasetName'])
        
        return jsonify({'datasets': sorted(list(dataset_names))})
        
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
        
        # Simple query without ordering (avoids composite index requirement)
        leaderboard_ref = db.collection('modelLabLeaderboard')\
            .where('uid', '==', uid)\
            .where('year', '==', year)\
            .limit(100)
        
        entries = []
        for doc in leaderboard_ref.stream():
            entry = doc.to_dict()
            entry['id'] = doc.id
            entries.append(entry)
        
        # Sort client-side by created_at or brier_score
        entries.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        logger.info(f"Leaderboard query: uid={uid}, year={year}, found={len(entries)}")
        
        return jsonify({
            'success': True,
            'year': year,
            'entries': entries,
            'count': len(entries)
        })
        
    except Exception as e:
        logger.error(f"Error getting leaderboard: {e}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'year': year,
            'entries': [],
            'count': 0,
            'error': str(e)
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
        
        if doc.to_dict().get('uid') != uid:
            return jsonify({'error': 'Not authorized'}), 403
        
        doc_ref.delete()
        return jsonify({'success': True, 'deleted': entry_id})
        
    except Exception as e:
        logger.error(f"Error deleting entry: {e}")
        return jsonify({'error': str(e)}), 500