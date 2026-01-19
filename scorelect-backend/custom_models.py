"""
╔══════════════════════════════════════════════════════════════════════════════╗
║                    SCORELECT CUSTOM MODELS - SIMPLIFIED                       ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Version: 5.0 (Simplified)                                                   ║
║  Purpose: Create custom xP/xG models for GAA analytics                       ║
╚══════════════════════════════════════════════════════════════════════════════╝

HOW TO USE THIS FILE:
====================
1. Look at the EXAMPLE MODEL below (ExampleModel class)
2. Copy it to the "YOUR CUSTOM MODELS" section
3. Rename the class and customize it
4. Add your model to AVAILABLE_MODELS at the bottom
5. Restart your server
6. Select your model in the Model Lab UI!

AVAILABLE FEATURES (auto-generated, use in get_feature_list):
=============================================================
Distance:    dist, dist_squared, dist_log
Angle:       angle, angle_abs, goal_angle
Zones:       close_range, mid_range, long_range, beyond_40m, beyond_50m
Position:    central_zone, penalty_area, danger_zone, on_left_side
Context:     pressure_value (0-3), position_value (0-3), foot_value (0-2)
Set Pieces:  is_setplay, is_penalty, is_free, is_45
Existing:    existing_xP, existing_xG (previous model values)
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score, 
    roc_auc_score, confusion_matrix, log_loss, brier_score_loss
)
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# BASE CLASS - DO NOT MODIFY
# =============================================================================

class BaseCustomModel:
    """
    Base class for all custom models. 
    Inherit from this to create your own model.
    """
    
    # Model identity
    name = "Base Model"
    description = "Base model class"
    version = "1.0"
    
    # GAA pitch constants
    GOAL_X = 145
    GOAL_Y = 44
    GOAL_WIDTH = 7.32
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.is_trained = False
        self.feature_names = []
        self.metrics = {}
    
    # =========================================================================
    # METHODS TO OVERRIDE IN YOUR MODEL
    # =========================================================================
    
    def get_feature_list(self):
        """Return list of features your model uses."""
        return ['dist', 'angle_abs', 'pressure_value', 'is_setplay']
    
    def train(self, X, y):
        """Train and return your model. X is scaled features, y is target."""
        model = LogisticRegression(max_iter=1000, random_state=42)
        model.fit(X, y)
        return model
    
    def get_target_column(self):
        """What to predict: 'scored' for xP, 'is_goal' for xG."""
        return 'scored'
    
    def engineer_features(self, df):
        """Optional: Add custom features to the dataframe."""
        return df
    
    def custom_scoring(self, df):
        """Optional: Define custom scoring rules. Return None for default."""
        return None
    
    def custom_evaluation(self, y_true, y_pred, y_proba):
        """Optional: Add custom metrics. Return dict or None."""
        return None
    
    def get_model_params(self):
        """Optional: Return parameters for display."""
        return {}
    
    # =========================================================================
    # INTERNAL METHODS - DO NOT MODIFY
    # =========================================================================
    
    def base_features(self, df):
        """Generate standard features from raw data."""
        # Ensure x and y columns exist
        if 'x' not in df.columns:
            df['x'] = 0
        if 'y' not in df.columns:
            df['y'] = 0
        
        df['x'] = pd.to_numeric(df['x'], errors='coerce').fillna(0)
        df['y'] = pd.to_numeric(df['y'], errors='coerce').fillna(0)
        
        # Distance features
        df['dist'] = np.sqrt((self.GOAL_X - df['x'])**2 + (self.GOAL_Y - df['y'])**2)
        df['dist_squared'] = df['dist'] ** 2
        df['dist_log'] = np.log1p(df['dist'])
        
        # Angle features
        df['angle'] = np.degrees(np.arctan2(np.abs(df['y'] - self.GOAL_Y), self.GOAL_X - df['x']))
        df['angle_abs'] = df['angle'].abs()
        df['goal_angle'] = np.degrees(np.abs(
            np.arctan2(self.GOAL_Y + self.GOAL_WIDTH/2 - df['y'], self.GOAL_X - df['x']) -
            np.arctan2(self.GOAL_Y - self.GOAL_WIDTH/2 - df['y'], self.GOAL_X - df['x'])
        ))
        
        # Distance zones
        df['close_range'] = (df['dist'] < 20).astype(int)
        df['mid_range'] = ((df['dist'] >= 20) & (df['dist'] < 35)).astype(int)
        df['long_range'] = ((df['dist'] >= 35) & (df['dist'] < 50)).astype(int)
        df['beyond_40m'] = (df['dist'] >= 40).astype(int)
        df['beyond_50m'] = (df['dist'] >= 50).astype(int)
        
        # Position zones
        df['central_zone'] = ((df['y'] > 30) & (df['y'] < 58)).astype(int)
        df['penalty_area'] = (df['x'] > 125).astype(int)
        df['danger_zone'] = ((df['x'] > 110) & (df['central_zone'] == 1)).astype(int)
        df['on_left_side'] = (df['y'] < self.GOAL_Y).astype(int)
        
        # Set piece detection
        if 'action' in df.columns:
            action_str = df['action'].astype(str).str.lower()
            df['is_setplay'] = action_str.str.contains(r'free|penalty|45|fortyfive|sideline|mark', regex=True, na=False).astype(int)
            df['is_penalty'] = action_str.str.contains(r'penalty', regex=True, na=False).astype(int)
            df['is_free'] = action_str.str.contains(r'free', regex=True, na=False).astype(int)
            df['is_45'] = action_str.str.contains(r'45|fortyfive', regex=True, na=False).astype(int)
        else:
            df['is_setplay'] = df['is_penalty'] = df['is_free'] = df['is_45'] = 0
        
        # Context encoding
        pressure_map = {'high': 3, 'medium': 2, 'low': 1, 'none': 0, 'y': 2, 'n': 0, '': 0}
        if 'pressure' in df.columns:
            df['pressure_value'] = df['pressure'].astype(str).str.lower().map(pressure_map).fillna(0)
        else:
            df['pressure_value'] = 0
        
        position_map = {'forward': 3, 'midfielder': 2, 'midfield': 2, 'back': 1, 'defender': 1, 'goalkeeper': 0}
        if 'position' in df.columns:
            df['position_value'] = df['position'].astype(str).str.lower().map(position_map).fillna(2)
        else:
            df['position_value'] = 2
        
        foot_map = {'right': 0, 'left': 1, 'hand': 2}
        if 'foot' in df.columns:
            df['foot_value'] = df['foot'].astype(str).str.lower().map(foot_map).fillna(0)
        else:
            df['foot_value'] = 0
        
        # Scoring outcomes
        custom_result = self.custom_scoring(df)
        if custom_result is not None:
            df = custom_result
        elif 'action' in df.columns:
            action_str = df['action'].astype(str).str.lower()
            df['scored'] = action_str.str.contains(r'point|goal|scores|over', regex=True, na=False).astype(int)
            df['is_goal'] = action_str.str.contains(r'goal', regex=True, na=False).astype(int)
        else:
            df['scored'] = df['is_goal'] = 0
        
        # Existing model values
        if 'xP' in df.columns:
            df['existing_xP'] = pd.to_numeric(df['xP'], errors='coerce').fillna(0)
        else:
            df['existing_xP'] = 0
        
        if 'xG' in df.columns:
            df['existing_xG'] = pd.to_numeric(df['xG'], errors='coerce').fillna(0)
        else:
            df['existing_xG'] = 0
        
        return df
    
    def prepare_data(self, df):
        """Prepare dataframe with all features."""
        df = self.base_features(df.copy())
        df = self.engineer_features(df)
        return df
    
    def fit(self, df, test_size=0.2):
        """Train model and return metrics."""
        df = self.prepare_data(df)
        
        self.feature_names = [f for f in self.get_feature_list() if f in df.columns]
        if not self.feature_names:
            raise ValueError(f"No valid features found. Requested: {self.get_feature_list()}")
        
        X = df[self.feature_names].fillna(0).values
        y = df[self.get_target_column()].values
        
        if len(set(y)) < 2:
            raise ValueError(f"Target '{self.get_target_column()}' has only one class.")
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y
        )
        
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        self.model = self.train(X_train_scaled, y_train)
        self.is_trained = True
        
        y_pred = self.model.predict(X_test_scaled)
        y_proba = self.model.predict_proba(X_test_scaled)[:, 1]
        
        # Calculate metrics
        brier = float(brier_score_loss(y_test, y_proba))
        avg_predicted = float(np.mean(y_proba))
        avg_actual = float(np.mean(y_test))
        
        self.metrics = {
            'brier_score': brier,
            'calibration_error': abs(avg_predicted - avg_actual),
            'log_loss': float(log_loss(y_test, y_proba)) if len(set(y_test)) > 1 else None,
            'auc_roc': float(roc_auc_score(y_test, y_proba)) if len(set(y_test)) > 1 else 0.5,
            'f1_score': float(f1_score(y_test, y_pred, zero_division=0)),
            'precision': float(precision_score(y_test, y_pred, zero_division=0)),
            'recall': float(recall_score(y_test, y_pred, zero_division=0)),
            'accuracy': float(accuracy_score(y_test, y_pred)),
            'avg_predicted_prob': avg_predicted,
            'avg_actual_outcome': avg_actual,
            'train_samples': len(X_train),
            'test_samples': len(X_test),
            'features_used': self.feature_names,
        }
        
        # Add custom metrics
        custom_metrics = self.custom_evaluation(y_test, y_pred, y_proba)
        if custom_metrics:
            self.metrics.update(custom_metrics)
        
        return self.metrics
    
    def predict(self, df):
        """Generate predictions for a dataframe."""
        if not self.is_trained:
            raise ValueError("Model not trained. Call fit() first.")
        df = self.prepare_data(df)
        X = df[self.feature_names].fillna(0).values
        X_scaled = self.scaler.transform(X)
        return self.model.predict_proba(X_scaled)[:, 1]
    
    def get_info(self):
        """Return model info for API."""
        return {
            'name': self.name,
            'description': self.description,
            'version': self.version,
            'features': self.get_feature_list(),
            'target': self.get_target_column(),
            'params': self.get_model_params(),
        }


# =============================================================================
# EXAMPLE MODEL - COPY THIS AS A TEMPLATE
# =============================================================================

class ExampleModel(BaseCustomModel):
    """
    ╔═══════════════════════════════════════════════════════════════════════╗
    ║  EXAMPLE MODEL - Copy this to create your own!                        ║
    ║                                                                        ║
    ║  This model uses Random Forest with basic features.                   ║
    ║  Copy this class, rename it, and customize the methods below.         ║
    ╚═══════════════════════════════════════════════════════════════════════╝
    """
    
    # Step 1: Give your model a name and description
    name = "Example Model"
    description = "A simple Random Forest model - use as a template!"
    version = "1.0"
    
    # Step 2: Choose your features
    def get_feature_list(self):
        """
        Choose which features your model uses.
        See the list at the top of this file for all available features.
        """
        return [
            'dist',           # Distance to goal (most important!)
            'angle_abs',      # Absolute angle to goal
            'pressure_value', # Defensive pressure (0-3)
            'is_setplay',     # Is it a set piece?
            'central_zone',   # Is shooter in central corridor?
        ]
    
    # Step 3: Choose your algorithm
    def train(self, X, y):
        """
        Train your model. X is the feature matrix, y is the target.
        
        Popular algorithms:
        - LogisticRegression(max_iter=1000) - Simple, fast
        - RandomForestClassifier(n_estimators=100) - Good balance
        - GradientBoostingClassifier(n_estimators=100) - Often best accuracy
        - MLPClassifier(hidden_layer_sizes=(64, 32)) - Neural network
        """
        model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        model.fit(X, y)
        return model
    
    # Step 4: (Optional) Choose what to predict
    def get_target_column(self):
        """
        What to predict:
        - 'scored' for xP (points + goals)
        - 'is_goal' for xG (goals only)
        """
        return 'scored'
    
    # Step 5: (Optional) Add custom features
    def engineer_features(self, df):
        """
        Add your own custom features here.
        These are calculated AFTER base features, so you can use them.
        """
        # Example: Interaction feature
        df['dist_x_angle'] = df['dist'] * df['angle_abs'] / 90
        
        # Example: Custom zone
        df['sweet_spot'] = ((df['dist'] > 15) & (df['dist'] < 30) & (df['angle_abs'] < 25)).astype(int)
        
        return df
    
    # Step 6: (Optional) Add custom evaluation metrics
    def custom_evaluation(self, y_true, y_pred, y_proba):
        """
        Add your own evaluation metrics.
        These will be shown alongside the standard metrics.
        
        Parameters:
            y_true: Actual outcomes (0 or 1)
            y_pred: Predicted classes (0 or 1)  
            y_proba: Predicted probabilities (0.0 to 1.0)
        """
        metrics = {}
        
        # Example: Expected vs Actual total
        metrics['expected_total'] = float(np.sum(y_proba))
        metrics['actual_total'] = float(np.sum(y_true))
        
        # Example: High confidence accuracy
        high_conf = y_proba > 0.7
        if np.sum(high_conf) > 0:
            metrics['high_conf_accuracy'] = float(np.mean(y_true[high_conf]))
        
        return metrics
    
    # Step 7: (Optional) Return model parameters for display
    def get_model_params(self):
        return {
            'algorithm': 'RandomForestClassifier',
            'n_estimators': 100,
            'max_depth': 10,
        }


# =============================================================================
# BUILT-IN MODELS
# =============================================================================

class DistanceBaseline(BaseCustomModel):
    """Simple baseline using only distance - compare your model against this!"""
    name = "Distance Baseline"
    description = "Baseline model using only distance (compare against this)"
    version = "1.0"
    
    def get_feature_list(self):
        return ['dist', 'dist_squared']
    
    def train(self, X, y):
        return LogisticRegression(max_iter=1000, random_state=42).fit(X, y)


class GradientBoostModel(BaseCustomModel):
    """Gradient Boosting - often the best accuracy."""
    name = "Gradient Boost"
    description = "Gradient Boosting Classifier - high accuracy"
    version = "1.0"
    
    def get_feature_list(self):
        return ['dist', 'dist_squared', 'angle_abs', 'pressure_value', 
                'close_range', 'mid_range', 'long_range', 'central_zone', 
                'is_setplay', 'position_value']
    
    def train(self, X, y):
        model = GradientBoostingClassifier(
            n_estimators=150, learning_rate=0.05, max_depth=4, random_state=42
        )
        model.fit(X, y)
        return model
    
    def get_model_params(self):
        return {'algorithm': 'GradientBoosting', 'n_estimators': 150, 'learning_rate': 0.05}


class RandomForestModel(BaseCustomModel):
    """Random Forest - good balance of speed and accuracy."""
    name = "Random Forest"
    description = "Random Forest Classifier - balanced performance"
    version = "1.0"
    
    def get_feature_list(self):
        return ['dist', 'angle_abs', 'pressure_value', 'is_setplay',
                'close_range', 'mid_range', 'central_zone', 'position_value']
    
    def train(self, X, y):
        model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
        model.fit(X, y)
        return model
    
    def get_model_params(self):
        return {'algorithm': 'RandomForest', 'n_estimators': 100, 'max_depth': 10}


# =============================================================================
# YOUR CUSTOM MODELS - ADD THEM HERE!
# =============================================================================
"""
Copy the ExampleModel class above, paste it here, and customize it.

Example:

class MyAwesomeModel(BaseCustomModel):
    name = "My Awesome Model"
    description = "My custom xP model"
    
    def get_feature_list(self):
        return ['dist', 'angle_abs', 'pressure_value', 'my_custom_feature']
    
    def engineer_features(self, df):
        df['my_custom_feature'] = df['dist'] * df['pressure_value']
        return df
    
    def train(self, X, y):
        model = GradientBoostingClassifier(n_estimators=200)
        model.fit(X, y)
        return model

Then add to AVAILABLE_MODELS below:
    'my_awesome': MyAwesomeModel,
"""


# =============================================================================
# AVAILABLE MODELS REGISTRY - ADD YOUR MODELS HERE
# =============================================================================

AVAILABLE_MODELS = {
    # Built-in models
    'example': ExampleModel,
    'distance_baseline': DistanceBaseline,
    'gradient_boost': GradientBoostModel,
    'random_forest': RandomForestModel,
    
    # === ADD YOUR CUSTOM MODELS HERE ===
    # 'my_awesome': MyAwesomeModel,
}


# =============================================================================
# HELPER FUNCTIONS (used by modelbuilder.py)
# =============================================================================

def get_available_models():
    """Return list of available models with their info."""
    models = []
    for key, model_class in AVAILABLE_MODELS.items():
        try:
            instance = model_class()
            models.append({
                'key': key,
                'name': instance.name,
                'description': instance.description,
                'version': instance.version,
                'features': instance.get_feature_list(),
                'target': instance.get_target_column(),
                'params': instance.get_model_params()
            })
        except Exception as e:
            logger.error(f"Error loading model {key}: {e}")
    return models


def get_model(model_key):
    """Get a model instance by key."""
    if model_key not in AVAILABLE_MODELS:
        raise ValueError(f"Unknown model: {model_key}. Available: {list(AVAILABLE_MODELS.keys())}")
    return AVAILABLE_MODELS[model_key]()


def run_custom_model(model_key, train_df, target_df=None, apply_to_target=True, target_field='xP'):
    """
    Run a custom model: train on train_df, optionally apply to target_df.
    """
    model = get_model(model_key)
    metrics = model.fit(train_df)
    
    result = {
        'model_key': model_key,
        'model_name': model.name,
        'metrics': metrics,
        'predictions': None
    }
    
    if apply_to_target:
        predict_df = target_df if target_df is not None else train_df
        predictions = model.predict(predict_df)
        result['predictions'] = predictions.tolist()
        result['prediction_count'] = len(predictions)
    
    return result


# =============================================================================
# TEST YOUR MODEL LOCALLY
# =============================================================================

if __name__ == '__main__':
    # Create test data
    test_data = pd.DataFrame({
        'x': [120, 100, 80, 130, 110, 90, 125, 85, 95, 115],
        'y': [44, 30, 60, 44, 50, 35, 40, 55, 48, 42],
        'action': ['Point', 'Wide', 'Goal', 'Short', 'Point', 'Wide', 'Goal', 'Point', 'Short', 'Point'],
        'pressure': ['low', 'high', 'medium', 'none', 'low', 'high', 'low', 'medium', 'high', 'none'],
        'position': ['forward', 'midfielder', 'forward', 'back', 'forward', 'midfielder', 'forward', 'back', 'midfielder', 'forward'],
    })
    
    print("Testing ExampleModel...")
    print("-" * 50)
    
    model = ExampleModel()
    metrics = model.fit(test_data)
    
    print(f"Model: {model.name}")
    print(f"Features: {model.feature_names}")
    print(f"\nMetrics:")
    print(f"  Brier Score: {metrics['brier_score']:.4f} (lower is better)")
    print(f"  AUC-ROC: {metrics['auc_roc']:.4f}")
    print(f"  Accuracy: {metrics['accuracy']:.4f}")
    
    predictions = model.predict(test_data)
    print(f"\nPredictions: {predictions[:5].round(3)}...")
    
    print("\n" + "=" * 50)
    print("Available models:")
    for key, model_class in AVAILABLE_MODELS.items():
        m = model_class()
        print(f"  {key}: {m.name}")