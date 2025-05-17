from flask import jsonify, request
import firebase_admin
from firebase_admin import firestore
import numpy as np
import pandas as pd
import shap
import time
import traceback
import logging
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_predict, StratifiedKFold, train_test_split
from sklearn.metrics import (accuracy_score, precision_score, recall_score, f1_score, 
                            roc_auc_score, brier_score_loss, confusion_matrix, log_loss,
                            roc_curve, precision_recall_curve)
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.feature_selection import SelectFromModel
from sklearn.cluster import KMeans
from sklearn.utils import resample
from sklearn.base import clone
from sklearn.isotonic import IsotonicRegression

@app.route("/recalculate-xpoints", methods=["POST"])
def recalculate_xpoints():
    """
    Maximum-accuracy xPoints calculation with state-of-the-art sports analytics techniques.
    Enhanced with cross-validation, improved calibration, SHAP values, and feature selection.
    Provides robust error handling and optimal handling of edge cases.
    """
    # Start timing the function
    start_time = time.time()
    
    # Get request data
    data = request.get_json() or {}
    USER_ID = data.get("user_id", "w9ZkqaYVM3dKSqqjWHLDVyh5sVg2")
    DATASET_NAME = data.get("dataset_name", "GAA All Shots")
    
    # Define calibration constants
    GOAL_CALIBRATION_FACTOR = 0.95
    MIN_SAMPLES_FOR_MODELING = 100
    CV_FOLDS = 5
    
    try:
        logging.info(f"=== Enhanced xPoints calculation start | user={USER_ID} | dataset={DATASET_NAME}")
        
        # ------------------------------------------------- 1. Load shots
        games_ref = (
            db.collection("savedGames")
              .document(USER_ID)
              .collection("games")
              .where("datasetName", "==", DATASET_NAME)
        )
        originals, all_shots = [], []
        for g in games_ref.stream():
            gd = g.to_dict().get("gameData", [])
            if gd:
                originals.append({"ref": g.reference, "gameData": gd})
                all_shots.extend(gd)
        
        if not all_shots:
            return jsonify({"error": "No data found"}), 404
        
        logging.info(f"Loaded {len(originals)} games — {len(all_shots)} shots")
        
        # ------------------------------------------------- 2. Build DataFrame
        goal_out = {"goal", "scores goal", "made goal", "hit goal", "penalty goal"}
        point_out = {"point", "over", "scores point", "made point", "offensive mark", 
                    "fortyfive", "free", "point scored", "free scored"}
        miss_out = {"miss", "wide", "short", "blocked", "saved", "hit post", "hit crossbar"}
        
        # Define set play types for better categorization
        free_types = {"free", "free scored", "free kick"}
        fortyfive_types = {"fortyfive", "45", "45m", "45 meter"}
        penalty_types = {"penalty", "penalty goal"}
        offensive_mark_types = {"offensive mark", "mark"}
        
        rows, outcome_counts = [], {"goal": 0, "point": 0, "miss": 0}
        for gi, g in enumerate(originals):
            for si, s in enumerate(g["gameData"]):
                action_raw = (s.get("Outcome") or s.get("action") or "").lower().strip()
                
                # Categorize the shot
                if any(term in action_raw for term in goal_out):
                    cat = "goal"
                elif any(term in action_raw for term in point_out):
                    cat = "point"
                else:
                    cat = "miss"
                    
                outcome_counts[cat] += 1
                
                # Get coordinates with improved error handling
                try:
                    sx = float(s.get("x", 0))
                    sy = float(s.get("y", 0))
                    
                    # Validate coordinate range (pitch dimensions)
                    if not (0 <= sx <= 145 and 0 <= sy <= 88):
                        logging.warning(f"Invalid coordinates: ({sx}, {sy}), resetting to center")
                        sx, sy = 72.5, 44  # Reset to field center for invalid values
                except (ValueError, TypeError):
                    sx, sy = 72.5, 44  # Center of field as fallback
                
                # Calculate distance to goal
                dist_to_goal = ((145 - sx) ** 2 + (44 - sy) ** 2) ** 0.5
                
                # Get game context if available
                game_minute = s.get("minute", 0)
                score_diff = s.get("scoreDiff", 0)
                
                # Identify set play types more precisely
                set_play_type = "none"
                if any(term in action_raw for term in free_types):
                    set_play_type = "free"
                elif any(term in action_raw for term in fortyfive_types):
                    set_play_type = "fortyfive"
                elif any(term in action_raw for term in penalty_types):
                    set_play_type = "penalty"
                elif any(term in action_raw for term in offensive_mark_types):
                    set_play_type = "mark"
                
                # Basic row data
                row = {
                    "gi": gi,
                    "si": si,
                    "player": s.get("playerName", "Unknown"),
                    "team": s.get("team", "Unknown"),
                    "action": action_raw,
                    "cat": cat,
                    "x": sx,
                    "y": sy,
                    "foot": (s.get("foot") or "unknown").lower(),
                    "pressure": (s.get("pressure") or "none").lower(),
                    "dist": dist_to_goal,
                    "position": (s.get("position") or "unknown").lower(),
                    "set_play_type": set_play_type,
                    "game_minute": game_minute,
                    "score_diff": score_diff
                }
                rows.append(row)
        
        df = pd.DataFrame(rows)
        logging.info(f"DataFrame shape {df.shape}")
        
        # Check for minimum data requirements
        if len(df) < MIN_SAMPLES_FOR_MODELING:
            logging.warning(f"Not enough data for reliable modeling: {len(df)} shots")
            return jsonify({
                "status": "warning",
                "message": f"Not enough data for reliable xPoints modeling. Need at least {MIN_SAMPLES_FOR_MODELING} shots, found {len(df)}.",
                "recommendations": "Consider adding more shots or using a simpler model."
            }), 200
        
        # ------------------------------------------------- 3. Outlier Detection and Handling
        
        # Identify statistical outliers in distance
        q1_dist = df["dist"].quantile(0.25)
        q3_dist = df["dist"].quantile(0.75)
        iqr_dist = q3_dist - q1_dist
        
        # Check for and fix outliers
        distance_upper_bound = q3_dist + (1.5 * iqr_dist)
        extreme_distances = df["dist"] > distance_upper_bound
        if extreme_distances.any():
            logging.info(f"Found {extreme_distances.sum()} distance outliers, flagging them")
            df["is_distance_outlier"] = extreme_distances
        else:
            df["is_distance_outlier"] = False
        
        # ------------------------------------------------- 4. Target Variables
        # Custom scoring system for GAA
        df["point_value"] = np.where(df["dist"] > 40, 2, 1)  # 2 points for shots beyond 40m
        
        # Target variables
        df["Score_Points"] = np.where(
            (df["cat"] == "point") & (df["dist"] > 40), 2,
            np.where(df["cat"] == "point", 1, 0)
        )
        df["Score_Goals"] = (df["cat"] == "goal").astype(int)
        df["Score_Binary_Points"] = (df["cat"] == "point").astype(int)
        
        # ------------------------------------------------- 5. Enhanced Feature Engineering
        
        # Angle calculation (improved mathematical approach)
        df["Shot_Angle"] = np.degrees(np.arctan2(44 - df["y"], 145 - df["x"]))
        df["Shot_Angle_Abs"] = df["Shot_Angle"].abs()
        
        # Distance to sideline
        df["dist_to_sideline"] = np.minimum(df["y"], 88 - df["y"])
        
        # Advanced geometric features
        df["dist_squared"] = df["dist"] ** 2
        df["dist_log"] = np.log1p(df["dist"])
        df["angle_squared"] = df["Shot_Angle_Abs"] ** 2
        df["dist_to_sideline_squared"] = df["dist_to_sideline"] ** 2
        
        # Interaction features
        df["dist_angle_interaction"] = df["dist"] * df["Shot_Angle_Abs"] / 90
        
        # Central zone indicator (more precise definition)
        df["is_central_zone"] = ((df["Shot_Angle_Abs"] < 30) & (df["dist"] < 35)).astype(int)
        
        # Convert game_minute to numeric, coercing invalid values to NaN
        df["game_minute"] = pd.to_numeric(df["game_minute"], errors="coerce")
        # Handle NaN values by filling with median
        df["game_minute"] = df["game_minute"].fillna(df["game_minute"].median() if not df["game_minute"].isna().all() else 0)
        # Perform the comparison
        df["is_end_period"] = ((df["game_minute"] > 30) & (df["game_minute"] < 40)) | (df["game_minute"] > 65)       
        df["is_close_game"] = (df["score_diff"].abs() < 3).astype(int)
        df["is_trailing"] = (df["score_diff"] < 0).astype(int)
        df["is_leading"] = (df["score_diff"] > 0).astype(int)
        
        # Set play indicators - More detailed than before
        df["is_setplay"] = (df["set_play_type"] != "none").astype(int)
        df["is_free"] = (df["set_play_type"] == "free").astype(int)
        df["is_fortyfive"] = (df["set_play_type"] == "fortyfive").astype(int)
        df["is_penalty"] = (df["set_play_type"] == "penalty").astype(int)
        df["is_mark"] = (df["set_play_type"] == "mark").astype(int)
        
        # Pressure mapping with more granular levels
        pressure_map = {
            'none': 0, 'low': 0.33, 'medium': 0.67, 'high': 1.0, 
            'n': 0, 'y': 1, '': 0, 'no': 0, 'yes': 1
        }
        df["pressure_value"] = df["pressure"].map(pressure_map).fillna(0)
        
        # Apply reduced pressure for set plays (more nuanced model)
        df["effective_pressure"] = df["pressure_value"] * np.where(
            df["is_setplay"] == 1,
            np.where(df["is_penalty"] == 1, 0.1,  # Very little pressure on penalties
                    np.where(df["is_free"] == 1, 0.3,  # Some pressure on frees
                            0.5)),  # More pressure on other set plays
            1.0  # Full pressure for open play
        )
        
        # Position mapping
        position_map = {
            'goalkeeper': 0, 'goalie': 0, 'keeper': 0,
            'back': 1, 'defender': 1, 'defense': 1,
            'midfielder': 2, 'midfield': 2, 'mid': 2,
            'forward': 3, 'attacker': 3, 'striker': 3
        }
        df["position_value"] = df["position"].map(
            lambda p: position_map.get(p.lower().strip() if isinstance(p, str) else "unknown", 2)
        )
        
        # Foot preference
        df["is_right_foot"] = df["foot"].str.contains("right", case=False, na=False).astype(int)
        df["is_left_foot"] = df["foot"].str.contains("left", case=False, na=False).astype(int)
        
        # Side advantage
        df["is_left_side"] = (df["y"] < 44).astype(int)
        df["preferred_side_advantage"] = np.where(
            ((df["is_left_side"] == 1) & (df["is_left_foot"] == 1)) |
            ((df["is_left_side"] == 0) & (df["is_right_foot"] == 1)),
            1, 0
        )
        
        # Distance zones - with proper NaN handling and more granular zones
        df["distance_zone"] = pd.cut(
            df["dist"], 
            bins=[0, 10, 20, 30, 40, 50, 60, 100],
            labels=[0, 1, 2, 3, 4, 5, 6]
        ).astype('object').map(lambda x: int(x) if pd.notnull(x) else 0)
        
        # Angle zones - with proper NaN handling and more granular zones
        df["angle_zone"] = pd.cut(
            df["Shot_Angle_Abs"], 
            bins=[0, 10, 20, 30, 45, 60, 90],
            labels=[0, 1, 2, 3, 4, 5]
        ).astype('object').map(lambda x: int(x) if pd.notnull(x) else 0)
        
        # Edge case handling
        df["is_extreme_angle"] = (df["Shot_Angle_Abs"] > 60).astype(int)
        df["is_long_shot"] = (df["dist"] > 60).astype(int)
        df["is_very_close"] = (df["dist"] < 10).astype(int)
        df["is_beyond_40m"] = (df["dist"] > 40).astype(int)
        
        # Shot difficulty components
        df["technical_difficulty"] = df["dist"] * np.sin(np.radians(df["Shot_Angle_Abs"] + 5))
        df["shot_difficulty_score"] = (df["dist"] / 145) * (df["Shot_Angle_Abs"] / 90) * (1 + df["effective_pressure"])
        
        # Set play specific features
        df["set_play_distance"] = df["dist"] * df["is_setplay"]
        df["set_play_angle"] = df["Shot_Angle_Abs"] * df["is_setplay"]
        
        # Create setplay distance bins for more granular modeling
        df["setplay_distance_bin"] = pd.cut(
            df["set_play_distance"], 
            bins=[0, 20, 30, 40, 50, 60, 100],
            labels=[0, 1, 2, 3, 4, 5]
        ).astype('object').map(lambda x: int(x) if pd.notnull(x) else 0)
        
        # Create interaction between setplay type and distance
        df["free_short"] = ((df["is_free"] == 1) & (df["dist"] < 30)).astype(int)
        df["free_medium"] = ((df["is_free"] == 1) & (df["dist"] >= 30) & (df["dist"] < 45)).astype(int)
        df["free_long"] = ((df["is_free"] == 1) & (df["dist"] >= 45)).astype(int)
        
        # Interaction between pressure and distance
        df["pressure_dist"] = df["effective_pressure"] * df["dist"]
        
        # Interaction between leading/trailing and time left
        df["trailing_endgame"] = df["is_trailing"] * df["is_end_period"]
        df["leading_endgame"] = df["is_leading"] * df["is_end_period"]
        
        # Replace any NaNs from feature engineering
        df = df.fillna(0)
        
        # ------------------------------------------------- 6. Advanced Shot Clustering
        
        # Create features for clustering
        cluster_features = df[['dist', 'Shot_Angle_Abs', 'effective_pressure', 
                            'is_setplay', 'position_value', 'technical_difficulty']].values
        
        # Scale features
        cluster_scaler = StandardScaler()
        scaled_cluster_features = cluster_scaler.fit_transform(cluster_features)
        
        # Determine optimal number of clusters using silhouette analysis
        from sklearn.metrics import silhouette_score
        
        # Default number of clusters
        n_clusters = min(8, max(3, len(df) // 250))
        
        try:
            # Try to find optimal number of clusters
            if len(df) >= 200:  # Only if we have enough data
                silhouette_scores = []
                cluster_range = range(3, min(10, len(df) // 100))
                for n in cluster_range:
                    kmeans = KMeans(n_clusters=n, random_state=42, n_init=10)
                    cluster_labels = kmeans.fit_predict(scaled_cluster_features)
                    
                    # Silhouette score requires at least 2 clusters and samples per cluster
                    if len(np.unique(cluster_labels)) > 1:
                        silhouette_avg = silhouette_score(scaled_cluster_features, cluster_labels)
                        silhouette_scores.append(silhouette_avg)
                    else:
                        silhouette_scores.append(-1)  # Invalid score
                
                if silhouette_scores:
                    best_n_clusters = cluster_range[np.argmax(silhouette_scores)]
                    if best_n_clusters > 0:
                        n_clusters = best_n_clusters
            
            # Create clusters with optimal or default number
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            df['shot_cluster'] = kmeans.fit_predict(scaled_cluster_features)
            
            # Calculate detailed cluster statistics
            cluster_stats = df.groupby('shot_cluster').agg({
                'Score_Binary_Points': ['mean', 'count'],
                'Score_Goals': ['mean', 'count'],
                'dist': 'mean',
                'Shot_Angle_Abs': 'mean',
                'effective_pressure': 'mean',
                'is_setplay': 'mean'
            })
            
            # Flatten multi-level columns
            cluster_stats.columns = ['_'.join(col).strip() for col in cluster_stats.columns.values]
            cluster_stats = cluster_stats.reset_index()
            
            # Rename key columns for merging
            cluster_stats = cluster_stats.rename(columns={
                'Score_Binary_Points_mean': 'cluster_point_rate',
                'Score_Goals_mean': 'cluster_goal_rate',
                'dist_mean': 'cluster_avg_distance',
                'Shot_Angle_Abs_mean': 'cluster_avg_angle',
                'effective_pressure_mean': 'cluster_avg_pressure',
                'is_setplay_mean': 'cluster_setplay_pct',
                'Score_Binary_Points_count': 'cluster_point_count',
                'Score_Goals_count': 'cluster_goal_count'
            })
            
            # Merge cluster stats back
            df = df.merge(cluster_stats, on='shot_cluster', how='left')
            
            # Fill missing values
            for col in ['cluster_point_rate', 'cluster_goal_rate']:
                df[col] = df[col].fillna(df[col].mean())
                
        except Exception as cluster_error:
            logging.warning(f"Error in advanced clustering: {cluster_error}")
            # Create default columns
            df['cluster_point_rate'] = df['Score_Binary_Points'].mean()
            df['cluster_goal_rate'] = df['Score_Goals'].mean()
            df['cluster_avg_distance'] = df['dist'].mean()
            df['cluster_avg_angle'] = df['Shot_Angle_Abs'].mean()
            df['cluster_avg_pressure'] = df['effective_pressure'].mean()
            df['cluster_setplay_pct'] = df['is_setplay'].mean()
        
        # ------------------------------------------------- 7. Enhanced Player Performance Model
        
        # Calculate prior rates with confidence intervals
        points_prior = df["Score_Binary_Points"].mean()
        goals_prior = df["Score_Goals"].mean()
        
        # Calculate set play specific prior rates with improved handling of edge cases
        setplay_df = df[df["is_setplay"] == 1]
        if len(setplay_df) > 10:  # Ensure sufficient data
            setplay_points_prior = setplay_df["Score_Binary_Points"].mean()
            if pd.isna(setplay_points_prior):  # Handle case with no set plays
                setplay_points_prior = points_prior
        else:
            setplay_points_prior = points_prior
        
        # Function for Bayesian smoothing with confidence-based regularization
        def bayesian_smoothing(success_count, total_count, prior, k_factor, min_samples=5):
            """Apply Bayesian smoothing with dynamic regularization strength based on sample size."""
            if total_count < min_samples:
                return prior
            
            # Adjust k_factor inversely with sample size (more samples = less regularization)
            adjusted_k = k_factor * (1 - min(0.9, total_count / 100))
            return (success_count + prior * adjusted_k) / (total_count + adjusted_k)
        
        # Calculate success rates for different setplay distance bins with improved method
        setplay_distance_rates = {}
        for bin_val in range(6):  # 0-5 distance bins
            bin_data = df[(df["is_setplay"] == 1) & (df["setplay_distance_bin"] == bin_val)]
            if len(bin_data) > 5:  # Only calculate if we have enough samples
                successes = bin_data["Score_Binary_Points"].sum()
                total = len(bin_data)
                rate = bayesian_smoothing(successes, total, setplay_points_prior, 15)
                setplay_distance_rates[bin_val] = rate
            else:
                setplay_distance_rates[bin_val] = setplay_points_prior
        
        # Regularization strength - dynamic based on dataset size
        k_base = 15
        k_points = max(5, min(30, k_base * (1000 / max(100, len(df)))))
        k_goals = max(10, min(50, k_base * 2 * (1000 / max(100, len(df)))))
        
        # Enhanced player stats calculation
        if len(df["player"].unique()) > 3:
            # For point rates
            player_point_stats = df.groupby("player").agg({
                "player": "count",
                "Score_Binary_Points": ["sum", "mean"]
            })
            
            # Flatten multi-level columns
            player_point_stats.columns = ['_'.join(col).strip() for col in player_point_stats.columns.values]
            player_point_stats = player_point_stats.reset_index()
            
            # Rename for clarity
            player_point_stats = player_point_stats.rename(columns={
                'player_count': 'shots',
                'Score_Binary_Points_sum': 'point_successes',
                'Score_Binary_Points_mean': 'raw_point_rate'
            })
            
            # Apply Bayesian smoothing with dynamic regularization
            player_point_stats["smoothed_point_rate"] = player_point_stats.apply(
                lambda row: bayesian_smoothing(
                    row['point_successes'], row['shots'], 
                    points_prior, k_points, min_samples=3
                ), axis=1
            )
            
            # For goal rates
            player_goal_stats = df.groupby("player").agg({
                "player": "count",
                "Score_Goals": ["sum", "mean"]
            })
            
            # Flatten and rename columns
            player_goal_stats.columns = ['_'.join(col).strip() for col in player_goal_stats.columns.values]
            player_goal_stats = player_goal_stats.reset_index()
            player_goal_stats = player_goal_stats.rename(columns={
                'player_count': 'shots',
                'Score_Goals_sum': 'goal_successes',
                'Score_Goals_mean': 'raw_goal_rate'
            })
            
            # Apply Bayesian smoothing for goals (stronger regularization for rare events)
            player_goal_stats["smoothed_goal_rate"] = player_goal_stats.apply(
                lambda row: bayesian_smoothing(
                    row['goal_successes'], row['shots'], 
                    goals_prior, k_goals, min_samples=5
                ), axis=1
            )
            
            # Calculate set play specific rates per player
            if len(setplay_df) > 10:
                player_setplay_stats = setplay_df.groupby("player").agg({
                    "player": "count",
                    "Score_Binary_Points": ["sum", "mean"]
                })
                
                # Flatten and rename columns
                player_setplay_stats.columns = ['_'.join(col).strip() for col in player_setplay_stats.columns.values]
                player_setplay_stats = player_setplay_stats.reset_index()
                player_setplay_stats = player_setplay_stats.rename(columns={
                    'player_count': 'setplay_shots',
                    'Score_Binary_Points_sum': 'setplay_successes',
                    'Score_Binary_Points_mean': 'raw_setplay_rate'
                })
                
                # Apply Bayesian smoothing for set plays
                player_setplay_stats["smoothed_setplay_rate"] = player_setplay_stats.apply(
                    lambda row: bayesian_smoothing(
                        row['setplay_successes'], row['setplay_shots'], 
                        setplay_points_prior, 10, min_samples=3
                    ), axis=1
                )
                
                # Merge with other player stats
                player_point_stats = player_point_stats.merge(
                    player_setplay_stats[["player", "smoothed_setplay_rate"]],
                    on="player", how="left"
                )
                player_point_stats["smoothed_setplay_rate"] = player_point_stats["smoothed_setplay_rate"].fillna(setplay_points_prior)
            else:
                player_point_stats["smoothed_setplay_rate"] = setplay_points_prior
            
            # Calculate player streak and form features
            if "game_minute" in df.columns:
                # Sort data by player and game minute (proxy for chronological order)
                df_sorted = df.sort_values(["player", "game_minute"])
                
                # Calculate rolling success rates (last 5 shots form)
                df_sorted["rolling_point_success"] = df_sorted.groupby("player")["Score_Binary_Points"].transform(
                    lambda x: x.rolling(min_periods=1, window=5).mean().fillna(x.mean())
                )
                
                # Merge back to main dataframe
                player_form_stats = df_sorted.groupby("player")["rolling_point_success"].agg("mean").reset_index()
                player_form_stats = player_form_stats.rename(columns={"rolling_point_success": "recent_form"})
                
                # Merge with player stats
                player_point_stats = player_point_stats.merge(
                    player_form_stats, on="player", how="left"
                )
                player_point_stats["recent_form"] = player_point_stats["recent_form"].fillna(points_prior)
            else:
                player_point_stats["recent_form"] = points_prior
            
            # Merge back to main dataframe
            df = df.merge(
                player_point_stats[["player", "smoothed_point_rate", "smoothed_setplay_rate", "recent_form"]],
                on="player", how="left"
            )
            
            df = df.merge(
                player_goal_stats[["player", "smoothed_goal_rate"]],
                on="player", how="left"
            )
            
            # Fill missing values
            df["smoothed_point_rate"] = df["smoothed_point_rate"].fillna(points_prior)
            df["smoothed_goal_rate"] = df["smoothed_goal_rate"].fillna(goals_prior)
            df["smoothed_setplay_rate"] = df["smoothed_setplay_rate"].fillna(setplay_points_prior)
            df["recent_form"] = df["recent_form"].fillna(points_prior)
        else:
            # Use global rates if not enough player data
            df["smoothed_point_rate"] = points_prior
            df["smoothed_goal_rate"] = goals_prior
            df["smoothed_setplay_rate"] = setplay_points_prior
            df["recent_form"] = points_prior
        
        # ------------------------------------------------- 8. Feature Selection and Engineering
        
        # Core features
        core_features = [
            "dist", "Shot_Angle_Abs", "effective_pressure", "position_value",
            "is_setplay", "dist_to_sideline", "preferred_side_advantage", 
            "distance_zone", "angle_zone", "is_central_zone", "is_extreme_angle",
            "is_long_shot", "is_very_close", "is_beyond_40m", "shot_difficulty_score"
        ]
        
        # Game context features
        game_features = [
            "game_minute", "is_end_period", "score_diff", 
            "is_close_game", "is_trailing", "is_leading",
            "trailing_endgame", "leading_endgame"
        ]
        game_features = [f for f in game_features if f in df.columns]
        
        # Set play specific features
        setplay_features = [
            "set_play_distance", "set_play_angle", "setplay_distance_bin",
            "free_short", "free_medium", "free_long",
            "is_free", "is_fortyfive", "is_penalty", "is_mark"
        ]
        
        # Non-linear transformations
        nonlinear_features = [
            "dist_squared", "dist_log", "angle_squared", "dist_to_sideline_squared",
            "dist_angle_interaction", "technical_difficulty"
        ]
        
        # Interaction features
        interaction_features = [
            "pressure_dist", "trailing_endgame", "leading_endgame"
        ]
        
        # Player features
        player_features = [
            "smoothed_point_rate", "smoothed_goal_rate", "smoothed_setplay_rate", "recent_form"
        ]
        
        # Cluster features
        cluster_features = [
            "cluster_point_rate", "cluster_goal_rate", "cluster_avg_distance",
            "cluster_avg_angle", "cluster_avg_pressure", "cluster_setplay_pct"
        ]
        
        # Final feature selection
        all_point_features = (core_features + game_features + nonlinear_features + 
                          interaction_features + player_features + cluster_features + 
                          setplay_features)
        
        goal_features = (core_features + game_features + nonlinear_features + 
                      interaction_features + player_features + cluster_features)
        
        # Filter to existing columns
        point_features = [f for f in all_point_features if f in df.columns]
        goal_features = [f for f in goal_features if f in df.columns]
        
        # Feature importance-based selection for points model
        try:
            if len(df) >= 200:  # Only if we have enough data
                X_sample = df[point_features].values
                y_sample = df["Score_Binary_Points"].values
                
                # Handle NaN values
                X_sample = np.nan_to_num(X_sample)
                
                # Train a simple model to get feature importances
                feat_sel_model = GradientBoostingClassifier(
                    n_estimators=100, learning_rate=0.05, max_depth=3,
                    random_state=42
                )
                feat_sel_model.fit(X_sample, y_sample)
                
                # Create a selector based on feature importance
                selector = SelectFromModel(
                    feat_sel_model, threshold="median", prefit=True
                )
                
                # Get feature mask and selected feature names
                feature_mask = selector.get_support()
                selected_features = [point_features[i] for i in range(len(point_features)) 
                                    if feature_mask[i]]
                
                # Ensure we keep a minimum number of features
                if len(selected_features) >= 10:
                    point_features = selected_features
                    logging.info(f"Selected {len(point_features)} important features for points model")
        except Exception as feat_sel_error:
            logging.warning(f"Error in feature selection: {feat_sel_error}")
        
        # ------------------------------------------------- 9. Split Data by Shot Type
        
        # Split into open play and set play
        open_play_df = df[df["is_setplay"] == 0]
        set_play_df = df[df["is_setplay"] == 1]
        
        # Ensure point_features columns are numeric
        for feature in point_features:
            if feature not in open_play_df.columns or feature not in set_play_df.columns:
                logging.warning(f"Feature {feature} not found in DataFrame")
                continue
            # Log non-numeric columns
            if open_play_df[feature].dtype not in ['int64', 'float64']:
                logging.warning(f"Non-numeric column in open_play_df: {feature}, dtype: {open_play_df[feature].dtype}")
            if set_play_df[feature].dtype not in ['int64', 'float64']:
                logging.warning(f"Non-numeric column in set_play_df: {feature}, dtype: {set_play_df[feature].dtype}")
            open_play_df[feature] = pd.to_numeric(open_play_df[feature], errors="coerce")
            set_play_df[feature] = pd.to_numeric(set_play_df[feature], errors="coerce")
        
        # Fill NaN values with feature-specific defaults
        open_play_df[point_features] = open_play_df[point_features].fillna({
            'game_minute': open_play_df['game_minute'].median() if not open_play_df['game_minute'].isna().all() else 0,
            'dist': open_play_df['dist'].mean() if not open_play_df['dist'].isna().all() else 0,
            'Shot_Angle_Abs': open_play_df['Shot_Angle_Abs'].mean() if not open_play_df['Shot_Angle_Abs'].isna().all() else 0,
            'effective_pressure': open_play_df['effective_pressure'].mean() if not open_play_df['effective_pressure'].isna().all() else 0,
            'dist_to_sideline': open_play_df['dist_to_sideline'].mean() if not open_play_df['dist_to_sideline'].isna().all() else 0,
            'dist_squared': open_play_df['dist_squared'].mean() if not open_play_df['dist_squared'].isna().all() else 0,
            'dist_log': open_play_df['dist_log'].mean() if not open_play_df['dist_log'].isna().all() else 0,
            'angle_squared': open_play_df['angle_squared'].mean() if not open_play_df['angle_squared'].isna().all() else 0,
            'dist_to_sideline_squared': open_play_df['dist_to_sideline_squared'].mean() if not open_play_df['dist_to_sideline_squared'].isna().all() else 0,
            'dist_angle_interaction': open_play_df['dist_angle_interaction'].mean() if not open_play_df['dist_angle_interaction'].isna().all() else 0,
            'technical_difficulty': open_play_df['technical_difficulty'].mean() if not open_play_df['technical_difficulty'].isna().all() else 0,
            'shot_difficulty_score': open_play_df['shot_difficulty_score'].mean() if not open_play_df['shot_difficulty_score'].isna().all() else 0,
            'set_play_distance': open_play_df['set_play_distance'].mean() if not open_play_df['set_play_distance'].isna().all() else 0,
            'set_play_angle': open_play_df['set_play_angle'].mean() if not open_play_df['set_play_angle'].isna().all() else 0,
            'pressure_dist': open_play_df['pressure_dist'].mean() if not open_play_df['pressure_dist'].isna().all() else 0,
            'smoothed_point_rate': open_play_df['smoothed_point_rate'].mean() if not open_play_df['smoothed_point_rate'].isna().all() else points_prior,
            'smoothed_goal_rate': open_play_df['smoothed_goal_rate'].mean() if not open_play_df['smoothed_goal_rate'].isna().all() else goals_prior,
            'smoothed_setplay_rate': open_play_df['smoothed_setplay_rate'].mean() if not open_play_df['smoothed_setplay_rate'].isna().all() else setplay_points_prior,
            'recent_form': open_play_df['recent_form'].mean() if not open_play_df['recent_form'].isna().all() else points_prior,
            'cluster_point_rate': open_play_df['cluster_point_rate'].mean() if not open_play_df['cluster_point_rate'].isna().all() else df['Score_Binary_Points'].mean(),
            'cluster_goal_rate': open_play_df['cluster_goal_rate'].mean() if not open_play_df['cluster_goal_rate'].isna().all() else df['Score_Goals'].mean(),
            'cluster_avg_distance': open_play_df['cluster_avg_distance'].mean() if not open_play_df['cluster_avg_distance'].isna().all() else df['dist'].mean(),
            'cluster_avg_angle': open_play_df['cluster_avg_angle'].mean() if not open_play_df['cluster_avg_angle'].isna().all() else df['Shot_Angle_Abs'].mean(),
            'cluster_avg_pressure': open_play_df['cluster_avg_pressure'].mean() if not open_play_df['cluster_avg_pressure'].isna().all() else df['effective_pressure'].mean(),
            'cluster_setplay_pct': open_play_df['cluster_setplay_pct'].mean() if not open_play_df['cluster_setplay_pct'].isna().all() else df['is_setplay'].mean(),
            # Binary features
            'is_central_zone': 0,
            'is_beyond_40m': 0,
            'is_end_period': 0,
            'is_close_game': 0,
            'is_trailing': 0,
            'is_leading': 0,
            'is_free': 0,
            'is_fortyfive': 0,
            'is_penalty': 0,
            'is_mark': 0,
            'is_right_foot': 0,
            'is_left_foot': 0,
            'preferred_side_advantage': 0,
            'is_extreme_angle': 0,
            'is_long_shot': 0,
            'is_very_close': 0,
            'distance_zone': 0,
            'angle_zone': 0,
            'setplay_distance_bin': 0,
            'free_short': 0,
            'free_medium': 0,
            'free_long': 0,
            'trailing_endgame': 0,
            'leading_endgame': 0,
            'position_value': 2  # Default to midfielder
        }).fillna(0)  # Fallback for any remaining features
        set_play_df[point_features] = set_play_df[point_features].fillna({
            'game_minute': set_play_df['game_minute'].median() if not set_play_df['game_minute'].isna().all() else 0,
            'dist': set_play_df['dist'].mean() if not set_play_df['dist'].isna().all() else 0,
            'Shot_Angle_Abs': set_play_df['Shot_Angle_Abs'].mean() if not set_play_df['Shot_Angle_Abs'].isna().all() else 0,
            'effective_pressure': set_play_df['effective_pressure'].mean() if not set_play_df['effective_pressure'].isna().all() else 0,
            'dist_to_sideline': set_play_df['dist_to_sideline'].mean() if not set_play_df['dist_to_sideline'].isna().all() else 0,
            'dist_squared': set_play_df['dist_squared'].mean() if not set_play_df['dist_squared'].isna().all() else 0,
            'dist_log': set_play_df['dist_log'].mean() if not set_play_df['dist_log'].isna().all() else 0,
            'angle_squared': set_play_df['angle_squared'].mean() if not set_play_df['angle_squared'].isna().all() else 0,
            'dist_to_sideline_squared': set_play_df['dist_to_sideline_squared'].mean() if not set_play_df['dist_to_sideline_squared'].isna().all() else 0,
            'dist_angle_interaction': set_play_df['dist_angle_interaction'].mean() if not set_play_df['dist_angle_interaction'].isna().all() else 0,
            'technical_difficulty': set_play_df['technical_difficulty'].mean() if not set_play_df['technical_difficulty'].isna().all() else 0,
            'shot_difficulty_score': set_play_df['shot_difficulty_score'].mean() if not set_play_df['shot_difficulty_score'].isna().all() else 0,
            'set_play_distance': set_play_df['set_play_distance'].mean() if not set_play_df['set_play_distance'].isna().all() else 0,
            'set_play_angle': set_play_df['set_play_angle'].mean() if not set_play_df['set_play_angle'].isna().all() else 0,
            'pressure_dist': set_play_df['pressure_dist'].mean() if not set_play_df['pressure_dist'].isna().all() else 0,
            'smoothed_point_rate': set_play_df['smoothed_point_rate'].mean() if not set_play_df['smoothed_point_rate'].isna().all() else points_prior,
            'smoothed_goal_rate': set_play_df['smoothed_goal_rate'].mean() if not set_play_df['smoothed_goal_rate'].isna().all() else goals_prior,
            'smoothed_setplay_rate': set_play_df['smoothed_setplay_rate'].mean() if not set_play_df['smoothed_setplay_rate'].isna().all() else setplay_points_prior,
            'recent_form': set_play_df['recent_form'].mean() if not set_play_df['recent_form'].isna().all() else points_prior,
            'cluster_point_rate': set_play_df['cluster_point_rate'].mean() if not set_play_df['cluster_point_rate'].isna().all() else df['Score_Binary_Points'].mean(),
            'cluster_goal_rate': set_play_df['cluster_goal_rate'].mean() if not set_play_df['cluster_goal_rate'].isna().all() else df['Score_Goals'].mean(),
            'cluster_avg_distance': set_play_df['cluster_avg_distance'].mean() if not set_play_df['cluster_avg_distance'].isna().all() else df['dist'].mean(),
            'cluster_avg_angle': set_play_df['cluster_avg_angle'].mean() if not set_play_df['cluster_avg_angle'].isna().all() else df['Shot_Angle_Abs'].mean(),
            'cluster_avg_pressure': set_play_df['cluster_avg_pressure'].mean() if not set_play_df['cluster_avg_pressure'].isna().all() else df['effective_pressure'].mean(),
            'cluster_setplay_pct': set_play_df['cluster_setplay_pct'].mean() if not set_play_df['cluster_setplay_pct'].isna().all() else df['is_setplay'].mean(),
            # Binary features
            'is_central_zone': 0,
            'is_beyond_40m': 0,
            'is_end_period': 0,
            'is_close_game': 0,
            'is_trailing': 0,
            'is_leading': 0,
            'is_free': 0,
            'is_fortyfive': 0,
            'is_penalty': 0,
            'is_mark': 0,
            'is_right_foot': 0,
            'is_left_foot': 0,
            'preferred_side_advantage': 0,
            'is_extreme_angle': 0,
            'is_long_shot': 0,
            'is_very_close': 0,
            'distance_zone': 0,
            'angle_zone': 0,
            'setplay_distance_bin': 0,
            'free_short': 0,
            'free_medium': 0,
            'free_long': 0,
            'trailing_endgame': 0,
            'leading_endgame': 0,
            'position_value': 2  # Default to midfielder
        }).fillna(0)  # Fallback for any remaining features
        
        # Function to safely get data
        def safe_get_data(df, features, target):
            try:
                X = df[features].values
                y = df[target].values
                # Replace NaN values
                X = np.nan_to_num(X)
                y = np.nan_to_num(y)
                return X, y
            except Exception as e:
                logging.warning(f"Error getting data: {e}")
                return np.array([]), np.array([])
        
        # Get training data for open play points model
        X_points_open, y_points_open = safe_get_data(open_play_df, point_features, "Score_Binary_Points")
        
        # Get training data for set play points model
        X_points_set, y_points_set = safe_get_data(set_play_df, point_features, "Score_Binary_Points")
        
        # For goals, we use all data together since they're rarer
        X_goals, y_goals = safe_get_data(df, goal_features, "Score_Goals")
        
        # ------------------------------------------------- 10. Cross-Validation Setup
        
        # Function to create stratified folds with proper error handling
        def create_stratified_folds(X, y, n_splits=CV_FOLDS):
            if len(X) <= 20 or len(np.unique(y)) < 2:
                return None
            
            try:
                # Calculate minimum samples per fold
                n_splits = min(n_splits, len(X) // 10)  # Ensure at least 10 samples per fold
                n_splits = max(2, n_splits)  # At least 2 folds
                
                # Create stratified fold generator
                skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
                return list(skf.split(X, y))
            except Exception as e:
                logging.warning(f"Error creating stratified folds: {e}")
                return None
        
        # Create cross-validation folds for each model
        points_open_folds = create_stratified_folds(X_points_open, y_points_open)
        points_set_folds = create_stratified_folds(X_points_set, y_points_set)
        goals_folds = create_stratified_folds(X_goals, y_goals)
        
        # Function to safely scale features with improved error handling
        def safe_scale_features(X_train, X_test):
            if len(X_train) > 0:
                try:
                    # Check for near-constant features
                    variances = np.var(X_train, axis=0)
                    constant_features = variances < 1e-8
                    
                    if np.any(constant_features):
                        logging.warning(f"Found {np.sum(constant_features)} near-constant features")
                        # Add tiny noise to prevent scaling issues
                        for i in np.where(constant_features)[0]:
                            X_train[:, i] += np.random.normal(0, 1e-5, size=X_train.shape[0])
                    
                    # Robust scaling with clipping for outliers
                    scaler = StandardScaler().fit(X_train)
                    X_train_scaled = scaler.transform(X_train)
                    X_test_scaled = scaler.transform(X_test)
                    
                    # Clip extreme values after scaling
                    X_train_scaled = np.clip(X_train_scaled, -5, 5)
                    X_test_scaled = np.clip(X_test_scaled, -5, 5)
                    
                    # Check for and handle NaN/inf values
                    if np.isnan(X_train_scaled).any() or np.isinf(X_train_scaled).any():
                        logging.warning("NaN/inf values found after scaling train data, replacing with zeros")
                        X_train_scaled = np.nan_to_num(X_train_scaled)
                    
                    if np.isnan(X_test_scaled).any() or np.isinf(X_test_scaled).any():
                        logging.warning("NaN/inf values found after scaling test data, replacing with zeros")
                        X_test_scaled = np.nan_to_num(X_test_scaled)
                        
                    return scaler, X_train_scaled, X_test_scaled
                except Exception as e:
                    logging.warning(f"Scaling error: {e}")
                    # Fall back to unscaled data with NaN replacement
                    return StandardScaler(), np.nan_to_num(X_train), np.nan_to_num(X_test)
            
            # Return dummy scaler and data if empty
            return StandardScaler(), X_train, X_test
        
        # Split data with proper train/test split for final evaluation
        def safe_train_test_split(X, y, test_size=0.25, random_state=42):
            if len(X) > 20 and len(np.unique(y)) > 1:
                # Check for proper stratification possibility
                min_class_count = min(np.bincount(y.astype(int)))
                if min_class_count > 5:  # Ensure we have enough samples in each class
                    try:
                        return train_test_split(X, y, test_size=test_size, random_state=random_state, stratify=y)
                    except Exception as e:
                        logging.warning(f"Stratified split failed: {e}. Trying without stratification.")
                
                # Fall back to regular split if stratification fails
                return train_test_split(X, y, test_size=test_size, random_state=random_state)
            
            # If not enough data, return all data as both train and test
            return X, X, y, y
        
        # Split data for open play shots
        X_points_open_train, X_points_open_test, y_points_open_train, y_points_open_test = safe_train_test_split(
            X_points_open, y_points_open
        )
        
        # Split data for set play shots
        X_points_set_train, X_points_set_test, y_points_set_train, y_points_set_test = safe_train_test_split(
            X_points_set, y_points_set
        )
        
        # Split data for goals
        X_goals_train, X_goals_test, y_goals_train, y_goals_test = safe_train_test_split(
            X_goals, y_goals
        )
        
        # Scale features for each model
        points_open_scaler, X_points_open_train_scaled, X_points_open_test_scaled = safe_scale_features(
            X_points_open_train, X_points_open_test
        )
        
        points_set_scaler, X_points_set_train_scaled, X_points_set_test_scaled = safe_scale_features(
            X_points_set_train, X_points_set_test
        )
        
        goals_scaler, X_goals_train_scaled, X_goals_test_scaled = safe_scale_features(
            X_goals_train, X_goals_test
        )
        
        # ------------------------------------------------- 11. Class Imbalance Handling
        
        # Check for SMOTE availability
        has_smote = False
        try:
            from imblearn.over_sampling import SMOTE
            has_smote = True
        except ImportError:
            logging.warning("imblearn not installed - using alternative balancing techniques")
        
        # Function to safely apply SMOTE with enhanced error handling
        def safe_apply_smote(X, y, k_neighbors=5, random_state=42):
            if not has_smote or len(X) <= 10:
                # Use simple resampling if SMOTE is not available
                return balance_classes_with_resampling(X, y, random_state)
                
            # Count samples per class
            unique_classes, counts = np.unique(y, return_counts=True)
            min_samples = min(counts)
            
            # Only apply SMOTE if we have enough samples in minority class
            if len(unique_classes) > 1 and min_samples >= k_neighbors + 1:
                try:
                    # Use k_neighbors that's less than minority class count
                    safe_k = min(k_neighbors, min_samples - 1)
                    smote = SMOTE(random_state=random_state, k_neighbors=safe_k)
                    X_resampled, y_resampled = smote.fit_resample(X, y)
                    
                    # Verify dimensions are consistent
                    if len(X_resampled) != len(y_resampled):
                        logging.warning(f"SMOTE dimension mismatch: X={X_resampled.shape}, y={y_resampled.shape}")
                        return balance_classes_with_resampling(X, y, random_state)
                        
                    return X_resampled, y_resampled
                except Exception as e:
                    logging.warning(f"SMOTE error: {e}")
                    return balance_classes_with_resampling(X, y, random_state)
            
            return balance_classes_with_resampling(X, y, random_state)
        
        # Alternative to SMOTE using simple resampling techniques
        def balance_classes_with_resampling(X, y, random_state=42):
            """Balance classes using resampling for cases where SMOTE can't be applied."""
            unique_classes, counts = np.unique(y, return_counts=True)
            
            if len(unique_classes) <= 1 or len(X) < 10:
                return X, y
                
            # Identify majority and minority classes
            majority_class = unique_classes[np.argmax(counts)]
            minority_classes = [c for c in unique_classes if c != majority_class]
            
            # Get indices for each class
            majority_indices = np.where(y == majority_class)[0]
            all_resampled_indices = []
            
            # For each minority class
            for minority_class in minority_classes:
                minority_indices = np.where(y == minority_class)[0]
                
                # Number of samples to generate to match majority
                n_to_sample = min(len(majority_indices), max(len(minority_indices) * 2, 50))
                
                # Resample minority class with replacement
                resampled_minority_indices = np.random.RandomState(random_state).choice(
                    minority_indices, size=n_to_sample, replace=True
                )
                all_resampled_indices.extend(resampled_minority_indices)
            
            # Downsample majority class
            n_majority_to_keep = min(len(majority_indices), len(all_resampled_indices) * 1.5)
            resampled_majority_indices = np.random.RandomState(random_state).choice(
                majority_indices, size=int(n_majority_to_keep), replace=False
            )
            
            # Combine indices
            all_indices = np.concatenate([np.array(all_resampled_indices), resampled_majority_indices])
            
            return X[all_indices], y[all_indices]
        
        # Apply balancing techniques for each model
        X_points_open_train_resampled, y_points_open_train_resampled = safe_apply_smote(
            X_points_open_train_scaled, y_points_open_train, k_neighbors=5
        )
        
        X_points_set_train_resampled, y_points_set_train_resampled = safe_apply_smote(
            X_points_set_train_scaled, y_points_set_train, k_neighbors=5
        )
        
        # For goals, which are rarer, use smaller k_neighbors and stronger resampling
        X_goals_train_resampled, y_goals_train_resampled = safe_apply_smote(
            X_goals_train_scaled, y_goals_train, k_neighbors=3
        )
        
        # ------------------------------------------------- 12. Enhanced Model Training
        
        # Define function for finding optimal threshold with multiple optimization criteria
        def find_optimal_threshold(y_true, y_probs, default=0.5, lo=0.1, hi=0.9, metric="f1"):
            """Find threshold that optimizes a specific metric."""
            if len(y_true) < 10 or len(np.unique(y_true)) < 2:
                return default
                
            try:
                thresholds = np.linspace(lo, hi, 100)
                scores = []
                
                for threshold in thresholds:
                    y_pred = (y_probs >= threshold).astype(int)
                    
                    if metric == "f1":
                        score = f1_score(y_true, y_pred, zero_division=0)
                    elif metric == "precision_recall_balance":
                        precision = precision_score(y_true, y_pred, zero_division=0)
                        recall = recall_score(y_true, y_pred, zero_division=0)
                        score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
                    elif metric == "balanced_accuracy":
                        tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
                        specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
                        sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
                        score = (specificity + sensitivity) / 2
                    else:
                        score = f1_score(y_true, y_pred, zero_division=0)
                    
                    scores.append(score)
                
                best_idx = np.argmax(scores)
                return thresholds[best_idx]
            except Exception as e:
                logging.warning(f"Error finding optimal threshold: {e}")
                return default
        
        # Define function for getting ensemble predictions
        def get_ensemble_predictions(X, models, weights):
            """Get weighted ensemble predictions from multiple models with error handling."""
            try:
                if not models or len(models) == 0:
                    return np.ones(len(X)) * 0.5
                    
                all_preds = []
                
                for model in models:
                    if hasattr(model, 'predict_proba'):
                        preds = model.predict_proba(X)[:, 1]
                    else:
                        # Fallback for models without predict_proba
                        preds = model.predict(X).astype(float)
                    
                    # Handle NaN/inf values
                    preds = np.nan_to_num(preds, nan=0.5, posinf=1.0, neginf=0.0)
                    all_preds.append(preds)
                
                # Ensure weights match the number of models
                if len(weights) != len(all_preds):
                    equal_weight = 1.0 / len(all_preds)
                    weights = [equal_weight] * len(all_preds)
                
                # Apply weights
                weighted_preds = np.zeros(len(X))
                for i, preds in enumerate(all_preds):
                    weighted_preds += preds * weights[i]
                
                return np.clip(weighted_preds, 0, 1)  # Ensure probabilities are between 0 and 1
            except Exception as e:
                logging.warning(f"Error in ensemble prediction: {e}")
                return np.ones(len(X)) * 0.5
        
        # Define improved training function with cross-validation support
        def train_models_with_cv(X_train, y_train, X_test=None, y_test=None, cv_folds=None, class_weight=None):
            """Train models with cross-validation and calibration."""
            if len(X_train) < 10 or len(np.unique(y_train)) < 2:
                # Not enough samples or all same class → dummy models
                prob = np.mean(y_train) if len(y_train) else 0.5
                
                class DummyModel:
                    def __init__(self, p): 
                        self.p = p
                        self.feature_importances_ = np.zeros(X_train.shape[1] if len(X_train.shape) > 1 and X_train.shape[1] > 0 else 1)
                    
                    def predict_proba(self, X):
                        if hasattr(X, '__len__'):
                            return np.c_[1 - self.p, np.full(len(X), self.p)]
                        return np.array([[1 - self.p, self.p]])
                    
                    def predict(self, X):
                        if hasattr(X, '__len__'):
                            return np.full(len(X), int(self.p >= 0.5))
                        return np.array([int(self.p >= 0.5)])
                
                dummy = DummyModel(prob)
                return {
                    "scaler": StandardScaler(), 
                    "base_models": {
                        "logistic": dummy,
                        "gradient_boosting": dummy,
                        "random_forest": dummy
                    },
                    "calibrated_models": {
                        "logistic": dummy,
                        "gradient_boosting": dummy,
                        "random_forest": dummy
                    },
                    "ensemble_weights": [1/3, 1/3, 1/3],
                    "oof_predictions": np.full(len(X_train), prob) if len(X_train) > 0 else np.array([]),
                    "threshold": 0.5
                }
            
            # Ensure X and y are valid
            if len(X_train) != len(y_train):
                logging.error(f"Dimension mismatch in train_models: X={X_train.shape}, y={y_train.shape}")
                # Truncate to match lengths
                min_len = min(len(X_train), len(y_train))
                X_train = X_train[:min_len]
                y_train = y_train[:min_len]
            
            # Check for NaN values
            if np.isnan(X_train).any() or np.isinf(X_train).any():
                logging.warning("NaN/inf values found in training data, replacing with zeros")
                X_train = np.nan_to_num(X_train)
            
            # Check if test data is provided
            has_test_data = X_test is not None and y_test is not None and len(X_test) > 0 and len(y_test) > 0
            
            # Define model parameters
            use_cross_validation = cv_folds is not None and len(cv_folds) >= 2
            
            # Initialize models with optimized hyperparameters for GAA data
            lr = LogisticRegression(
                class_weight=class_weight or "balanced",
                C=0.8, max_iter=1000, random_state=42,
                solver='liblinear'  # Better for small datasets
            )
            
            gbc = GradientBoostingClassifier(
                n_estimators=150, learning_rate=0.05, max_depth=3,
                min_samples_split=20, subsample=0.8, random_state=42
            )
            
            rf = RandomForestClassifier(
                n_estimators=100, max_depth=4, min_samples_leaf=5,
                class_weight=class_weight or "balanced", random_state=42,
                bootstrap=True, max_features='sqrt'
            )
            
            # Storage for out-of-fold predictions for calibration
            oof_preds_lr = np.zeros(len(X_train))
            oof_preds_gbc = np.zeros(len(X_train))
            oof_preds_rf = np.zeros(len(X_train))
            
            # Train with cross-validation if folds are provided
            if use_cross_validation:
                for train_idx, val_idx in cv_folds:
                    # Split data for this fold
                    X_fold_train, X_fold_val = X_train[train_idx], X_train[val_idx]
                    y_fold_train, y_fold_val = y_train[train_idx], y_train[val_idx]
                    
                    # Train models on this fold
                    fold_lr = clone(lr).fit(X_fold_train, y_fold_train)
                    fold_gbc = clone(gbc).fit(X_fold_train, y_fold_train)
                    fold_rf = clone(rf).fit(X_fold_train, y_fold_train)
                    
                    # Get out-of-fold predictions
                    oof_preds_lr[val_idx] = fold_lr.predict_proba(X_fold_val)[:, 1]
                    oof_preds_gbc[val_idx] = fold_gbc.predict_proba(X_fold_val)[:, 1]
                    oof_preds_rf[val_idx] = fold_rf.predict_proba(X_fold_val)[:, 1]
            
            # Train final models on all data
            try:
                lr.fit(X_train, y_train)
                gbc.fit(X_train, y_train)
                rf.fit(X_train, y_train)
            except Exception as e:
                logging.error(f"Error fitting base models: {e}")
                # Return dummy model if fitting fails
                return train_models_with_cv(
                    np.zeros((len(y_train), 1)), y_train, 
                    np.zeros((1, 1)) if has_test_data else None,
                    np.array([0]) if has_test_data else None,
                    None, class_weight
                )
            
            # If we didn't use cross-validation, use the training predictions
            if not use_cross_validation:
                oof_preds_lr = lr.predict_proba(X_train)[:, 1]
                oof_preds_gbc = gbc.predict_proba(X_train)[:, 1]
                oof_preds_rf = rf.predict_proba(X_train)[:, 1]
            
            # Apply temperature scaling calibration
            try:
                # For logistic regression
                lr_calibrated = CalibratedClassifierCV(
                    base_estimator=lr, method="isotonic", cv="prefit"
                )
                lr_calibrated.fit(X_train, y_train)
                
                # For gradient boosting
                gbc_calibrated = CalibratedClassifierCV(
                    base_estimator=gbc, method="isotonic", cv="prefit"
                )
                gbc_calibrated.fit(X_train, y_train)
                
                # For random forest
                rf_calibrated = CalibratedClassifierCV(
                    base_estimator=rf, method="isotonic", cv="prefit"
                )
                rf_calibrated.fit(X_train, y_train)
            except Exception as e:
                logging.error(f"Error in calibration: {e}")
                # Use uncalibrated models if calibration fails
                lr_calibrated, gbc_calibrated, rf_calibrated = lr, gbc, rf
            
            # Calculate ensemble weights based on validation performance
            # Handle possible NaN values in predictions
            oof_preds_lr = np.nan_to_num(oof_preds_lr)
            oof_preds_gbc = np.nan_to_num(oof_preds_gbc)
            oof_preds_rf = np.nan_to_num(oof_preds_rf)
            
            # Calculate performance metrics for each model
            lr_brier = max(1e-10, brier_score_loss(y_train, oof_preds_lr))
            gbc_brier = max(1e-10, brier_score_loss(y_train, oof_preds_gbc))
            rf_brier = max(1e-10, brier_score_loss(y_train, oof_preds_rf))
            
            # Use test set for final weight calculation if available
            if has_test_data:
                # Get test predictions
                test_preds_lr = lr_calibrated.predict_proba(X_test)[:, 1]
                test_preds_gbc = gbc_calibrated.predict_proba(X_test)[:, 1]
                test_preds_rf = rf_calibrated.predict_proba(X_test)[:, 1]
                
                # Calculate test performance
                test_lr_brier = max(1e-10, brier_score_loss(y_test, test_preds_lr))
                test_gbc_brier = max(1e-10, brier_score_loss(y_test, test_preds_gbc))
                test_rf_brier = max(1e-10, brier_score_loss(y_test, test_preds_rf))
                
                # Blend train and test performance metrics (70% test, 30% train)
                lr_brier = 0.3 * lr_brier + 0.7 * test_lr_brier
                gbc_brier = 0.3 * gbc_brier + 0.7 * test_gbc_brier
                rf_brier = 0.3 * rf_brier + 0.7 * test_rf_brier
            
            # Calculate inverse weights (better score -> higher weight)
            inv_sum = (1/lr_brier) + (1/gbc_brier) + (1/rf_brier)
            
            # Check if inv_sum is valid
            if not np.isfinite(inv_sum) or inv_sum == 0:
                weights = [1/3, 1/3, 1/3]  # Equal weights if calculation fails
            else:
                weights = [
                    (1/lr_brier)/inv_sum,
                    (1/gbc_brier)/inv_sum,
                    (1/rf_brier)/inv_sum
                ]
                
                # Validate weights
                if not all(np.isfinite(w) for w in weights) or not np.isclose(sum(weights), 1.0):
                    weights = [1/3, 1/3, 1/3]  # Fall back to equal weights
            
            # Create ensemble prediction for optimal threshold
            ensemble_pred = (
                oof_preds_lr * weights[0] +
                oof_preds_gbc * weights[1] +
                oof_preds_rf * weights[2]
            )
            
            # Find optimal threshold
            optimal_threshold = find_optimal_threshold(
                y_train, ensemble_pred, 
                default=0.5, 
                metric="precision_recall_balance"
            )
            
            # Store models and parameters in a dictionary
            return {
                "scaler": StandardScaler(),  # Not used, scaling should be done outside
                "base_models": {
                    "logistic": lr,
                    "gradient_boosting": gbc,
                    "random_forest": rf
                },
                "calibrated_models": {
                    "logistic": lr_calibrated,
                    "gradient_boosting": gbc_calibrated,
                    "random_forest": rf_calibrated
                },
                "ensemble_weights": weights,
                "oof_predictions": ensemble_pred,
                "threshold": optimal_threshold
            }
        
        # SHAP value calculation helper
        def calculate_shap_values(model, X_sample, feature_names):
            """Calculate SHAP values for feature importance insights."""
            try:
                # Use a small sample for efficiency if data is large
                max_samples = min(1000, len(X_sample))
                if len(X_sample) > max_samples:
                    np.random.seed(42)
                    sample_indices = np.random.choice(len(X_sample), max_samples, replace=False)
                    X_sample = X_sample[sample_indices]
                
                # Choose appropriate explainer based on model type
                if isinstance(model, LogisticRegression):
                    explainer = shap.LinearExplainer(model, X_sample)
                elif isinstance(model, (GradientBoostingClassifier, RandomForestClassifier)):
                    explainer = shap.TreeExplainer(model)
                else:
                    return {}  # Unsupported model type
                
                # Calculate SHAP values
                shap_values = explainer.shap_values(X_sample)
                
                # For tree models, shap_values is a list where index 1 is the positive class
                if isinstance(shap_values, list) and len(shap_values) > 1:
                    shap_values = shap_values[1]
                
                # Calculate mean absolute SHAP values for each feature
                mean_shap = np.abs(shap_values).mean(axis=0)
                
                # Create a dictionary mapping feature names to importance
                shap_dict = dict(zip(feature_names, mean_shap))
                
                # Sort by importance
                return {k: float(v) for k, v in sorted(shap_dict.items(), key=lambda item: item[1], reverse=True)}
            except Exception as e:
                logging.warning(f"Error calculating SHAP values: {e}")
                return {}
        
        # Train open play points model with cross-validation
        open_play_model = train_models_with_cv(
            X_points_open_train_resampled, 
            y_points_open_train_resampled,
            X_points_open_test_scaled,
            y_points_open_test,
            points_open_folds
        )
        
        # Train set play points model with cross-validation
        set_play_model = train_models_with_cv(
            X_points_set_train_resampled, 
            y_points_set_train_resampled,
            X_points_set_test_scaled,
            y_points_set_test,
            points_set_folds
        )
        
        # Train goals model with cross-validation
        goals_model = train_models_with_cv(
            X_goals_train_resampled, 
            y_goals_train_resampled,
            X_goals_test_scaled,
            y_goals_test,
            goals_folds
        )
        
        # ------------------------------------------------- 13. Model Evaluation and Calibration
        
        # Get predictions for test sets
        calibrated_points_open_probs = get_ensemble_predictions(
            X_points_open_test_scaled,
            [
                open_play_model["calibrated_models"]["logistic"],
                open_play_model["calibrated_models"]["gradient_boosting"],
                open_play_model["calibrated_models"]["random_forest"]
            ],
            open_play_model["ensemble_weights"]
        )
        
        calibrated_points_set_probs = get_ensemble_predictions(
            X_points_set_test_scaled,
            [
                set_play_model["calibrated_models"]["logistic"],
                set_play_model["calibrated_models"]["gradient_boosting"],
                set_play_model["calibrated_models"]["random_forest"]
            ],
            set_play_model["ensemble_weights"]
        )
        
        calibrated_goals_probs = get_ensemble_predictions(
            X_goals_test_scaled,
            [
                goals_model["calibrated_models"]["logistic"],
                goals_model["calibrated_models"]["gradient_boosting"],
                goals_model["calibrated_models"]["random_forest"]
            ],
            goals_model["ensemble_weights"]
        )
        
        # Calculate adaptive calibration factors
        # For open play points model
        observed_points_open_rate = np.mean(y_points_open_test)
        predicted_points_open_rate = np.mean(calibrated_points_open_probs)
        
        # Calculate calibration metrics using isotonic regression
        if len(y_points_open_test) >= 20 and len(np.unique(y_points_open_test)) > 1:
            try:
                # Fit isotonic regression for fine-grained calibration
                iso_reg_open = IsotonicRegression(out_of_bounds='clip')
                iso_reg_open.fit(calibrated_points_open_probs, y_points_open_test)
                
                # Apply calibration
                iso_calibrated_open_probs = iso_reg_open.predict(calibrated_points_open_probs)
                
                # Check if calibration improved Brier score
                original_brier = brier_score_loss(y_points_open_test, calibrated_points_open_probs)
                calibrated_brier = brier_score_loss(y_points_open_test, iso_calibrated_open_probs)
                
                if calibrated_brier < original_brier:
                    calibrated_points_open_probs = iso_calibrated_open_probs
                    logging.info("Applied isotonic calibration to open play model")
            except Exception as e:
                logging.warning(f"Error in isotonic calibration for open play: {e}")
        
        if predicted_points_open_rate > 0:
            points_open_calibration = observed_points_open_rate / predicted_points_open_rate
        else:
            points_open_calibration = 1.0
            
        # Sanity check - cap calibration factor
        points_open_calibration = max(0.5, min(2.0, points_open_calibration))
        
        # For set play points model
        observed_points_set_rate = np.mean(y_points_set_test)
        predicted_points_set_rate = np.mean(calibrated_points_set_probs)
        
        # Apply isotonic calibration for set plays
        if len(y_points_set_test) >= 20 and len(np.unique(y_points_set_test)) > 1:
            try:
                # Fit isotonic regression for set plays
                iso_reg_set = IsotonicRegression(out_of_bounds='clip')
                iso_reg_set.fit(calibrated_points_set_probs, y_points_set_test)
                
                # Apply calibration
                iso_calibrated_set_probs = iso_reg_set.predict(calibrated_points_set_probs)
                
                # Check if calibration improved Brier score
                original_brier = brier_score_loss(y_points_set_test, calibrated_points_set_probs)
                calibrated_brier = brier_score_loss(y_points_set_test, iso_calibrated_set_probs)
                
                if calibrated_brier < original_brier:
                    calibrated_points_set_probs = iso_calibrated_set_probs
                    logging.info("Applied isotonic calibration to set play model")
            except Exception as e:
                logging.warning(f"Error in isotonic calibration for set play: {e}")
        
        if predicted_points_set_rate > 0:
            points_set_calibration = observed_points_set_rate / predicted_points_set_rate
        else:
            points_set_calibration = 1.0
            
        # Sanity check - cap calibration factor
        points_set_calibration = max(0.5, min(2.0, points_set_calibration))
        
        # For goals model
        observed_goals_rate = np.mean(y_goals_test)
        predicted_goals_rate = np.mean(calibrated_goals_probs)
        
        # Apply isotonic calibration for goals
        if len(y_goals_test) >= 20 and len(np.unique(y_goals_test)) > 1:
            try:
                # Fit isotonic regression for goals
                iso_reg_goals = IsotonicRegression(out_of_bounds='clip')
                iso_reg_goals.fit(calibrated_goals_probs, y_goals_test)
                
                # Apply calibration
                iso_calibrated_goals_probs = iso_reg_goals.predict(calibrated_goals_probs)
                
                # Check if calibration improved Brier score
                original_brier = brier_score_loss(y_goals_test, calibrated_goals_probs)
                calibrated_brier = brier_score_loss(y_goals_test, iso_calibrated_goals_probs)
                
                if calibrated_brier < original_brier:
                    calibrated_goals_probs = iso_calibrated_goals_probs
                    logging.info("Applied isotonic calibration to goals model")
            except Exception as e:
                logging.warning(f"Error in isotonic calibration for goals: {e}")
        
        if predicted_goals_rate > 0:
            # Use the constant defined earlier for goals calibration instead of calculated ratio
            # This provides more stability for rare events like goals
            goals_calibration = GOAL_CALIBRATION_FACTOR
            
            # Make small adjustment based on observed data if we have enough samples
            if len(y_goals_test) > 10 and np.sum(y_goals_test) >= 3:
                ratio_adjustment = observed_goals_rate / predicted_goals_rate
                # Blend constant with observed ratio (weighted more toward constant)
                goals_calibration = 0.7 * goals_calibration + 0.3 * ratio_adjustment
        else:
            goals_calibration = GOAL_CALIBRATION_FACTOR
            
        # Sanity check - cap calibration factor
        goals_calibration = max(0.3, min(1.2, goals_calibration))
        
        # Apply calibration factors
        calibrated_points_open_probs *= points_open_calibration
        calibrated_points_set_probs *= points_set_calibration
        calibrated_goals_probs *= goals_calibration
        
        # Clip probabilities to prevent extreme values
        calibrated_points_open_probs = np.clip(calibrated_points_open_probs, 0.01, 0.99)
        calibrated_points_set_probs = np.clip(calibrated_points_set_probs, 0.01, 0.99)
        calibrated_goals_probs = np.clip(calibrated_goals_probs, 0.01, 0.99)
        
        # Calculate performance metrics for each model
        def calculate_metrics(y_true, y_pred_proba, threshold=0.5):
            y_pred = (y_pred_proba >= threshold).astype(int)
            metrics = {
                "accuracy": float(accuracy_score(y_true, y_pred)),
                "precision": float(precision_score(y_true, y_pred, zero_division=0)),
                "recall": float(recall_score(y_true, y_pred, zero_division=0)),
                "f1": float(f1_score(y_true, y_pred, zero_division=0)),
                "roc_auc": float(roc_auc_score(y_true, y_pred_proba) if len(np.unique(y_true)) > 1 else 0.0),
                "brier_score": float(brier_score_loss(y_true, y_pred_proba))
            }
            return metrics
        
        # Evaluate models
        open_play_metrics = calculate_metrics(y_points_open_test, calibrated_points_open_probs, 
                                           open_play_model["threshold"])
        set_play_metrics = calculate_metrics(y_points_set_test, calibrated_points_set_probs, 
                                          set_play_model["threshold"])
        goals_metrics = calculate_metrics(y_goals_test, calibrated_goals_probs, 
                                       goals_model["threshold"])
        
        # Calculate SHAP values for feature importance
        open_play_shap = calculate_shap_values(
            open_play_model["calibrated_models"]["gradient_boosting"],
            X_points_open_test_scaled,
            point_features
        )
        
        set_play_shap = calculate_shap_values(
            set_play_model["calibrated_models"]["gradient_boosting"],
            X_points_set_test_scaled,
            point_features
        )
        
        goals_shap = calculate_shap_values(
            goals_model["calibrated_models"]["gradient_boosting"],
            X_goals_test_scaled,
            goal_features
        )
        
        # ------------------------------------------------- 14. Generate xPoints
        
        # Get predictions for full dataset
        # Scale full dataset
        X_points_full = df[point_features].values
        X_points_full_scaled = points_open_scaler.transform(X_points_full)
        
        X_goals_full = df[goal_features].values
        X_goals_full_scaled = goals_scaler.transform(X_goals_full)
        
        # Get predictions based on shot type
        df["xPoints"] = 0.0
        df["xGoals"] = 0.0
        
        # Open play predictions
        open_play_mask = df["is_setplay"] == 0
        if open_play_mask.any():
            open_play_probs = get_ensemble_predictions(
                X_points_full_scaled[open_play_mask],
                [
                    open_play_model["calibrated_models"]["logistic"],
                    open_play_model["calibrated_models"]["gradient_boosting"],
                    open_play_model["calibrated_models"]["random_forest"]
                ],
                open_play_model["ensemble_weights"]
            )
            open_play_probs *= points_open_calibration
            open_play_probs = np.clip(open_play_probs, 0.01, 0.99)
            df.loc[open_play_mask, "xPoints"] = open_play_probs
            
        # Set play predictions
        set_play_mask = df["is_setplay"] == 1
        if set_play_mask.any():
            set_play_probs = get_ensemble_predictions(
                X_points_full_scaled[set_play_mask],
                [
                    set_play_model["calibrated_models"]["logistic"],
                    set_play_model["calibrated_models"]["gradient_boosting"],
                    set_play_model["calibrated_models"]["random_forest"]
                ],
                set_play_model["ensemble_weights"]
            )
            set_play_probs *= points_set_calibration
            set_play_probs = np.clip(set_play_probs, 0.01, 0.99)
            df.loc[set_play_mask, "xPoints"] = set_play_probs
            
        # Goals predictions
        goals_probs = get_ensemble_predictions(
            X_goals_full_scaled,
            [
                goals_model["calibrated_models"]["logistic"],
                goals_model["calibrated_models"]["gradient_boosting"],
                goals_model["calibrated_models"]["random_forest"]
            ],
            goals_model["ensemble_weights"]
        )
        goals_probs *= goals_calibration
        goals_probs = np.clip(goals_probs, 0.01, 0.99)
        df["xGoals"] = goals_probs
        
        # Adjust xPoints for distance (2 points for shots > 40m)
        df["xPoints_Adjusted"] = df["xPoints"] * np.where(df["dist"] > 40, 2, 1)
        
        # Calculate xPoints contribution
        df["xPoints_Contribution"] = np.where(
            df["cat"] == "point",
            np.where(df["dist"] > 40, 2 - df["xPoints_Adjusted"], 1 - df["xPoints_Adjusted"]),
            -df["xPoints_Adjusted"]
        )
        
        df["xGoals_Contribution"] = np.where(
            df["cat"] == "goal",
            1 - df["xGoals"],
            -df["xGoals"]
        )
        
        # Round predictions for storage
        df["xPoints"] = df["xPoints"].round(4)
        df["xPoints_Adjusted"] = df["xPoints_Adjusted"].round(4)
        df["xGoals"] = df["xGoals"].round(4)
        df["xPoints_Contribution"] = df["xPoints_Contribution"].round(4)
        df["xGoals_Contribution"] = df["xGoals_Contribution"].round(4)
        
        # ------------------------------------------------- 15. Save Results
        
        # Prepare data for saving
        results = []
        for gi, g in enumerate(originals):
            game_data = g["gameData"]
            for si, shot in enumerate(game_data):
                shot_idx = df[(df["gi"] == gi) & (df["si"] == si)].index
                if not shot_idx.empty:
                    shot_data = {
                        "xPoints": float(df.loc[shot_idx, "xPoints"].iloc[0]),
                        "xPoints_Adjusted": float(df.loc[shot_idx, "xPoints_Adjusted"].iloc[0]),
                        "xGoals": float(df.loc[shot_idx, "xGoals"].iloc[0]),
                        "xPoints_Contribution": float(df.loc[shot_idx, "xPoints_Contribution"].iloc[0]),
                        "xGoals_Contribution": float(df.loc[shot_idx, "xGoals_Contribution"].iloc[0])
                    }
                    game_data[si].update(shot_data)
            
            # Update Firestore
            try:
                g["ref"].update({"gameData": game_data})
            except Exception as e:
                logging.error(f"Error updating game {gi}: {e}")
                continue
            
            results.append({
                "game_id": g["ref"].id,
                "shots_updated": len(game_data)
            })
        
        # Calculate total processing time
        processing_time = time.time() - start_time
        
        # Prepare response
        response = {
            "status": "success",
            "message": f"Processed {len(df)} shots across {len(originals)} games",
            "processing_time_seconds": round(processing_time, 2),
            "games_updated": len(results),
            "shots_processed": len(df),
            "open_play_metrics": open_play_metrics,
            "set_play_metrics": set_play_metrics,
            "goals_metrics": goals_metrics,
            "feature_importance": {
                "open_play": open_play_shap,
                "set_play": set_play_shap,
                "goals": goals_shap
            },
            "calibration_factors": {
                "open_play_points": float(points_open_calibration),
                "set_play_points": float(points_set_calibration),
                "goals": float(goals_calibration)
            },
            "data_summary": {
                "total_shots": len(df),
                "goals": int(outcome_counts["goal"]),
                "points": int(outcome_counts["point"]),
                "misses": int(outcome_counts["miss"]),
                "open_play_shots": len(open_play_df),
                "set_play_shots": len(set_play_df)
            }
        }
        
        logging.info(f"xPoints calculation completed in {processing_time:.2f} seconds")
        return jsonify(response), 200
        
    except Exception as e:
        error_message = f"Error in xPoints calculation: {str(e)}"
        logging.error(f"{error_message}\n{traceback.format_exc()}")
        return jsonify({
            "status": "error",
            "message": error_message,
            "traceback": traceback.format_exc()
        }), 500