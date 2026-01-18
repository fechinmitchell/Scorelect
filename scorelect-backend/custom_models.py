"""
Custom Models Plugin System for Scorelect Model Lab
====================================================

HOW TO ADD YOUR OWN MODEL:
--------------------------
1. Create a new class that inherits from BaseCustomModel
2. Implement the required methods:
   - name: Display name for the UI
   - description: What your model does
   - engineer_features(df): Add any custom features to the dataframe
   - train(X, y): Train your model and return it
   - get_feature_list(): Return list of feature names to use

3. Add your class to the AVAILABLE_MODELS dict at the bottom

Example:
--------
class MyAwesomeModel(BaseCustomModel):
    name = "My Awesome Model"
    description = "A super accurate xP model"
    
    def engineer_features(self, df):
        df['my_feature'] = df['distance'] * df['angle']
        return df
    
    def get_feature_list(self):
        return ['distance', 'angle', 'my_feature']
    
    def train(self, X, y):
        from sklearn.ensemble import RandomForestClassifier
        model = RandomForestClassifier(n_estimators=100)
        model.fit(X, y)
        return model

Then add to AVAILABLE_MODELS:
    'my_awesome': MyAwesomeModel,
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score


# =============================================================================
# BASE CLASS - Don't modify this
# =============================================================================

class BaseCustomModel:
    """Base class for all custom models. Inherit from this to create your own."""
    
    name = "Base Model"
    description = "Base model class - override this"
    version = "1.0"
    
    # Standard GAA pitch constants
    GOAL_X = 145
    GOAL_Y = 44
    PITCH_WIDTH = 145
    PITCH_HEIGHT = 88
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.is_trained = False
        self.feature_names = []
        self.metrics = {}
    
    def base_features(self, df):
        """
        Generate standard features that most models will use.
        Override engineer_features() to add your own on top of these.
        """
        # Ensure numeric coordinates
        df['x'] = pd.to_numeric(df.get('x', 0), errors='coerce').fillna(0)
        df['y'] = pd.to_numeric(df.get('y', 0), errors='coerce').fillna(0)
        
        # Distance and angle
        df['dist'] = np.sqrt((self.GOAL_X - df['x'])**2 + (self.GOAL_Y - df['y'])**2)
        df['angle'] = np.degrees(np.arctan2(np.abs(df['y'] - self.GOAL_Y), self.GOAL_X - df['x']))
        df['angle_abs'] = df['angle'].abs()
        
        # Distance transformations
        df['dist_squared'] = df['dist'] ** 2
        df['dist_log'] = np.log1p(df['dist'])
        
        # Distance bands
        df['close_range'] = (df['dist'] < 20).astype(int)
        df['mid_range'] = ((df['dist'] >= 20) & (df['dist'] < 35)).astype(int)
        df['long_range'] = ((df['dist'] >= 35) & (df['dist'] < 50)).astype(int)
        df['beyond_40m'] = (df['dist'] >= 40).astype(int)
        df['beyond_50m'] = (df['dist'] >= 50).astype(int)
        
        # Zones
        df['central_zone'] = ((df['y'] > 30) & (df['y'] < 58)).astype(int)
        df['penalty_area'] = (df['x'] > 125).astype(int)
        df['danger_zone'] = ((df['x'] > 110) & (df['central_zone'] == 1)).astype(int)
        
        # Set piece detection
        if 'action' in df.columns:
            df['is_setplay'] = df['action'].astype(str).str.lower().str.contains(
                r'free|penalty|45|fortyfive|sideline|mark', regex=True, na=False
            ).astype(int)
        else:
            df['is_setplay'] = 0
        
        # Pressure encoding
        pressure_map = {'high': 3, 'medium': 2, 'low': 1, 'none': 0, 'y': 2, 'n': 0, '': 0}
        if 'pressure' in df.columns:
            df['pressure_value'] = df['pressure'].astype(str).str.lower().map(pressure_map).fillna(0)
        else:
            df['pressure_value'] = 0
        
        # Position encoding
        position_map = {'forward': 3, 'midfielder': 2, 'midfield': 2, 'back': 1, 'defender': 1, 'goalkeeper': 0}
        if 'position' in df.columns:
            df['position_value'] = df['position'].astype(str).str.lower().map(position_map).fillna(2)
        else:
            df['position_value'] = 2
        
        # Foot encoding
        foot_map = {'right': 0, 'left': 1, 'hand': 2}
        if 'foot' in df.columns:
            df['foot_value'] = df['foot'].astype(str).str.lower().map(foot_map).fillna(0)
        else:
            df['foot_value'] = 0
        
        # Outcome (for training)
        if 'action' in df.columns:
            df['scored'] = df['action'].astype(str).str.lower().str.contains(
                r'point|goal|scores|over', regex=True, na=False
            ).astype(int)
            df['is_goal'] = df['action'].astype(str).str.lower().str.contains(
                r'goal', regex=True, na=False
            ).astype(int)
        
        return df
    
    def engineer_features(self, df):
        """
        Override this method to add your own custom features.
        The base features are already added before this is called.
        """
        return df
    
    def get_feature_list(self):
        """
        Override this method to return the list of features your model uses.
        """
        return ['dist', 'angle_abs', 'pressure_value', 'is_setplay']
    
    def get_target_column(self):
        """
        Override this to change what the model predicts.
        Default is 'scored' (points or goals).
        Use 'is_goal' for xG models.
        """
        return 'scored'
    
    def train(self, X, y):
        """
        Override this method to implement your training logic.
        Must return a trained model with predict_proba() method.
        """
        model = LogisticRegression(max_iter=1000, random_state=42)
        model.fit(X, y)
        return model
    
    def get_model_params(self):
        """
        Override to return custom parameters for display/logging.
        """
        return {}
    
    # =========================================================================
    # Don't override these methods unless you know what you're doing
    # =========================================================================
    
    def prepare_data(self, df):
        """Prepare dataframe with all features."""
        df = self.base_features(df.copy())
        df = self.engineer_features(df)
        return df
    
    def fit(self, df, test_size=0.2):
        """Full training pipeline with evaluation."""
        # Prepare features
        df = self.prepare_data(df)
        
        # Get features and target
        self.feature_names = self.get_feature_list()
        available_features = [f for f in self.feature_names if f in df.columns]
        
        if not available_features:
            raise ValueError(f"No valid features found. Requested: {self.feature_names}")
        
        self.feature_names = available_features
        X = df[self.feature_names].fillna(0).values
        y = df[self.get_target_column()].values
        
        # Train/test split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y
        )
        
        # Scale
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train
        self.model = self.train(X_train_scaled, y_train)
        self.is_trained = True
        
        # Evaluate
        y_pred = self.model.predict(X_test_scaled)
        y_proba = self.model.predict_proba(X_test_scaled)[:, 1]
        
        self.metrics = {
            'accuracy': float(accuracy_score(y_test, y_pred)),
            'f1_score': float(f1_score(y_test, y_pred, zero_division=0)),
            'precision': float(precision_score(y_test, y_pred, zero_division=0)),
            'recall': float(recall_score(y_test, y_pred, zero_division=0)),
            'auc_roc': float(roc_auc_score(y_test, y_proba)) if len(set(y_test)) > 1 else 0.5,
            'train_samples': len(X_train),
            'test_samples': len(X_test),
            'features_used': self.feature_names
        }
        
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
            'is_trained': self.is_trained,
            'metrics': self.metrics
        }


# =============================================================================
# BUILT-IN MODELS - You can use these as examples
# =============================================================================

class CMCv3Model(BaseCustomModel):
    """
    CMC v3 - The model that achieved 87.5% accuracy.
    Uses Logistic Regression with balanced classes and comprehensive features.
    """
    
    name = "CMC v3"
    description = "Logistic Regression with 20 features, class balancing, and player quality"
    version = "3.0"
    
    def engineer_features(self, df):
        """Add CMC v3 specific features."""
        
        # Goal angle (angle subtended by goal posts)
        goal_width = 7.32
        df['goal_angle'] = np.degrees(np.abs(
            np.arctan2(self.GOAL_Y + goal_width/2 - df['y'], self.GOAL_X - df['x']) -
            np.arctan2(self.GOAL_Y - goal_width/2 - df['y'], self.GOAL_X - df['x'])
        ))
        
        # Preferred side calculation
        df['on_left_side'] = (df['y'] < self.GOAL_Y).astype(int)
        df['is_right_foot'] = (df.get('foot', '').astype(str).str.lower() == 'right').astype(int)
        df['is_left_foot'] = (df.get('foot', '').astype(str).str.lower() == 'left').astype(int)
        df['preferred_side'] = (
            ((df['on_left_side'] == 1) & (df['is_right_foot'] == 1)) |
            ((df['on_left_side'] == 0) & (df['is_left_foot'] == 1))
        ).astype(int)
        
        # Player quality with Bayesian smoothing
        if 'playerName' in df.columns and 'scored' in df.columns:
            overall_rate = df['scored'].mean()
            player_stats = df.groupby('playerName')['scored'].agg(['mean', 'count'])
            player_stats['quality'] = (
                (player_stats['mean'] * player_stats['count'] + overall_rate * 15) / 
                (player_stats['count'] + 15)
            )
            df['player_quality'] = df['playerName'].map(player_stats['quality']).fillna(overall_rate)
        else:
            df['player_quality'] = 0.5
        
        return df
    
    def get_feature_list(self):
        return [
            'dist', 'dist_squared', 'dist_log',
            'angle_abs', 'goal_angle',
            'close_range', 'mid_range', 'long_range', 'beyond_40m', 'beyond_50m',
            'central_zone', 'penalty_area', 'danger_zone',
            'preferred_side', 'pressure_value', 'position_value', 'foot_value',
            'is_setplay', 'player_quality'
        ]
    
    def train(self, X, y):
        model = LogisticRegression(
            C=0.5,
            max_iter=2000,
            class_weight='balanced',
            random_state=42
        )
        model.fit(X, y)
        return model
    
    def get_model_params(self):
        return {
            'algorithm': 'LogisticRegression',
            'C': 0.5,
            'class_weight': 'balanced',
            'max_iter': 2000
        }


class CMCv3GoalsModel(BaseCustomModel):
    """
    CMC v3 adapted for xG (expected goals) prediction.
    """
    
    name = "CMC v3 Goals (xG)"
    description = "CMC v3 model adapted for predicting goal probability"
    version = "3.0"
    
    def engineer_features(self, df):
        # Same as CMC v3
        goal_width = 7.32
        df['goal_angle'] = np.degrees(np.abs(
            np.arctan2(self.GOAL_Y + goal_width/2 - df['y'], self.GOAL_X - df['x']) -
            np.arctan2(self.GOAL_Y - goal_width/2 - df['y'], self.GOAL_X - df['x'])
        ))
        
        df['on_left_side'] = (df['y'] < self.GOAL_Y).astype(int)
        df['is_right_foot'] = (df.get('foot', '').astype(str).str.lower() == 'right').astype(int)
        df['is_left_foot'] = (df.get('foot', '').astype(str).str.lower() == 'left').astype(int)
        df['preferred_side'] = (
            ((df['on_left_side'] == 1) & (df['is_right_foot'] == 1)) |
            ((df['on_left_side'] == 0) & (df['is_left_foot'] == 1))
        ).astype(int)
        
        if 'playerName' in df.columns and 'is_goal' in df.columns:
            overall_rate = df['is_goal'].mean()
            player_stats = df.groupby('playerName')['is_goal'].agg(['mean', 'count'])
            player_stats['quality'] = (
                (player_stats['mean'] * player_stats['count'] + overall_rate * 20) / 
                (player_stats['count'] + 20)
            )
            df['player_goal_quality'] = df['playerName'].map(player_stats['quality']).fillna(overall_rate)
        else:
            df['player_goal_quality'] = 0.1
        
        return df
    
    def get_feature_list(self):
        return [
            'dist', 'dist_squared', 'dist_log',
            'angle_abs', 'goal_angle',
            'close_range', 'mid_range', 'long_range',
            'central_zone', 'penalty_area', 'danger_zone',
            'preferred_side', 'pressure_value', 'position_value',
            'is_setplay', 'player_goal_quality'
        ]
    
    def get_target_column(self):
        return 'is_goal'  # Predict goals instead of all scores
    
    def train(self, X, y):
        # Use higher class weight for goals since they're rarer
        model = LogisticRegression(
            C=0.3,
            max_iter=2000,
            class_weight={0: 1, 1: 5},  # Weight goals more heavily
            random_state=42
        )
        model.fit(X, y)
        return model


class RandomForestModel(BaseCustomModel):
    """
    Random Forest model with standard features.
    Good for capturing non-linear relationships.
    """
    
    name = "Random Forest"
    description = "Random Forest classifier with 100 trees"
    version = "1.0"
    
    def get_feature_list(self):
        return [
            'dist', 'dist_squared', 'angle_abs',
            'close_range', 'mid_range', 'long_range', 'beyond_40m',
            'central_zone', 'penalty_area', 'danger_zone',
            'pressure_value', 'position_value', 'foot_value',
            'is_setplay'
        ]
    
    def train(self, X, y):
        model = RandomForestClassifier(
            n_estimators=100,
            max_depth=8,
            min_samples_split=10,
            class_weight='balanced',
            random_state=42,
            n_jobs=-1
        )
        model.fit(X, y)
        return model
    
    def get_model_params(self):
        return {
            'algorithm': 'RandomForestClassifier',
            'n_estimators': 100,
            'max_depth': 8
        }


class GradientBoostModel(BaseCustomModel):
    """
    Gradient Boosting model - often best for tabular data.
    """
    
    name = "Gradient Boosting"
    description = "Gradient Boosting classifier with careful tuning"
    version = "1.0"
    
    def get_feature_list(self):
        return [
            'dist', 'dist_squared', 'dist_log', 'angle_abs',
            'close_range', 'mid_range', 'long_range', 'beyond_40m',
            'central_zone', 'penalty_area', 'danger_zone',
            'pressure_value', 'position_value', 'foot_value',
            'is_setplay'
        ]
    
    def train(self, X, y):
        model = GradientBoostingClassifier(
            n_estimators=150,
            learning_rate=0.05,
            max_depth=4,
            min_samples_split=10,
            subsample=0.8,
            random_state=42
        )
        model.fit(X, y)
        return model
    
    def get_model_params(self):
        return {
            'algorithm': 'GradientBoostingClassifier',
            'n_estimators': 150,
            'learning_rate': 0.05,
            'max_depth': 4
        }


class NeuralNetModel(BaseCustomModel):
    """
    Simple Neural Network (MLP) model.
    """
    
    name = "Neural Network"
    description = "Multi-layer Perceptron with 2 hidden layers"
    version = "1.0"
    
    def get_feature_list(self):
        return [
            'dist', 'dist_squared', 'dist_log', 'angle_abs',
            'close_range', 'mid_range', 'long_range', 'beyond_40m',
            'central_zone', 'penalty_area', 'danger_zone',
            'pressure_value', 'position_value', 'foot_value',
            'is_setplay'
        ]
    
    def train(self, X, y):
        model = MLPClassifier(
            hidden_layer_sizes=(64, 32),
            learning_rate_init=0.001,
            max_iter=500,
            early_stopping=True,
            random_state=42
        )
        model.fit(X, y)
        return model
    
    def get_model_params(self):
        return {
            'algorithm': 'MLPClassifier',
            'hidden_layers': (64, 32),
            'learning_rate': 0.001
        }


class DistanceOnlyModel(BaseCustomModel):
    """
    Simple baseline model using only distance.
    Useful for comparison.
    """
    
    name = "Distance Only (Baseline)"
    description = "Simple model using only distance - use as baseline comparison"
    version = "1.0"
    
    def get_feature_list(self):
        return ['dist', 'dist_squared']
    
    def train(self, X, y):
        model = LogisticRegression(max_iter=1000, random_state=42)
        model.fit(X, y)
        return model


# =============================================================================
# USER CUSTOM MODELS - Add your own models here!
# =============================================================================

class MyCustomModel(BaseCustomModel):
    """
    TEMPLATE: Copy this class and modify it to create your own model.
    
    Steps:
    1. Change the class name
    2. Update name and description
    3. Add custom features in engineer_features()
    4. Update get_feature_list() with your features
    5. Customize train() with your algorithm
    6. Add to AVAILABLE_MODELS dict below
    """
    
    name = "My Custom Model"
    description = "Description of what your model does"
    version = "1.0"
    
    def engineer_features(self, df):
        """Add your custom features here."""
        # Example: interaction feature
        df['dist_x_angle'] = df['dist'] * df['angle_abs']
        
        # Example: custom zone
        df['sweet_spot'] = (
            (df['dist'] > 20) & (df['dist'] < 35) & 
            (df['angle_abs'] < 30)
        ).astype(int)
        
        return df
    
    def get_feature_list(self):
        """List all features your model uses."""
        return [
            'dist', 'dist_squared', 'angle_abs',
            'dist_x_angle', 'sweet_spot',  # Your custom features
            'pressure_value', 'is_setplay'
        ]
    
    def train(self, X, y):
        """Train your model."""
        model = LogisticRegression(
            C=1.0,
            max_iter=1000,
            class_weight='balanced',
            random_state=42
        )
        model.fit(X, y)
        return model


# =============================================================================
# AVAILABLE MODELS REGISTRY
# =============================================================================
# Add your custom model classes here to make them available in the Model Lab

AVAILABLE_MODELS = {
    'cmc_v3': CMCv3Model,
    'cmc_v3_goals': CMCv3GoalsModel,
    'random_forest': RandomForestModel,
    'gradient_boost': GradientBoostModel,
    'neural_net': NeuralNetModel,
    'distance_baseline': DistanceOnlyModel,
    # Add your custom models here:
    # 'my_custom': MyCustomModel,
}


# =============================================================================
# HELPER FUNCTIONS - Used by modelbuilder.py
# =============================================================================

def get_available_models():
    """Return list of available models with their info."""
    models = []
    for key, model_class in AVAILABLE_MODELS.items():
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
    return models


def get_model(model_key):
    """Get a model instance by key."""
    if model_key not in AVAILABLE_MODELS:
        raise ValueError(f"Unknown model: {model_key}. Available: {list(AVAILABLE_MODELS.keys())}")
    return AVAILABLE_MODELS[model_key]()


def run_custom_model(model_key, train_df, target_df=None, apply_to_target=True, target_field='xP'):
    """
    Run a custom model: train on train_df, optionally apply to target_df.
    
    Args:
        model_key: Key from AVAILABLE_MODELS
        train_df: DataFrame to train on
        target_df: DataFrame to apply predictions to (optional, defaults to train_df)
        apply_to_target: Whether to generate predictions
        target_field: 'xP' or 'xG'
    
    Returns:
        dict with metrics and predictions
    """
    model = get_model(model_key)
    
    # Train
    metrics = model.fit(train_df)
    
    result = {
        'model_key': model_key,
        'model_name': model.name,
        'metrics': metrics,
        'predictions': None
    }
    
    # Apply to target
    if apply_to_target:
        predict_df = target_df if target_df is not None else train_df
        predictions = model.predict(predict_df)
        result['predictions'] = predictions.tolist()
        result['prediction_count'] = len(predictions)
    
    return result