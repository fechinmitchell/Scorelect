# Standard Libraries
import os  # For environment variables and OS interactions
import json  # For JSON operations
import uuid  # For generating unique IDs
import logging  # For logging events
from datetime import datetime  # For timestamp handling
import random  # For random operations
from collections import Counter  # For counting hashable objects
import warnings  # For managing warnings

# Third-Party Libraries
from flask import Flask, request, jsonify, make_response
from flask_cors import CORS, cross_origin  # CORS handling
from flask_talisman import Talisman  # Security enhancements
import firebase_admin  # Firebase Admin SDK
from firebase_admin import credentials, firestore  # Firebase credentials and Firestore
from dotenv import load_dotenv  # Loading environment variables
import openai  # OpenAI API
from openai import OpenAI, OpenAIError  # OpenAI classes and error handling
import numpy as np  # Numerical operations
import pandas as pd  # Data manipulation
from sklearn.linear_model import LogisticRegression  # Logistic Regression model
from sklearn.ensemble import RandomForestClassifier  # Random Forest Classifier
from sklearn.neighbors import KDTree  # K-Nearest Neighbors Tree
from sklearn.preprocessing import StandardScaler  # Feature scaling
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score  # Train/Test Split, Cross-Validation
from sklearn.metrics import accuracy_score, classification_report, roc_auc_score  # Model evaluation metrics
from sklearn.calibration import CalibratedClassifierCV
from imblearn.over_sampling import SMOTE  # SMOTE for handling class imbalance
from sklearn.calibration import calibration_curve



# Optional: Stripe (if used elsewhere in your application)
import stripe  # Stripe's Python library for payments and subscriptions

# Optional: Feature Selection (if implemented)
from sklearn.feature_selection import RFE  # Recursive Feature Elimination

# Load environment variables from the .env file into the application
load_dotenv()

# Set up logging configuration to output info-level logs
logging.basicConfig(level=logging.INFO)

# Initialize the Flask application
app = Flask(__name__, static_folder='static', static_url_path='')

# Enable CORS (Cross-Origin Resource Sharing) to allow requests from specified origins
CORS(app, resources={r"/*": {"origins": [
    "http://localhost:3000",  # Allow requests from this local development address
    "http://localhost:3001",  # Allow requests from this second local dev address
    "https://scorelect.vercel.app",  # Production site for Scorelect
    "https://scorelect.com",  # Custom domain for Scorelect
    "https://www.scorelect.com"  # Another variant of the custom domain
]}})

# Initialize Talisman for security, specifically setting up a Content Security Policy (CSP)
csp = {
    'default-src': [
        "'self'",  # Allow resources only from the same origin (self)
        'https://js.stripe.com',  # Allow Stripe's JS for payments
        'https://fonts.googleapis.com',  # Allow Google Fonts
        'https://fonts.gstatic.com',
        'blob:'                     # ← allow blob URIs globally
     ],
    'media-src': [
        "'self'",
        'blob:'                     # ← allow blobs in <video> & <audio>

  # Google Fonts API
    ],
    'style-src': [
        "'self'",  # Restrict style sheets to same origin
        'https://fonts.googleapis.com',  # Allow Google Fonts stylesheets
        "'unsafe-inline'"  # Allow inline styles (e.g., for dynamic styling)
    ],
    'style-src-elem': [
        "'self'",  # Restrict element styles (e.g., <style> tag) to same origin
        'https://fonts.googleapis.com',  # Allow Google Fonts stylesheets
        "'unsafe-inline'"  # Allow inline styles for elements
    ],
    'font-src': [
        "'self'",  # Restrict font sources to same origin
        'https://fonts.gstatic.com',  # Allow Google Fonts to load fonts
        'data:'  # Allow fonts loaded as data URIs
    ],
    'script-src': [
        "'self'",  # Restrict scripts to same origin
        'https://js.stripe.com'  # Allow Stripe's JS for payment flows
    ],
    'connect-src': [
        "'self'",  
        'https://api.stripe.com',  
        'https://www.googleapis.com',  
        'https://firestore.googleapis.com',  
        'https://securetoken.googleapis.com',  
        'https://firebase.googleapis.com',  
        'https://*.firebaseio.com',  
        'https://*.firebase.com',  
        'https://api.openai.com'  # Ensure OpenAI is included
    ]
}

# Apply the Talisman security middleware to the Flask app with the specified CSP
Talisman(app, content_security_policy=csp)

# Initialize Stripe with the API key loaded from the environment variable
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

# Set up Firebase configuration using environment variables
firebase_config = {
    "type": os.getenv("FIREBASE_TYPE"),
    "project_id": os.getenv("FIREBASE_PROJECT_ID"),
    "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID"),
    "private_key": os.getenv("FIREBASE_PRIVATE_KEY").replace('\\n', '\n'),  # Handle multiline private key
    "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
    "client_id": os.getenv("FIREBASE_CLIENT_ID"),
    "auth_uri": os.getenv("FIREBASE_AUTH_URI"),
    "token_uri": os.getenv("FIREBASE_TOKEN_URI"),
    "auth_provider_x509_cert_url": os.getenv("FIREBASE_AUTH_PROVIDER_CERT_URL"),
    "client_x509_cert_url": os.getenv("FIREBASE_CLIENT_CERT_URL"),
    "universe_domain": os.getenv("FIREBASE_UNIVERSE_DOMAIN")
}

# Initialize Firebase Admin SDK using the credentials loaded from environment variables
cred = credentials.Certificate(firebase_config)
firebase_admin.initialize_app(cred)

# Initialize Firestore database client
db = firestore.client()

# Initialize OpenAI client with the API key loaded from environment variables
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

def flattenShots(games):
    """Given a list of game objects, return an array of all shots.
       Each game is expected to have a key 'gameData' which is a list of shots.
    """
    return [shot for game in games for shot in game.get('gameData', [])]


# Define a Flask route for creating a Stripe checkout session
@app.route('/create-checkout-session', methods=['POST'])
def create_checkout_session():
    try:
        data = request.json  # Get JSON data from the request
        email = data.get('email')  # Extract the email from the data
        uid = data.get('uid')  # Extract the user ID from the data
        coupon = data.get('coupon')  # Get coupon code if it exists

        # Validate if email and UID are provided
        if not email or not uid:
            logging.error("Email or UID not provided.")  # Log the error
            return jsonify({'error': 'Email and UID are required.'}), 400  # Respond with error

        # Create success and cancel URLs for Stripe checkout flow
        success_url = f'https://scorelect.com/profile?session_id={{CHECKOUT_SESSION_ID}}&uid={uid}'
        cancel_url = 'https://scorelect.com/cancel'

        # Build the session data for Stripe Checkout
        session_data = {
            'payment_method_types': ['card'],  # Specify payment method as card
            'customer_email': email,  # Use the customer's email for billing
            'line_items': [{
                'price': 'price_1PSb9kRsFqpmi3sgRjiYWmAp',  # Replace with your actual Stripe price ID
                'quantity': 1,
            }],
            'mode': 'subscription',  # Set mode as subscription for recurring payments
            'success_url': success_url,  # URL to redirect on successful payment
            'cancel_url': cancel_url,  # URL to redirect on cancellation
        }

        # If a coupon is provided, include it in the session
        if coupon:
            session_data['discounts'] = [{'coupon': coupon}]

        # Create the Stripe checkout session with the provided data
        session = stripe.checkout.Session.create(**session_data)

        logging.info(f"Created checkout session for UID: {uid}")  # Log the creation of the session
        return jsonify({'url': session.url})  # Return the checkout URL to the frontend
    except Exception as e:
        logging.error(f"Error creating checkout session: {str(e)}")  # Log any errors
        return jsonify(error=str(e)), 400  # Respond with error in JSON


# Define a route to renew a user's subscription using Stripe
@app.route('/renew-subscription', methods=['POST'])
def renew_subscription():
    try:
        data = request.json  # Get the JSON data from the request
        uid = data.get('uid')  # Extract the user ID

        # Validate that UID is provided
        if not uid:
            logging.error("UID not provided for renewal.")  # Log the error
            return jsonify({'error': 'UID is required.'}), 400  # Respond with error

        # Fetch the user's document from Firestore
        user_doc = db.collection('users').document(uid).get()
        if not user_doc.exists():  # Check if the user exists
            logging.error(f"User not found for UID: {uid}")  # Log the error
            return jsonify({'error': 'User not found'}), 404  # Respond with error

        user_data = user_doc.to_dict()  # Convert the Firestore document to a dictionary
        customer_email = user_data.get('email')  # Get the user's email from the Firestore data

        if not customer_email:  # Check if the user's email exists
            logging.error(f"Email not found for UID: {uid}")  # Log the error
            return jsonify({'error': 'User email not found'}), 400  # Respond with error

        logging.info(f"Creating renewal session for user {uid}")  # Log the renewal process

        # Create success and cancel URLs for the Stripe renewal process
        success_url = f'https://scorelect.com/profile?session_id={{CHECKOUT_SESSION_ID}}&uid={uid}'
        cancel_url = 'https://scorelect.com/profile'

        # Create a new checkout session for renewing the subscription
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            mode='subscription',
            customer_email=customer_email,
            line_items=[{
                'price': 'price_1PSb9kRsFqpmi3sgRjiYWmAp',  # Replace with your actual Stripe price ID
                'quantity': 1,
            }],
            success_url=success_url,
            cancel_url=cancel_url,
        )

        logging.info(f"Created renewal checkout session for user {uid}")  # Log the creation of the session
        return jsonify({'checkoutUrl': session.url})  # Return the checkout URL to the frontend
    except Exception as e:
        logging.error(f"Error renewing subscription: {str(e)}")  # Log any errors
        return jsonify(error=str(e)), 400  # Respond with error in JSON


# Define a route to cancel a user's subscription using Stripe
@app.route('/cancel-subscription', methods=['POST'])
def cancel_subscription():
    try:
        data = request.json  # Get the JSON data from the request
        subscription_id = data.get('subscriptionId')  # Extract the subscription ID
        uid = data.get('uid')  # Extract the user ID

        # Validate that subscription ID and UID are provided
        if not subscription_id or not uid:
            logging.error("Subscription ID or UID not provided for cancellation.")  # Log the error
            return jsonify({'error': 'Subscription ID and UID are required.'}), 400  # Respond with error

        # Set the subscription to cancel at the end of the current billing period
        subscription = stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=True
        )

        logging.info(f"Set subscription {subscription_id} to cancel at period end for user {uid}")  # Log cancellation
        return jsonify({"success": True, "subscription": subscription})  # Respond with success
    except Exception as e:
        logging.error(f"Error canceling subscription: {str(e)}")  # Log any errors
        return jsonify(error=str(e)), 400  # Respond with error in JSON

# Endpoint to get subscription details from Stripe and update Firestore
@app.route('/get-subscription', methods=['POST'])
def get_subscription():
    try:
        data = request.json  # Get the JSON data from the request
        subscription_id = data.get('subscriptionId')  # Extract the subscription ID from the request

        # Validate if subscription ID is provided
        if not subscription_id:
            logging.error("Subscription ID not provided.")  # Log the error
            return jsonify({'error': 'Subscription ID is required.'}), 400  # Respond with error

        # Retrieve subscription details from Stripe using subscription_id
        subscription = stripe.Subscription.retrieve(subscription_id)

        # Optionally update Firestore with the subscription details
        uid = data.get('uid')  # Extract the user ID
        if uid:
            user_ref = db.collection('users').document(uid)  # Reference to the user's Firestore document
            # Update user's subscriptionId and set role to 'paid'
            user_ref.set({'subscriptionId': subscription_id, 'role': 'paid'}, merge=True)
            logging.info(f"Updated user {uid} with subscription ID and set role to paid.")
        else:
            logging.warning("UID not provided, skipping Firestore update.")  # Log warning if no UID

        return jsonify(subscription)  # Return the subscription details in JSON
    except Exception as e:
        logging.error(f"Error retrieving subscription: {str(e)}")  # Log any errors
        return jsonify(error=str(e)), 400  # Respond with error in JSON


# Endpoint to retrieve session details from Stripe
@app.route('/retrieve-session', methods=['POST'])
def retrieve_session():
    try:
        data = request.json  # Get the JSON data from the request
        session_id = data.get('session_id')  # Extract the session ID from the request

        # Validate if session ID is provided
        if not session_id:
            logging.error("Session ID not provided.")  # Log the error
            return jsonify({'error': 'Session ID is required.'}), 400  # Respond with error

        # Retrieve session details from Stripe using session_id
        session = stripe.checkout.Session.retrieve(session_id)

        return jsonify(session)  # Return the session details in JSON
    except Exception as e:
        logging.error(f"Error retrieving session: {str(e)}")  # Log any errors
        return jsonify(error=str(e)), 400  # Respond with error in JSON


# Endpoint to save a game to Firestore with dataset association
@app.route('/save-game', methods=['POST'])
def save_game():
    try:
        data = request.json  # Get the JSON data from the request
        user_id = data.get('uid')  # Extract the user ID
        game_name = data.get('gameName')  # Extract the game name
        game_data = data.get('gameData')  # Extract the game data
        dataset_name = data.get('datasetName')  # Extract the dataset name
        match_date = data.get('matchDate')  # Extract match date
        sport = data.get('sport')  # Extract sport

        # Validate if required fields are provided
        if not user_id or not game_name or not game_data or not match_date or not sport:
            logging.error("Incomplete game data provided.")
            return jsonify({'error': 'UID, gameName, gameData, matchDate, and sport are required.'}), 400

        # Validate dataset_name (optional)
        if not dataset_name:
            dataset_name = 'Default'  # Assign to 'Default' if not provided

        # Normalize dataset name
        dataset_name_normalized = dataset_name.strip().lower()

        # Save the game data in Firestore under the user's document
        game_doc_ref = db.collection('savedGames').document(user_id).collection('games').document(game_name)
        game_doc_ref.set({
            'gameData': game_data,
            'datasetName': dataset_name,  # Store the dataset name
            'datasetName_normalized': dataset_name_normalized,  # Store normalized dataset name
            'matchDate': match_date,      # Store match date
            'sport': sport                # Store sport
        }, merge=True)  # Merge to avoid overwriting existing data

        logging.info(f"Game '{game_name}' saved for user {user_id} under dataset '{dataset_name}' with matchDate '{match_date}' and sport '{sport}'.")
        return jsonify({"success": True}), 201  # Respond with success and Created status
    except Exception as e:
        logging.error(f"Error saving game: {str(e)}")
        return jsonify(error=str(e)), 400

import json
import time
from functools import lru_cache

# Simple in-memory cache
games_cache = {}
CACHE_TTL = 300  # 5 minutes

@app.route('/load-games', methods=['POST'])
def load_games():
    try:
        data = request.json
        user_id = data.get('uid')
        include_game_data = data.get('includeGameData', False)
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        # Check cache first
        cache_key = f"{user_id}:{include_game_data}"
        if cache_key in games_cache:
            cached_data, timestamp = games_cache[cache_key]
            if time.time() - timestamp < CACHE_TTL:
                logging.info(f"Returning cached games for user {user_id}")
                return jsonify(cached_data), 200
        
        logging.info(f"Loading games for user {user_id}, includeGameData: {include_game_data}")
        
        saved_games_ref = db.collection('savedGames').document(user_id).collection('games')
        
        saved_games = []
        
        # OPTIMIZATION: Stream documents one by one instead of loading all into memory
        for doc in saved_games_ref.limit(100).stream():
            try:
                # Only convert to dict once
                game_data = doc.to_dict()
                if not game_data:
                    continue
                
                # Build lightweight game object efficiently
                lightweight_game = {
                    'gameId': doc.id,
                    'gameName': doc.id,
                    'sport': game_data.get('sport', 'Unknown'),
                    'matchDate': game_data.get('matchDate') or game_data.get('date'),
                    'datasetName': game_data.get('datasetName', 'Uncategorized'),
                    'analysisType': game_data.get('analysisType', 'pitch'),
                }
                
                # Only check fields that are likely to exist
                if 'createdAt' in game_data:
                    lightweight_game['createdAt'] = game_data['createdAt']
                if 'updatedAt' in game_data:
                    lightweight_game['updatedAt'] = game_data['updatedAt']
                if 'youtubeUrl' in game_data:
                    lightweight_game['youtubeUrl'] = game_data['youtubeUrl']
                if 'teamsData' in game_data:
                    lightweight_game['teamsData'] = game_data['teamsData']
                
                # Fast counting without processing the data
                if 'gameData' in game_data:
                    game_data_field = game_data['gameData']
                    lightweight_game['gameDataCount'] = len(game_data_field) if isinstance(game_data_field, (list, dict)) else 0
                elif 'coordinates' in game_data:
                    coords_field = game_data['coordinates']
                    lightweight_game['gameDataCount'] = len(coords_field) if isinstance(coords_field, list) else 0
                else:
                    lightweight_game['gameDataCount'] = 0
                
                # Only include full data if specifically requested
                if include_game_data:
                    if 'gameData' in game_data:
                        lightweight_game['gameData'] = game_data['gameData']
                    elif 'coordinates' in game_data:
                        lightweight_game['gameData'] = game_data['coordinates']
                
                saved_games.append(lightweight_game)
                
            except Exception as e:
                logging.error(f"Error processing game document {doc.id}: {str(e)}")
                continue
        
        # Empty published datasets for now
        published_datasets = []
        
        # Sort only if we have createdAt field
        if saved_games and 'createdAt' in saved_games[0]:
            saved_games.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        
        response_data = {
            'savedGames': saved_games,
            'publishedDatasets': published_datasets
        }
        
        # Cache the response
        games_cache[cache_key] = (response_data, time.time())
        
        logging.info(f"Loaded {len(saved_games)} games for user {user_id}")
        
        return jsonify(response_data), 200
        
    except Exception as e:
        logging.error(f"Error loading games: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/load-game-by-id', methods=['POST'])
def load_game_by_id():
    try:
        data = request.json
        user_id = data.get('uid')
        game_id = data.get('gameId')
        
        if not user_id or not game_id:
            return jsonify({'error': 'User ID and Game ID are required'}), 400
        
        # Check cache for individual game
        cache_key = f"game:{user_id}:{game_id}"
        if cache_key in games_cache:
            cached_game, timestamp = games_cache[cache_key]
            if time.time() - timestamp < CACHE_TTL:
                logging.info(f"Returning cached game {game_id} for user {user_id}")
                return jsonify({'game': cached_game}), 200
        
        logging.info(f"Loading full game data for user {user_id}, game {game_id}")
        
        # Direct document access - fastest way
        game_ref = db.collection('savedGames').document(user_id).collection('games').document(game_id)
        game_doc = game_ref.get()
        
        if not game_doc.exists:
            logging.error(f"Game not found: {game_id} for user {user_id}")
            return jsonify({'error': 'Game not found'}), 404
        
        game_data = game_doc.to_dict()
        game_data['gameId'] = game_doc.id
        game_data['gameName'] = game_doc.id  # For backward compatibility
        
        # Cache individual game
        games_cache[cache_key] = (game_data, time.time())
        
        # Log size for monitoring
        game_data_size = len(str(game_data))
        logging.info(f"Loaded game {game_id} successfully, size: ~{game_data_size} bytes")
        
        if game_data_size > 5000000:  # 5MB warning
            logging.warning(f"Game {game_id} is very large: {game_data_size} bytes")
        
        return jsonify({'game': game_data}), 200
        
    except Exception as e:
        logging.error(f"Error loading game by ID: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Endpoint to delete an entire dataset (all games within a dataset) for a user
@app.route('/delete-dataset', methods=['POST'])
def delete_dataset():
    try:
        data = request.json  # Get the JSON data from the request
        user_id = data.get('uid')  # Extract the user ID
        dataset_name = data.get('datasetName')  # Extract the dataset name
    
        # Validate if required fields are provided
        if not user_id or not dataset_name:
            logging.error("UID or datasetName not provided for dataset deletion.")
            return jsonify({'error': 'UID and datasetName are required.'}), 400
    
        # Reference to the user's games collection
        games_ref = db.collection('savedGames').document(user_id).collection('games')
    
        # Query for games with the specified datasetName
        query = games_ref.where('datasetName', '==', dataset_name)
        games_snapshot = query.stream()
    
        # Initialize a batch for bulk deletion
        batch = db.batch()
        games_found = False
    
        for game_doc in games_snapshot:
            batch.delete(game_doc.reference)
            games_found = True
    
        if not games_found:
            logging.warning(f"No games found under dataset '{dataset_name}' for user {user_id}.")
            return jsonify({'message': f'No games found under dataset "{dataset_name}".'}), 404
    
        # Commit the batch deletion
        batch.commit()
    
        logging.info(f"Deleted all games under dataset '{dataset_name}' for user {user_id}.")
        return jsonify({'success': True, 'message': f'Dataset "{dataset_name}" deleted successfully.'}), 200
    except Exception as e:
        logging.error(f"Error deleting dataset: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Endpoint to delete ONE game for a user
@app.route('/delete-game', methods=['DELETE', 'POST'])   # allow either verb
def delete_game():
    try:
        data      = request.get_json() or request.form
        uid       = data.get('uid')
        game_id   = data.get('gameId')   # you send this from the front end

        if not uid or not game_id:
            logging.error("UID or gameId missing for delete-game")
            return jsonify({'error': 'uid and gameId are required.'}), 400

        # reference: savedGames/{uid}/games/{gameId}
        game_ref = (
            db.collection('savedGames')
              .document(uid)
              .collection('games')
              .document(game_id)
        )

        if not game_ref.get().exists:
            logging.warning(f"Game '{game_id}' not found for user {uid}")
            return jsonify({'error': 'Game not found.'}), 404

        game_ref.delete()
        logging.info(f"Deleted game '{game_id}' for user {uid}")
        return jsonify({'success': True}), 200

    except Exception as e:
        logging.error(f"Error deleting game: {str(e)}")
        return jsonify({'error': str(e)}), 500

   
# Endpoint to download all games within a specific dataset as a JSON file
@app.route('/download-dataset', methods=['POST'])
def download_dataset():
    try:
        data = request.json  # Get the JSON data from the request
        user_id = data.get('uid')  # Extract the user ID
        dataset_name = data.get('datasetName')  # Extract the dataset name

        # Validate if required fields are provided
        if not user_id or not dataset_name:
            logging.error("UID or datasetName not provided for dataset download.")
            return jsonify({'error': 'UID and datasetName are required.'}), 400

        # Reference to the user's games collection
        games_ref = db.collection('savedGames').document(user_id).collection('games')

        # Query for games with the specified datasetName
        query = games_ref.where('datasetName', '==', dataset_name)
        games_snapshot = query.stream()

        games = []

        for game_doc in games_snapshot:
            game_data = game_doc.to_dict()
            game_name = game_doc.id
            match_date = game_data.get('matchDate')
            sport = game_data.get('sport')
            game_actions = game_data.get('gameData', [])

            game_info = {
                'gameName': game_name,
                'matchDate': match_date,
                'sport': sport,
                'gameData': game_actions
            }

            games.append(game_info)

        if not games:
            logging.warning(f"No games found under dataset '{dataset_name}' for user {user_id}.")
            return jsonify({'error': f'No games found under dataset "{dataset_name}".'}), 404

        # Prepare the dataset metadata
        dataset = {
            'name': dataset_name,
            'description': '',  # You might not have a description in savedGames, set to empty or fetch if available
            'price': 0.0,
            'category': '',  # Set category if available
            'created_at': None,  # Set created_at if available
            'updated_at': None  # Set updated_at if available
        }

        # Prepare JSON data for download
        download_data = {
            'dataset': dataset,
            'games': games
        }

        # Serialize the data to JSON
        json_data = json.dumps(download_data, default=firestore_to_json, indent=2)

        # Create a Flask response with the JSON data as a file
        response = make_response(json_data)
        response.headers['Content-Disposition'] = f'attachment; filename={dataset_name.replace(" ", "_")}_data.json'
        response.mimetype = 'application/json'

        logging.info(f"Dataset '{dataset_name}' for user {user_id} downloaded successfully.")
        return response
    except Exception as e:
        logging.error(f"Error downloading dataset: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
# Endpoint to list all datasets for a user
@app.route('/list-datasets', methods=['POST'])
def list_datasets():
    try:
        data = request.json
        uid = data.get('uid')
        
        if not uid:
            logging.error("UID not provided for listing datasets.")
            return jsonify({'error': 'UID is required.'}), 400

        # Reference to the user's games collection
        games_ref = db.collection('savedGames').document(uid).collection('games')
        games_snapshot = games_ref.stream()

        # Extract unique dataset names
        datasets = set()
        for game_doc in games_snapshot:
            game_data = game_doc.to_dict()
            dataset_name = game_data.get('datasetName', 'Default')  # Default dataset if not specified
            datasets.add(dataset_name)
        
        datasets = list(datasets)
        logging.info(f"Listed datasets for user {uid}: {datasets}")
        return jsonify({'datasets': datasets}), 200
    except Exception as e:
        logging.error(f"Error listing datasets: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Endpoint to create a new dataset for a user
@app.route('/create-dataset', methods=['POST'])
def create_dataset():
    try:
        data = request.json
        uid = data.get('uid')
        dataset_name = data.get('datasetName')

        if not uid or not dataset_name:
            logging.error("UID or datasetName not provided for creating dataset.")
            return jsonify({'error': 'UID and datasetName are required.'}), 400

        # Reference to the user's games collection
        games_ref = db.collection('savedGames').document(uid).collection('games')

        # Check if the dataset already exists
        existing_datasets = set()
        games_snapshot = games_ref.stream()
        for game_doc in games_snapshot:
            game_data = game_doc.to_dict()
            existing_datasets.add(game_data.get('datasetName', 'Default'))

        if dataset_name in existing_datasets:
            logging.warning(f"Dataset '{dataset_name}' already exists for user {uid}.")
            return jsonify({'error': 'Dataset already exists.'}), 400

        # Since datasets are implied by datasetName, no need to create a separate document
        # Just return success to allow the game to be saved under this new dataset
        logging.info(f"Dataset '{dataset_name}' created for user {uid}.")
        return jsonify({'success': True, 'datasetName': dataset_name}), 201
    except Exception as e:
        logging.error(f"Error creating dataset: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Endpoint to generate AI insights using OpenAI
@app.route('/generate-insights', methods=['POST'])
@cross_origin()  # Enable CORS for this specific endpoint
def generate_insights():
    try:
        data = request.json  # Get the JSON data from the request
        logging.info(f"Received data from frontend: {data}")  # Log the received data

        summary = data.get('summary')  # Extract the summary from the request

        # Validate if the summary is provided
        if not summary:
            logging.error("Summary not provided for AI insights generation.")  # Log the error
            return jsonify({'error': 'Summary is required.'}), 400  # Respond with error

        # Prepare the messages for the OpenAI Chat Completion request
        messages = [
            {
                "role": "system",  # System message defining the AI's role
                "content": "You are a football analyst. Provide tactical and positional advice based on the data provided."
            },
            {
                "role": "user",  # User's message containing the provided summary
                "content": summary
            }
        ]

        logging.info(f"Sending messages to OpenAI API: {messages}")  # Log the API request

        # Send the request to OpenAI's GPT-4 model and stream the response
        completion = client.chat.completions.create(
            model="gpt-4o",  # Specify the model to use (ensure it's available with your API key)
            messages=messages,  # Pass the messages
            max_tokens=500,  # Limit the response length
            n=1,  # Number of responses to generate
            temperature=0.7,  # Control the randomness of the response
            stream=True  # Enable streaming for large responses
        )

        insights = ""  # Initialize an empty string to hold the insights
        # Stream the response and append each chunk of content to insights
        for chunk in completion:
            content = getattr(chunk.choices[0].delta, 'content', None)
            if content:
                insights += content

        logging.info("AI insights generated successfully.")  # Log the success
        return jsonify({'insights': insights})  # Return the generated insights in JSON

    except OpenAIError as e:
        logging.error(f"OpenAI API Error: {str(e)}", exc_info=True)  # Log OpenAI-specific errors
        return jsonify({'error': f'OpenAI API Error: {str(e)}'}), 500  # Respond with error in JSON
    except Exception as e:
        logging.error(f"Error generating AI insights: {str(e)}", exc_info=True)  # Log other errors
        return jsonify({'error': f'Failed to generate AI insights: {str(e)}'}), 500  # Respond with error in JSON


@app.route('/stripe-webhook', methods=['POST'])
def stripe_webhook():
    payload = request.get_data(as_text=True)
    sig_header = request.headers.get('Stripe-Signature')
    endpoint_secret = os.getenv('STRIPE_WEBHOOK_SECRET')

    try:
        # Verify the event by checking the signature
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)

        logging.info(f"Received Stripe event: {event['type']}")

        # Handle different Stripe event types
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            customer_id = session['customer']
            subscription_id = session.get('subscription')

            # Retrieve the user from Firestore using the Stripe customer ID
            user_docs = db.collection('users').where('stripeCustomerId', '==', customer_id).get()
            for doc in user_docs:
                uid = doc.id
                user_ref = db.collection('users').document(uid)
                user_ref.set({
                    'subscriptionId': subscription_id,
                    'role': 'paid'
                }, merge=True)
                logging.info(f"Updated user {uid} to 'paid' with subscription {subscription_id}")

        elif event['type'] == 'payout.paid':
            payout = event['data']['object']
            payout_id = payout['id']
            account_id = payout['destination']

            # Optionally, update Firestore with payout details
            user_docs = db.collection('users').where('stripeAccountId', '==', account_id).get()
            for doc in user_docs:
                uid = doc.id
                earnings_ref = db.collection('earnings').document(uid)
                earnings_ref.update({
                    'pending_payouts': firestore.Increment(-payout['amount'] / 100)  # Assuming amount is in cents
                })
                logging.info(f"Payout {payout_id} processed for user {uid}")

        elif event['type'] == 'payment_intent.succeeded':
            payment_intent = event['data']['object']
            payment_intent_id = payment_intent['id']
            amount_received = payment_intent['amount_received']
            currency = payment_intent['currency']
            customer_id = payment_intent['customer']

            # Optionally, update Firestore or notify users
            logging.info(f"PaymentIntent succeeded: {payment_intent_id} for amount {amount_received} {currency}")

        elif event['type'] == 'payment_intent.payment_failed':
            payment_intent = event['data']['object']
            payment_intent_id = payment_intent['id']
            failure_message = payment_intent['last_payment_error']['message']

            # Optionally, notify users or handle failed payments
            logging.error(f"PaymentIntent failed: {payment_intent_id}, Reason: {failure_message}")

            # Example: Update user's role to 'free' if payment failed
            customer_id = payment_intent['customer']
            user_docs = db.collection('users').where('stripeCustomerId', '==', customer_id).get()
            for doc in user_docs:
                uid = doc.id
                user_ref = db.collection('users').document(uid)
                user_ref.set({'role': 'free'}, merge=True)
                logging.info(f"Updated user {uid} to 'free' due to payment failure.")

        elif event['type'] == 'invoice.payment_failed':
            invoice = event['data']['object']
            subscription_id = invoice['subscription']

            # Example: Handle subscription payment failure
            handle_failed_payment(subscription_id)
            logging.error(f"Invoice payment failed for subscription {subscription_id}")

        elif event['type'] == 'customer.subscription.deleted':
            subscription = event['data']['object']
            subscription_id = subscription['id']

            # Example: Handle subscription cancellation
            handle_subscription_cancel(subscription_id)
            logging.info(f"Subscription {subscription_id} has been canceled.")

        elif event['type'] == 'customer.subscription.updated':
            subscription = event['data']['object']
            handle_subscription_update(subscription)
            logging.info(f"Subscription {subscription['id']} has been updated to status {subscription['status']}.")
            
        # New event handler for customer.updated
        elif event['type'] == 'customer.updated':
            customer = event['data']['object']
            customer_id = customer['id']
            email = customer['email']
            
            # Find all users with this email and update their customer ID
            user_docs = db.collection('users').where('email', '==', email).get()
            
            if len(list(user_docs)) > 0:
                for doc in user_docs:
                    uid = doc.id
                    user_ref = db.collection('users').document(uid)
                    user_ref.update({'stripeCustomerId': customer_id})
                    logging.info(f"Updated customer ID for user {uid} from webhook")
                    
                    # Also check subscription status and update role
                    try:
                        subscriptions = stripe.Subscription.list(customer=customer_id)
                        if subscriptions and subscriptions['data']:
                            subscription = subscriptions['data'][0]
                            status = subscription['status']
                            
                            if status in ['active', 'trialing']:
                                user_ref.update({'role': 'paid'})
                                logging.info(f"Updated user {uid} to 'paid' after customer update")
                            else:
                                user_ref.update({'role': 'free'})
                                logging.info(f"Updated user {uid} to 'free' after customer update, status: {status}")
                    except Exception as sub_error:
                        logging.error(f"Error checking subscription after customer update: {str(sub_error)}")
            else:
                logging.info(f"No users found with email {email} for customer {customer_id}")

        # New event handler for invoice.paid
        elif event['type'] == 'invoice.paid':
            invoice = event['data']['object']
            customer_id = invoice['customer']
            subscription_id = invoice.get('subscription')
            
            if customer_id and subscription_id:
                # Find users with this customer ID
                user_docs = db.collection('users').where('stripeCustomerId', '==', customer_id).get()
                
                if len(list(user_docs)) > 0:
                    for doc in user_docs:
                        uid = doc.id
                        user_ref = db.collection('users').document(uid)
                        user_ref.update({
                            'subscriptionId': subscription_id,
                            'role': 'paid'
                        })
                        logging.info(f"Updated user {uid} to 'paid' after invoice payment")
                else:
                    # Try to find by email as fallback
                    try:
                        customer = stripe.Customer.retrieve(customer_id)
                        email = customer.get('email')
                        
                        if email:
                            email_user_docs = db.collection('users').where('email', '==', email).get()
                            
                            for doc in email_user_docs:
                                uid = doc.id
                                user_ref = db.collection('users').document(uid)
                                user_ref.update({
                                    'stripeCustomerId': customer_id,
                                    'subscriptionId': subscription_id,
                                    'role': 'paid'
                                })
                                logging.info(f"Updated user {uid} with customer ID {customer_id} and role 'paid' after invoice payment (found by email)")
                    except Exception as e:
                        logging.error(f"Error finding user by email after invoice payment: {str(e)}")

        else:
            logging.warning(f"Unhandled event type: {event['type']}")

        return jsonify(success=True), 200

    except stripe.error.SignatureVerificationError as e:
        logging.error(f"Stripe Signature Verification Error: {str(e)}")
        return jsonify(error=str(e)), 400
    except Exception as e:
        logging.error(f"Stripe Webhook Error: {str(e)}")
        return jsonify(error=str(e)), 500

# Function to handle failed payments and update user role
def handle_failed_payment(subscription_id):
    if subscription_id is None:
        logging.error("Subscription ID is missing from the payment failed event.")  # Log error if subscription ID is missing
        return

    try:
        # Query Firestore for users with the matching subscription ID
        user_docs = db.collection('users').where('subscriptionId', '==', subscription_id).get()

        if not user_docs:  # If no user found, log the message
            logging.info(f"No user found for subscription: {subscription_id}")
            return

        # Update each user's role to 'free' due to payment failure
        for doc in user_docs:
            user_ref = db.collection('users').document(doc.id)
            user_ref.set({'role': 'free'}, merge=True)
            logging.info(f"Updated user {doc.id} to free plan due to payment failure.")

    except Exception as e:
        logging.error(f"Error handling failed payment for subscription {subscription_id}: {str(e)}")  # Log any errors


# Function to retrieve and update subscription status in Firestore
def retrieve_and_update_subscription(uid, customer_id):
    try:
        # Retrieve the customer's subscription from Stripe
        subscriptions = stripe.Subscription.list(customer=customer_id)

        if subscriptions and subscriptions['data']:
            subscription = subscriptions['data'][0]  # Get the first subscription
            status = subscription['status']  # Get the subscription status (e.g., 'active', 'canceled')

            # Update the Firestore user's role based on subscription status
            user_ref = db.collection('users').document(uid)
            if status in ['active', 'trialing']:
                user_ref.set({'role': 'paid'}, merge=True)  # Set role to 'paid'
                logging.info(f"Updated user {uid} to paid plan.")
            else:
                user_ref.set({'role': 'free'}, merge=True)  # Set role to 'free' for other statuses
                logging.info(f"Updated user {uid} to free plan due to subscription status: {status}")
        else:
            logging.warning(f"No active subscription found for customer {customer_id}.")
            user_ref.set({'role': 'free'}, merge=True)  # Set role to 'free' if no active subscription found

    except Exception as e:
        logging.error(f"Error retrieving subscription for customer {customer_id}: {str(e)}")  # Log any errors


# Function to handle subscription cancellations and update Firestore
def handle_subscription_cancel(subscription_id):
    try:
        # Query Firestore for users with the matching subscription ID
        user_docs = db.collection('users').where('subscriptionId', '==', subscription_id).get()

        if not user_docs:  # If no user found, log the message
            logging.info(f"No user found for subscription: {subscription_id}")
            return

        # Update each user's role to 'free' and remove the subscription ID due to cancellation
        for doc in user_docs:
            user_ref = db.collection('users').document(doc.id)
            user_ref.set({'role': 'free', 'subscriptionId': None}, merge=True)
            logging.info(f"Subscription {subscription_id} canceled. Updated user {doc.id} to free plan.")

    except Exception as e:
        logging.error(f"Error handling subscription cancel for {subscription_id}: {str(e)}")  # Log any errors


# Function to handle subscription updates and adjust Firestore
def handle_subscription_update(subscription):
    try:
        subscription_id = subscription['id']  # Get the subscription ID
        status = subscription['status']  # Get the subscription status

        # Query Firestore for users with the matching subscription ID
        user_docs = db.collection('users').where('subscriptionId', '==', subscription_id).get()

        if not user_docs:  # If no user found, log the message
            logging.info(f"No user found for subscription: {subscription_id}")
            return

        # Update each user's role based on subscription status
        for doc in user_docs:
            user_ref = db.collection('users').document(doc.id)
            if status in ['active', 'trialing']:
                user_ref.set({'role': 'paid'}, merge=True)  # Set role to 'paid'
                logging.info(f"Updated user {doc.id} to paid plan.")
            else:
                user_ref.set({'role': 'free'}, merge=True)  # Set role to 'free' for other statuses
                logging.info(f"Updated user {doc.id} to free plan due to subscription status: {status}")

    except Exception as e:
        logging.error(f"Error handling subscription update for subscription {subscription_id}: {str(e)}")  # Log any errors


# Function to handle a completed checkout session and update Firestore
def handle_checkout_session_completed(session):
    try:
        subscription_id = session.get('subscription')  # Get the subscription ID from the session
        customer_email = session.get('customer_email')  # Get the customer's email from the session

        # Validate if subscription ID or customer email are missing
        if not subscription_id or not customer_email:
            logging.error("Missing subscription ID or customer email in session.")
            return

        # Query Firestore for the user with the matching email
        user_docs = db.collection('users').where('email', '==', customer_email).get()

        if not user_docs:  # If no user found, log the message
            logging.error(f"No user found with email: {customer_email}")
            return

        # Update the user's role to 'paid' and save the subscription ID
        for doc in user_docs:
            user_ref = db.collection('users').document(doc.id)
            user_ref.set({
                'role': 'paid',
                'subscriptionId': subscription_id
            }, merge=True)
            logging.info(f"Updated user {doc.id} with subscription ID and set role to paid.")

    except Exception as e:
        logging.error(f"Error handling checkout.session.completed: {str(e)}")  # Log any errors
        
@app.route('/refresh-subscription-status', methods=['POST'])
def refresh_subscription_status():
    try:
        data = request.json
        uid = data.get('uid')
        email = data.get('email')
        stripe_customer_id = data.get('stripeCustomerId')
        
        if not uid:
            return jsonify({'error': 'UID is required'}), 400
            
        # Get user info
        user_ref = db.collection('users').document(uid)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return jsonify({'error': 'User not found'}), 404
            
        user_data = user_doc.to_dict()
        
        # Try to use provided stripeCustomerId first
        if stripe_customer_id:
            try:
                retrieve_and_update_subscription(uid, stripe_customer_id)
                return jsonify({'message': 'Subscription refreshed by customer ID'}), 200
            except Exception as e:
                logging.warning(f"Failed to refresh by customer ID: {str(e)}")
                # Continue to email search
        else:
            # If no stripeCustomerId provided, try to use the one from user data
            stripe_customer_id = user_data.get('stripeCustomerId')
            if stripe_customer_id:
                try:
                    retrieve_and_update_subscription(uid, stripe_customer_id)
                    return jsonify({'message': 'Subscription refreshed by customer ID from database'}), 200
                except Exception as e:
                    logging.warning(f"Failed to refresh by customer ID from database: {str(e)}")
                    # Continue to email search
        
        # If we get here, we're falling back to email search
        if email:
            try:
                customers = stripe.Customer.list(email=email)
                if customers and customers.data:
                    customer = customers.data[0]
                    new_customer_id = customer.id
                    
                    # Update the stored customer ID
                    user_ref.update({'stripeCustomerId': new_customer_id})
                    
                    # Retrieve and update subscription status
                    retrieve_and_update_subscription(uid, new_customer_id)
                    return jsonify({'message': 'Subscription refreshed by email'}), 200
                else:
                    return jsonify({'message': 'No customer found with this email'}), 404
            except Exception as e:
                logging.error(f"Error searching by email: {str(e)}")
                return jsonify({'error': str(e)}), 500
        else:
            return jsonify({'error': 'Email is required for customer search'}), 400
    
    except Exception as e:
        logging.error(f"Error refreshing subscription: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/get-user-data', methods=['POST'])
def get_user_data():
    try:
        data = request.json
        uid = data.get('uid')  # Get the user ID from the request

        logging.info(f"Fetching user data for UID: {uid}")  # Log the UID

        # Fetch the user document from Firestore
        user_doc = db.collection('users').document(uid).get()

        # Correctly check if the document exists
        if not user_doc.exists:
            logging.error(f"User not found for UID: {uid}")
            return jsonify({'error': 'User not found'}), 404

        user_data = user_doc.to_dict()  # Convert Firestore document to a dictionary
        logging.info(f"Retrieved user data for UID {uid}: {user_data}")

        # Fetch the Stripe customer ID from Firestore data
        stripe_customer_id = user_data.get('stripeCustomerId')
        email = user_data.get('email')

        # First, try the saved customer ID
        if stripe_customer_id:
            # Try to get subscriptions by customer ID
            try:
                subscriptions = stripe.Subscription.list(customer=stripe_customer_id)
                
                if subscriptions and subscriptions['data']:
                    # Handle active subscription as before
                    subscription = subscriptions['data'][0]
                    status = subscription['status']
                    user_ref = db.collection('users').document(uid)
                    
                    if status in ['active', 'trialing']:
                        user_ref.set({'role': 'paid'}, merge=True)
                        user_data['role'] = 'paid'
                        logging.info(f"Updated user {uid} to 'paid' plan by customer ID.")
                    else:
                        user_ref.set({'role': 'free'}, merge=True)
                        user_data['role'] = 'free'
                        logging.info(f"Updated user {uid} to 'free' plan due to subscription status: {status}")
                    
                    # Return the updated user data
                    return jsonify(user_data)
            except Exception as e:
                logging.warning(f"Error finding subscription by customer ID: {str(e)}")
                # Continue to email search
        
        # If we get here, either customer ID was not found or no subscription was found
        # Search by email as a fallback
        if email:
            try:
                # Search for customers with this email
                customers = stripe.Customer.list(email=email)
                
                if customers and customers['data']:
                    # Get the first matching customer
                    customer = customers['data'][0]
                    new_customer_id = customer.id
                    
                    # Save this customer ID to the user record
                    user_ref = db.collection('users').document(uid)
                    user_ref.update({'stripeCustomerId': new_customer_id})
                    user_data['stripeCustomerId'] = new_customer_id
                    logging.info(f"Updated customer ID for {uid} to {new_customer_id}")
                    
                    # Check for subscriptions with this customer
                    subscriptions = stripe.Subscription.list(customer=new_customer_id)
                    
                    if subscriptions and subscriptions['data']:
                        subscription = subscriptions['data'][0]
                        status = subscription['status']
                        
                        if status in ['active', 'trialing']:
                            user_ref.set({'role': 'paid'}, merge=True)
                            user_data['role'] = 'paid'
                            logging.info(f"Updated user {uid} to 'paid' plan by email search.")
                        else:
                            user_ref.set({'role': 'free'}, merge=True)
                            user_data['role'] = 'free'
                            logging.info(f"User {uid} found by email but subscription status is: {status}")
                    else:
                        user_ref.set({'role': 'free'}, merge=True)
                        user_data['role'] = 'free'
                        logging.info(f"No active subscription found for email: {email}")
                else:
                    user_ref = db.collection('users').document(uid)
                    user_ref.set({'role': 'free'}, merge=True)
                    user_data['role'] = 'free'
                    logging.info(f"No Stripe customer found for email: {email}")
            except Exception as e:
                logging.error(f"Error searching by email: {str(e)}")
                user_ref = db.collection('users').document(uid)
                user_ref.set({'role': 'free'}, merge=True)
                user_data['role'] = 'free'
        else:
            user_ref = db.collection('users').document(uid)
            user_ref.set({'role': 'free'}, merge=True)
            user_data['role'] = 'free'
            logging.warning(f"No email found for user {uid}")

        # Return the user data
        return jsonify(user_data)
    except Exception as e:
        logging.error(f"Error retrieving user data: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
#Sports Hub Section 
# Helper function to add a new dataset
# Helper function to add a new dataset
# Updated helper function to add a new dataset
def add_dataset(name, description, price, creator_uid, preview_snippet, category):
    """
    Helper function to add a new dataset to Firestore with pricing support.
    
    Args:
        name (str): Dataset name
        description (str): Dataset description
        price (float): Dataset price (0.0 for free datasets)
        creator_uid (str): UID of the dataset creator
        preview_snippet (str): Preview text or image URL
        category (str): Dataset category (e.g., 'Soccer', 'Basketball')
        
    Returns:
        str: The ID of the newly created dataset document
    """
    try:
        # Create a new document in the datasets collection
        dataset_ref = db.collection('datasets').document()
        
        # Set the dataset data
        dataset_ref.set({
            'name': name,
            'description': description,
            'price': float(price),  # Ensure price is stored as float
            'creator_uid': creator_uid,
            'preview_snippet': preview_snippet,
            'category': category,
            'created_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP,
            'is_free': price == 0.0,  # Add an explicit is_free field for querying
            'downloads': 0,           # Track number of downloads
            'purchases': 0            # Track number of purchases (for paid datasets)
        })
        
        # Log the operation
        logging.info(f"Dataset '{name}' added with ID {dataset_ref.id}, price: ${price:.2f}")
        
        # Return the document ID
        return dataset_ref.id
    except Exception as e:
        logging.error(f"Error adding dataset '{name}': {str(e)}")
        return None


# Helper function to record a transaction
def record_transaction(buyer_uid, dataset_id, amount, commission):
    try:
        transactions_ref = db.collection('transactions')
        transaction_id = str(uuid.uuid4())  # Generate a unique ID for the transaction
        transactions_ref.document(transaction_id).set({
            'buyer_uid': buyer_uid,
            'dataset_id': dataset_id,
            'amount': amount,
            'commission': commission,
            'timestamp': firestore.SERVER_TIMESTAMP
        })
        logging.info(f"Transaction recorded: ID {transaction_id} for dataset {dataset_id} by user {buyer_uid}.")
        return transaction_id
    except Exception as e:
        logging.error(f"Error recording transaction for dataset '{dataset_id}' by user '{buyer_uid}': {str(e)}")
        return None

# Helper function to add a review
def add_review(reviewer_uid, dataset_id, rating, comment):
    try:
        reviews_ref = db.collection('reviews')
        review_id = str(uuid.uuid4())  # Generate a unique ID for the review
        reviews_ref.document(review_id).set({
            'reviewer_uid': reviewer_uid,
            'dataset_id': dataset_id,
            'rating': rating,
            'comment': comment,
            'timestamp': firestore.SERVER_TIMESTAMP
        })
        logging.info(f"Review added: ID {review_id} for dataset {dataset_id} by user {reviewer_uid}.")
        return review_id
    except Exception as e:
        logging.error(f"Error adding review for dataset '{dataset_id}' by user '{reviewer_uid}': {str(e)}")
        return None

# Helper function to initialize earnings for a new user
def initialize_earnings(uid):
    try:
        earnings_ref = db.collection('earnings').document(uid)
        earnings_ref.set({
            'total_earnings': 0.0,
            'pending_payouts': 0.0,
            'last_updated': firestore.SERVER_TIMESTAMP
        })
        logging.info(f"Earnings initialized for user {uid}.")
    except Exception as e:
        logging.error(f"Error initializing earnings for user {uid}: {str(e)}")

@app.route('/signup', methods=['POST'])
def signup():
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        full_name = data.get('fullName')  # Assuming you collect full name

        if not email or not password or not full_name:
            logging.error("Incomplete signup data provided.")
            return jsonify({'error': 'Email, password, and full name are required.'}), 400

        # Create the user in Firebase Authentication
        user = firebase_admin.auth.create_user(
            email=email,
            password=password,
            display_name=full_name
        )
        uid = user.uid
        logging.info(f"User created with UID: {uid}, Email: {email}")

        # Initialize earnings for the new user
        initialize_earnings(uid)

        # Store additional user information in Firestore
        user_ref = db.collection('users').document(uid)
        user_ref.set({
            'email': email,
            'fullName': full_name,
            'role': 'free',  # Default role
            'created_at': firestore.SERVER_TIMESTAMP
        }, merge=True)

        logging.info(f"User {uid} added to Firestore with default role 'free'.")

        return jsonify({'success': True, 'uid': uid}), 201
    except firebase_admin.auth.AuthError as e:
        logging.error(f"Firebase Auth Error during signup: {str(e)}")
        return jsonify({'error': 'Authentication failed.'}), 400
    except Exception as e:
        logging.error(f"Error during signup: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Replace your existing publish-dataset endpoint with this updated version
@app.route('/publish-dataset', methods=['POST'])
def publish_dataset():
    try:
        logging.info("Received publish-dataset request.")
        data = request.form
        files = request.files
        logging.info(f"Form data: {data}")
        logging.info(f"Files: {files}")

        # Extract form data
        name = data.get('name')
        description = data.get('description')
        creator_uid = data.get('creator_uid')
        category = data.get('category')
        is_free = data.get('isFree') == 'true'  # Convert string to boolean
        
        # Get price if not free
        price = 0.0
        if not is_free:
            price_str = data.get('price')
            if price_str:
                try:
                    price = float(price_str)
                except ValueError:
                    logging.error(f"Invalid price format: {price_str}")
                    return jsonify({'error': 'Invalid price format.'}), 400

        # Validate required fields
        if not all([name, description, creator_uid, category]):
            logging.error("Incomplete dataset publishing data provided.")
            return jsonify({'error': 'Name, description, creator_uid, and category are required.'}), 400

        # Check if user has permission to publish datasets
        if not check_publish_permissions(creator_uid):
            logging.error(f"User {creator_uid} does not have permission to publish datasets.")
            return jsonify({'error': 'You do not have permission to publish datasets. Please contact an administrator.'}), 403

        # Check premium status for paid datasets
        if not is_free:
            user_doc = db.collection('users').document(creator_uid).get()
            user_data = user_doc.to_dict() if user_doc.exists else {}
            user_role = user_data.get('role', '')
            is_admin = check_admin_status(creator_uid)
            
            # Only premium users and admins can set prices
            if user_role != 'premium' and not is_admin:
                logging.error(f"User {creator_uid} (role: {user_role}) attempted to create a paid dataset without premium status.")
                return jsonify({'error': 'Only premium users or admins can create paid datasets.'}), 403
                
            # Validate price for paid datasets
            if price <= 0:
                logging.error("Invalid price provided for a paid dataset.")
                return jsonify({'error': 'Valid price is required for paid datasets.'}), 400

        # Check free dataset limit if applicable
        user_doc = db.collection('users').document(creator_uid).get()
        user_data = user_doc.to_dict() if user_doc.exists else {}
        user_role = user_data.get('role', '')
        
        # Only check limits for non-admin users
        if is_free and not check_admin_status(creator_uid):
            # Set different limits based on user role
            free_limit = 5  # Default limit for free users
            if user_role == 'premium':
                free_limit = 20  # Higher limit for premium users
                
            user_games_ref = db.collection('datasets').where('creator_uid', '==', creator_uid).where('price', '==', 0.0)
            # Manual count since .count() is not available
            free_count = sum(1 for _ in user_games_ref.stream())
            logging.info(f"User {creator_uid} has {free_count} free datasets.")
            if free_count >= free_limit:
                logging.error("Free dataset limit reached.")
                return jsonify({'error': f'Free dataset limit of {free_limit} reached. Upgrade to premium for more datasets or contact an administrator.'}), 403

        # Add dataset to Firestore
        dataset_id = add_dataset(name, description, price, creator_uid, None, category)  # preview_snippet set to None

        if dataset_id:
            logging.info(f"Dataset '{name}' added with ID {dataset_id}.")

            # Copy games from user's 'savedGames' to 'datasets/{dataset_id}/games'
            games_ref = db.collection('savedGames').document(creator_uid).collection('games').where('datasetName', '==', name)
            games_snapshot = games_ref.stream()
            batch = db.batch()
            games_copied = 0
            for game_doc in games_snapshot:
                game_data = game_doc.to_dict()
                # Remove any user-specific data if necessary
                # game_data.pop('some_user_field', None)

                # Write to 'datasets/{dataset_id}/games/{game_doc.id}'
                new_game_ref = db.collection('datasets').document(dataset_id).collection('games').document(game_doc.id)
                batch.set(new_game_ref, game_data)
                games_copied += 1

            # Commit the batch write
            batch.commit()
            logging.info(f"Copied {games_copied} games to dataset '{dataset_id}'.")

            return jsonify({'success': True, 'dataset_id': dataset_id}), 201
        else:
            logging.error("Failed to add dataset.")
            return jsonify({'error': 'Failed to add dataset.'}), 400

    except Exception as e:
        logging.error(f"Error in publish_dataset endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
# Replace your existing published-datasets endpoint with this updated version
@app.route('/published-datasets', methods=['GET'])
def get_published_datasets():
    try:
        # Check for auth token in headers
        auth_header = request.headers.get('Authorization')
        uid = None
        
        if auth_header and auth_header.startswith('Bearer '):
            # Extract token
            token = auth_header.split('Bearer ')[1]
            try:
                # Verify token
                decoded_token = firebase_admin.auth.verify_id_token(token)
                uid = decoded_token['uid']
            except Exception as e:
                logging.warning(f"Invalid auth token: {str(e)}")
                # Continue as anonymous user
        
        # Check if user has permission to view datasets
        has_access = check_view_permissions(uid)
        
        if not has_access:
            logging.warning(f"User {uid or 'anonymous'} does not have permission to view datasets")
            return jsonify({
                'error': 'You do not have permission to view the Sports Data Hub.',
                'datasets': []
            }), 403
        
        # If user has access, fetch datasets
        datasets_ref = db.collection('datasets')
        datasets = []
        
        for doc in datasets_ref.stream():
            dataset = doc.to_dict()
            dataset['id'] = doc.id
            datasets.append(dataset)
        
        logging.info(f"Fetched {len(datasets)} published datasets for user {uid or 'anonymous'}")
        return jsonify({'datasets': datasets}), 200
    
    except Exception as e:
        logging.error(f"Error fetching published datasets: {str(e)}")
        return jsonify({'error': 'Failed to fetch published datasets.'}), 500

# def save_image(image_file):
#     try:
#         from firebase_admin import storage

#         # Initialize Firebase Storage bucket
#         bucket = storage.bucket()
        
#         # Generate a unique filename
#         unique_filename = f'datasets/{uuid.uuid4()}_{image_file.filename}'
        
#         # Create a blob and upload the file
#         blob = bucket.blob(unique_filename)
#         blob.upload_from_file(image_file, content_type=image_file.content_type)
        
#         # Make the blob publicly accessible
#         blob.make_public()
        
#         logging.info(f"Image uploaded to {blob.public_url}")
#         return blob.public_url
#     except firebase_admin.exceptions.FirebaseError as fe:
#         logging.error(f"Firebase error while saving image: {str(fe)}")
#         return None
#     except Exception as e:
#         logging.error(f"Unexpected error while saving image: {str(e)}")
#         return None

@app.route('/stripe/callback', methods=['GET'])
def stripe_callback():
    try:
        code = request.args.get('code')
        error = request.args.get('error')

        if error:
            logging.error(f"Stripe OAuth error: {error}")
            return jsonify({'error': 'Stripe OAuth failed.'}), 400

        # Exchange the authorization code for an access token
        response = stripe.OAuth.token(
            grant_type='authorization_code',
            code=code,
        )

        connected_account_id = response['stripe_user_id']
        logging.info(f"Stripe account connected: {connected_account_id}")

        # Assume you pass the UID as a query parameter during OAuth initiation
        uid = request.args.get('state')  # Ensure you pass UID as 'state' when generating the OAuth URL

        if uid:
            # Store the connected Stripe account ID in Firestore
            user_ref = db.collection('users').document(uid)
            user_ref.set({'stripeAccountId': connected_account_id}, merge=True)
            logging.info(f"Stored Stripe account ID {connected_account_id} for user {uid}.")
            return jsonify({'success': True, 'stripeAccountId': connected_account_id}), 200
        else:
            logging.error("UID not provided in OAuth callback.")
            return jsonify({'error': 'UID is required.'}), 400

    except Exception as e:
        logging.error(f"Error in Stripe OAuth callback: {str(e)}")
        return jsonify({'error': 'Stripe OAuth callback failed.'}), 500

@app.route('/connect-stripe', methods=['GET'])
def connect_stripe():
    try:
        uid = request.args.get('uid')  # Get UID from query parameters
        if not uid:
            logging.error("UID not provided for Stripe Connect.")
            return jsonify({'error': 'UID is required to connect Stripe.'}), 400

        # Define the redirect URI after Stripe OAuth
        redirect_uri = 'https://scorelect.com/stripe/callback'

        # Generate the Stripe Connect OAuth link with state parameter
        stripe_connect_url = stripe.OAuth.authorize_url(
            response_type='code',
            scope='read_write',
            client_id=STRIPE_CLIENT_ID,
            redirect_uri=redirect_uri,
            state=uid  # Pass UID to retrieve in callback
        )

        logging.info(f"Generated Stripe Connect URL for UID {uid}: {stripe_connect_url}")
        return jsonify({'url': stripe_connect_url}), 200
    except Exception as e:
        logging.error(f"Error generating Stripe Connect URL: {str(e)}")
        return jsonify({'error': 'Failed to generate Stripe Connect URL.'}), 500

# Update the purchase-dataset endpoint to handle Stripe payments for datasets
@app.route('/purchase-dataset', methods=['POST'])
def purchase_dataset():
    try:
        data = request.json
        buyer_uid = data.get('buyer_uid')
        dataset_id = data.get('dataset_id')
        payment_method = data.get('payment_method')  # Stripe Payment Method ID

        if not all([buyer_uid, dataset_id, payment_method]):
            logging.error("Incomplete purchase data provided.")
            return jsonify({'error': 'buyer_uid, dataset_id, and payment_method are required.'}), 400

        # Retrieve the dataset details from Firestore
        dataset_doc = db.collection('datasets').document(dataset_id).get()
        if not dataset_doc.exists:
            logging.error(f"Dataset '{dataset_id}' not found.")
            return jsonify({'error': 'Dataset not found.'}), 404

        dataset = dataset_doc.to_dict()
        price = dataset.get('price', 0.0)
        creator_uid = dataset.get('creator_uid')
        dataset_name = dataset.get('name', 'Unnamed Dataset')

        # Verify this is a paid dataset
        if price <= 0:
            logging.error(f"Attempted to purchase free dataset '{dataset_id}'.")
            return jsonify({'error': 'This dataset is free and does not require purchase.'}), 400

        if not all([price, creator_uid]):
            logging.error(f"Incomplete dataset information for '{dataset_id}'.")
            return jsonify({'error': 'Dataset information incomplete.'}), 400

        # Don't allow creators to purchase their own datasets
        if buyer_uid == creator_uid:
            logging.error(f"Creator '{creator_uid}' attempted to purchase their own dataset.")
            return jsonify({'error': 'You cannot purchase your own dataset.'}), 400

        # Check if user already owns this dataset
        purchases_ref = db.collection('users').document(buyer_uid).collection('purchases')
        existing_purchase = purchases_ref.where('dataset_id', '==', dataset_id).limit(1).get()
        
        if len(list(existing_purchase)) > 0:
            logging.warning(f"User '{buyer_uid}' already owns dataset '{dataset_id}'.")
            return jsonify({'error': 'You already own this dataset.'}), 400

        # Retrieve the creator's Stripe account ID
        creator_doc = db.collection('users').document(creator_uid).get()
        if not creator_doc.exists:
            logging.error(f"Creator '{creator_uid}' not found.")
            return jsonify({'error': 'Dataset creator not found.'}), 404

        creator = creator_doc.to_dict()
        stripe_account_id = creator.get('stripeAccountId')

        if not stripe_account_id:
            logging.error(f"Stripe account not connected for creator '{creator_uid}'.")
            return jsonify({'error': 'Dataset creator has not connected their payment account.'}), 400

        # Calculate commission and creator payout
        commission_percentage = 0.20  # 20% commission
        commission = price * commission_percentage
        payout = price - commission

        # Get buyer information for the receipt
        buyer_doc = db.collection('users').document(buyer_uid).get()
        buyer_email = buyer_doc.to_dict().get('email') if buyer_doc.exists else None

        try:
            # Create a PaymentIntent with destination charge for Stripe Connect
            payment_intent = stripe.PaymentIntent.create(
                amount=int(price * 100),  # Convert to cents
                currency='usd',
                payment_method=payment_method,
                confirmation_method='manual',
                confirm=True,
                receipt_email=buyer_email,  # Send receipt email
                description=f"Purchase of dataset: {dataset_name}",
                metadata={
                    'dataset_id': dataset_id,
                    'dataset_name': dataset_name,
                    'buyer_uid': buyer_uid
                },
                transfer_data={
                    'destination': stripe_account_id,
                    'amount': int(payout * 100),  # Convert payout to cents
                },
            )

            # Record the transaction in Firestore
            transaction_id = record_transaction(buyer_uid, dataset_id, price, commission)
            
            # Add the purchased dataset to the user's purchases collection
            purchases_ref.document(transaction_id).set({
                'dataset_id': dataset_id,
                'dataset_name': dataset_name,
                'price': price,
                'purchase_date': firestore.SERVER_TIMESTAMP,
                'transaction_id': transaction_id
            })
            
            # Increment the purchases count for the dataset
            db.collection('datasets').document(dataset_id).update({
                'purchases': firestore.Increment(1)
            })

            # Update creator's earnings
            creator_earnings_ref = db.collection('earnings').document(creator_uid)
            creator_earnings_doc = creator_earnings_ref.get()
            
            if creator_earnings_doc.exists:
                creator_earnings_ref.update({
                    'total_earnings': firestore.Increment(payout),
                    'pending_payouts': firestore.Increment(payout),
                    'last_updated': firestore.SERVER_TIMESTAMP
                })
            else:
                creator_earnings_ref.set({
                    'total_earnings': payout,
                    'pending_payouts': payout,
                    'last_updated': firestore.SERVER_TIMESTAMP
                })

            logging.info(f"User '{buyer_uid}' purchased dataset '{dataset_id}' for ${price:.2f}. Transaction ID: {transaction_id}")
            return jsonify({
                'success': True,
                'clientSecret': payment_intent.client_secret,
                'transaction_id': transaction_id
            }), 200

        except stripe.error.CardError as e:
            logging.error(f"Stripe Card Error: {e.user_message}")
            return jsonify({'error': e.user_message}), 400
        except stripe.error.RateLimitError as e:
            logging.error("Stripe Rate Limit Error.")
            return jsonify({'error': 'Too many requests to Stripe.'}), 429
        except stripe.error.InvalidRequestError as e:
            logging.error(f"Stripe Invalid Request Error: {str(e)}")
            return jsonify({'error': 'Invalid payment request.'}), 400
        except stripe.error.AuthenticationError as e:
            logging.error("Stripe Authentication Error.")
            return jsonify({'error': 'Authentication with Stripe failed.'}), 401
        except stripe.error.APIConnectionError as e:
            logging.error("Stripe Network Error.")
            return jsonify({'error': 'Network communication with Stripe failed.'}), 502
        except stripe.error.StripeError as e:
            logging.error(f"Stripe Error: {str(e)}")
            return jsonify({'error': 'Payment processing failed.'}), 500

    except Exception as e:
        logging.error(f"Error processing purchase: {str(e)}")
        return jsonify({'error': 'An error occurred during purchase.'}), 500


from flask import Flask, request, jsonify
import json

@app.route('/upload-dataset', methods=['POST'])
def upload_dataset():
    try:
        # Ensure 'uid' and 'datasetName' are in the form data
        uid = request.form.get('uid')
        dataset_name = request.form.get('datasetName')
        file = request.files.get('file')
        
        # Validate input parameters
        if not uid or not dataset_name or not file:
            logging.error("UID, datasetName, or file not provided for dataset upload.")
            return jsonify({'error': 'UID, datasetName, and file are required.'}), 400
        
        # Ensure the uploaded file is a JSON file
        if not file.filename.endswith('.json'):
            logging.error("Uploaded file is not a JSON file.")
            return jsonify({'error': 'Only JSON files are allowed.'}), 400
        
        # Read and parse the JSON file
        try:
            file_content = file.read().decode('utf-8')
            games_data = json.loads(file_content)
            
            if not isinstance(games_data, list):
                logging.error("JSON file does not contain a list of games.")
                return jsonify({'error': 'JSON file must contain a list of games.'}), 400
        except json.JSONDecodeError:
            logging.error("Invalid JSON format in uploaded file.")
            return jsonify({'error': 'Invalid JSON format.'}), 400
        
        # Iterate through each game and save to Firestore
        for game in games_data:
            game_name = game.get('gameName')
            game_data = game.get('gameData')
            match_date = game.get('matchDate')
            sport = game.get('sport')
            
            # Validate each game's data
            if not all([game_name, game_data, match_date, sport]):
                logging.warning(f"Incomplete game data for game: {game}")
                continue  # Skip incomplete game entries
            
            # Reference to the specific game document
            game_doc_ref = db.collection('savedGames').document(uid).collection('games').document(game_name)
            
            # Save the game data in Firestore
            game_doc_ref.set({
                'gameData': game_data,
                'datasetName': dataset_name,
                'matchDate': match_date,
                'sport': sport
            }, merge=True)
            
            logging.info(f"Game '{game_name}' uploaded under dataset '{dataset_name}' for user {uid}.")
        
        return jsonify({'success': True, 'message': 'Dataset uploaded successfully.'}), 200
    
    except Exception as e:
        logging.error(f"Error uploading dataset: {str(e)}")
        return jsonify({'error': 'An error occurred while uploading the dataset.'}), 500
    
# @app.route('/published-datasets', methods=['GET'])
# def get_published_datasets():
#     try:
#         datasets_ref = db.collection('datasets')
#         datasets = []
#         for doc in datasets_ref.stream():
#             dataset = doc.to_dict()
#             dataset['id'] = doc.id
#             datasets.append(dataset)
#         logging.info(f"Fetched {len(datasets)} published datasets.")
#         return jsonify({'datasets': datasets}), 200
#     except Exception as e:
#         logging.error(f"Error fetching published datasets: {str(e)}")
#         return jsonify({'error': 'Failed to fetch published datasets.'}), 500

def check_free_dataset_limit(creator_uid, limit=5):
    try:
        user_games_ref = db.collection('datasets').where('creator_uid', '==', creator_uid).where('price', '==', 0.0)
        # Manual count since .count() is not available
        count = sum(1 for _ in user_games_ref.stream())
        logging.info(f"User {creator_uid} has {count} free datasets.")
        return count < limit
    except Exception as e:
        logging.error(f"Error checking free dataset limit for user {creator_uid}: {str(e)}")
        return False
    
# Updated /sample-dataset Endpoint
@app.route('/download-published-dataset', methods=['POST'])
def download_published_dataset():
    try:
        data = request.json
        dataset_id = data.get('datasetId')

        if not dataset_id:
            logging.error("Dataset ID not provided for download.")
            return jsonify({'error': 'Dataset ID is required.'}), 400

        # Fetch the dataset document from Firestore
        dataset_doc = db.collection('datasets').document(dataset_id).get()
        if not dataset_doc.exists:
            logging.error(f"Dataset '{dataset_id}' not found.")
            return jsonify({'error': 'Dataset not found.'}), 404

        dataset = dataset_doc.to_dict()
        dataset_name = dataset.get('name', 'Unnamed Dataset')
        logging.info(f"Found dataset '{dataset_name}' with ID '{dataset_id}'.")

        # Optional: Remove sensitive information if necessary
        dataset.pop('creator_uid', None)

        # Fetch games within this dataset from 'datasets/{dataset_id}/games'
        games_ref = db.collection('datasets').document(dataset_id).collection('games')
        games_snapshot = games_ref.stream()

        games = []
        for game_doc in games_snapshot:
            game_data = game_doc.to_dict()
            game_name = game_doc.id
            match_date = game_data.get('matchDate')
            sport = game_data.get('sport')
            game_actions = game_data.get('gameData', [])

            game_info = {
                'gameName': game_name,
                'matchDate': match_date,
                'sport': sport,
                'gameData': game_actions
            }

            games.append(game_info)

        # Check if any games were found
        if not games:
            logging.warning(f"No games found under dataset '{dataset_name}' (ID: {dataset_id}) for download.")
            return jsonify({'error': f"No games found under dataset '{dataset_name}'."}), 404

        # Prepare JSON data for download
        download_data = {
            'dataset': dataset,
            'games': games
        }

        # Serialize the data to JSON, using firestore_to_json to handle datetime fields
        json_data = json.dumps(download_data, default=firestore_to_json, indent=2)

        # Create response with JSON data as a file attachment
        response = make_response(json_data)
        response.headers['Content-Disposition'] = f'attachment; filename={dataset_name.replace(" ", "_")}_data.json'
        response.mimetype = 'application/json'

        logging.info(f"Dataset '{dataset_id}' downloaded successfully with {len(games)} games.")
        return response

    except Exception as e:
        logging.error(f"Error downloading dataset '{dataset_id}': {str(e)}")
        return jsonify({'error': 'An error occurred while downloading the dataset.'}), 500

@app.route('/sample-dataset', methods=['POST'])
def sample_dataset():
    try:
        data = request.json  # Get JSON data from the request
        dataset_id = data.get('datasetId')  # Extract datasetId
        
        if not dataset_id:
            logging.error("Dataset ID not provided for sample request.")
            return jsonify({'error': 'Dataset ID is required.'}), 400
        
        # Fetch the dataset from Firestore
        dataset_doc = db.collection('datasets').document(dataset_id).get()
        if not dataset_doc.exists:
            logging.error(f"Dataset '{dataset_id}' not found.")
            return jsonify({'error': 'Dataset not found.'}), 404
        
        dataset = dataset_doc.to_dict()
        dataset_name = dataset.get('name')
        
        if not dataset_name:
            logging.error(f"Dataset '{dataset_id}' does not have a 'name' field.")
            return jsonify({'error': "Dataset does not have a 'name' field."}), 400
        
        # Fetch games associated with this dataset from 'datasets/{dataset_id}/games'
        games = []
        games_ref = db.collection('datasets').document(dataset_id).collection('games')
        games_snapshot = games_ref.stream()
        for game_doc in games_snapshot:
            game_data = game_doc.to_dict()
            actions = game_data.get('gameData', [])
            if isinstance(actions, list):
                games.extend(actions)
            else:
                games.append(actions)
        
        if not games:
            logging.warning(f"No games found under dataset '{dataset_name}' for sampling.")
            return jsonify({'sample': []}), 200  # Return empty sample
        
        # Determine the number of samples you want to return
        sample_size = min(10, len(games))  # For example, 10 samples or fewer if not enough games
        sample_actions = random.sample(games, sample_size)  # Randomly select sample_size actions
        
        logging.info(f"Returning {len(sample_actions)} sample actions for dataset '{dataset_name}'.")
        return jsonify({'sample': sample_actions}), 200
    
    except Exception as e:
        logging.error(f"Error in sample_dataset endpoint: {str(e)}")
        return jsonify({'error': 'An error occurred while fetching the dataset sample.'}), 500

def firestore_to_json(obj):
    """Custom JSON serializer for Firestore datetime fields."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

@app.route('/delete-published-dataset', methods=['POST'])
def delete_published_dataset():
    try:
        data = request.json  # Get the JSON data from the request
        uid = data.get('uid')  # Extract the user ID
        dataset_id = data.get('datasetId')  # Extract the dataset ID

        # Validate that UID and dataset ID are provided
        if not uid or not dataset_id:
            logging.error("UID or datasetId not provided for dataset deletion.")
            return jsonify({'error': 'UID and datasetId are required.'}), 400

        # Fetch the dataset document from Firestore
        dataset_doc = db.collection('datasets').document(dataset_id).get()
        if not dataset_doc.exists:
            logging.warning(f"Dataset '{dataset_id}' not found.")
            return jsonify({'error': 'Dataset not found.'}), 404

        dataset = dataset_doc.to_dict()

        # Verify that the requesting user is the creator of the dataset
        creator_uid = dataset.get('creator_uid')
        if creator_uid != uid:
            logging.warning(f"User '{uid}' attempted to delete dataset '{dataset_id}' not owned by them.")
            return jsonify({'error': 'Unauthorized access. You can only delete your own datasets.'}), 403

        # Delete the dataset document
        db.collection('datasets').document(dataset_id).delete()
        logging.info(f"Dataset '{dataset_id}' deleted by user '{uid}'.")

        return jsonify({'success': True, 'message': 'Dataset deleted successfully.'}), 200

    except Exception as e:
        logging.error(f"Error deleting published dataset: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/list-published-datasets', methods=['POST'])
def list_published_datasets():
    try:
        data = request.json
        uid = data.get('uid')
        
        if not uid:
            logging.error("UID not provided for listing published datasets.")
            return jsonify({'error': 'UID is required.'}), 400

        datasets_ref = db.collection('datasets').where('creator_uid', '==', uid)
        datasets_snapshot = datasets_ref.stream()

        dataset_names = [doc.to_dict().get('name') for doc in datasets_snapshot]

        logging.info(f"Listed published datasets for user {uid}: {dataset_names}")
        return jsonify({'datasets': dataset_names}), 200
    except Exception as e:
        logging.error(f"Error listing published datasets: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/get-dataset-details', methods=['POST'])
def get_dataset_details():
    try:
        data = request.json
        dataset_name = data.get('datasetName')
        uid = data.get('uid')

        if not dataset_name or not uid:
            logging.error("Dataset name or UID not provided for fetching details.")
            return jsonify({'error': 'Dataset name and UID are required.'}), 400

        # Fetch the dataset document from Firestore
        datasets_ref = db.collection('datasets')
        query = datasets_ref.where('name', '==', dataset_name).where('creator_uid', '==', uid).limit(1)
        docs = query.stream()
        dataset_doc = next(docs, None)

        if not dataset_doc:
            logging.error(f"Dataset '{dataset_name}' not found for user '{uid}'.")
            return jsonify({'error': 'Dataset not found.'}), 404

        dataset = dataset_doc.to_dict()
        dataset['id'] = dataset_doc.id

        return jsonify(dataset), 200

    except Exception as e:
        logging.error(f"Error fetching dataset details: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/update-dataset', methods=['POST'])
def update_dataset():
    try:
        data = request.json
        dataset_name = data.get('datasetName')
        name = data.get('name')
        description = data.get('description')
        preview_snippet = data.get('preview_snippet')
        category = data.get('category')
        uid = data.get('uid')

        if not all([dataset_name, name, description, category, uid]):
            logging.error("Incomplete dataset update data provided.")
            return jsonify({'error': 'All fields are required.'}), 400

        # Fetch the dataset document from Firestore
        datasets_ref = db.collection('datasets')
        query = datasets_ref.where('name', '==', dataset_name).where('creator_uid', '==', uid).limit(1)
        docs = query.stream()
        dataset_doc = next(docs, None)

        if not dataset_doc:
            logging.error(f"Dataset '{dataset_name}' not found for user '{uid}'.")
            return jsonify({'error': 'Dataset not found.'}), 404

        dataset_id = dataset_doc.id

        # Update the dataset document
        dataset_ref = db.collection('datasets').document(dataset_id)
        dataset_ref.update({
            'name': name,
            'description': description,
            'preview_snippet': preview_snippet,
            'category': category,
            'updated_at': firestore.SERVER_TIMESTAMP
        })

        # Sync the games from 'savedGames' to 'datasets/{dataset_id}/games'
        # First, delete existing games in the dataset's 'games' subcollection
        games_ref = dataset_ref.collection('games')
        games_docs = games_ref.stream()
        for game_doc in games_docs:
            game_doc.reference.delete()

        # Copy current games from user's 'savedGames' collection
        user_games_ref = db.collection('savedGames').document(uid).collection('games').where('datasetName', '==', dataset_name)
        user_games_docs = user_games_ref.stream()
        batch = db.batch()
        for game_doc in user_games_docs:
            game_data = game_doc.to_dict()
            # Remove any user-specific data if necessary
            # game_data.pop('some_user_field', None)

            # Write to 'datasets/{dataset_id}/games/{game_doc.id}'
            new_game_ref = dataset_ref.collection('games').document(game_doc.id)
            batch.set(new_game_ref, game_data)

        # Commit the batch write
        batch.commit()

        logging.info(f"Dataset '{dataset_id}' updated by user '{uid}' with new games.")
        return jsonify({'success': True, 'message': 'Dataset updated successfully.'}), 200

    except Exception as e:
        logging.error(f"Error updating dataset: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/sitemap.xml')
def sitemap():
    response = make_response(send_from_directory('static', 'sitemap.xml'))
    response.headers['Content-Type'] = 'application/xml'
    return response

# --- Helper function ---

# ---------------------------
# Endpoint: /recalculate-target-xpoints
# ---------------------------
import requests
import json
import time
import pandas as pd
import matplotlib.pyplot as plt
from tabulate import tabulate

@app.route('/recalculate-target-xpoints', methods=['POST'])
def recalculate_target_xpoints():
    """
    Recalculate xPoints (xP) and xGoals (xG) for a target dataset with custom GAA scoring.

    2025-05-07 patch-7
    ──────────────────
    • Added goal calibration factor (0.355) to reduce overprediction
    • Implemented custom GAA scoring system (3 for goal, 2 for point outside 40m, 1 for point inside 40m)
    • Added accuracy evaluation metrics
    • Added Firestore update to save calculated values back to database
    • Fixed dimension mismatch in SMOTE by aligning train data properly
    • Refactored build function to accept both X and y parameters
    • Replaced unicode column labels with ASCII "p_mean / g_mean"
    """

    # ---------- std imports ----------
    import os, time, joblib, logging, re
    import numpy as np
    import pandas as pd
    from sklearn.ensemble import GradientBoostingClassifier, VotingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import (accuracy_score, roc_auc_score, brier_score_loss,
                                log_loss, precision_score, recall_score, f1_score,
                                confusion_matrix, classification_report)
    from sklearn.calibration import CalibratedClassifierCV
    from imblearn.over_sampling import SMOTE
    import matplotlib.pyplot as plt
    from sklearn.calibration import calibration_curve
    import json

    # ---------- fire up ----------
    body      = request.get_json(force=True)
    uid       = body.get("user_id")
    train_ds  = body.get("training_dataset", "GAA All Shots")
    target_ds = body.get("target_dataset")
    use_cache = body.get("use_cached_model", True)

    # ---------- Constants ----------
    GOAL_X, GOAL_Y = 145.0, 44.0
    GOAL_CALIBRATION_FACTOR = 0.355  # Apply 0.355 factor to reduce goal overprediction
    start_time     = time.time()

    if not uid or not target_ds:
        return jsonify({"error": "user_id and target_dataset are required"}), 400

    # ---------- utility helpers ----------
    def flatten(games):
        return [s for g in games for s in g.get("gameData", [])]

    def mirror(df):
        half = GOAL_X / 2.0
        left = df["x"] < half
        df.loc[left, "x"] = GOAL_X - df.loc[left, "x"]
        df.loc[left, "y"] = 2 * GOAL_Y - df.loc[left, "y"]
        return df

    def geom(df):
        df["dist_to_goal"]    = np.hypot(GOAL_X - df["x"], GOAL_Y - df["y"])
        df["shot_angle"]      = np.degrees(np.arctan2(GOAL_Y - df["y"],
                                                      GOAL_X - df["x"]))
        df["shot_angle_abs"]  = df["shot_angle"].abs()

    def buckets(df):
        df["distance_zone"] = pd.cut(
            df["dist_to_goal"], [0,15,30,45,60,100,np.inf],
            labels=False, include_lowest=True, right=False
        ).astype("Int64").fillna(5).astype(int)
        df["angle_zone"] = pd.cut(
            df["shot_angle_abs"], [0,15,30,45,60,90,np.inf],
            labels=False, include_lowest=True, right=False
        ).astype("Int64").fillna(5).astype(int)

    # ---------- evaluate model accuracy ----------
    def evaluate_model(X_test, y_test, model, model_name="Model"):
        # Get predictions
        y_pred_proba = model.predict_proba(X_test)[:,1]
        y_pred = (y_pred_proba >= 0.5).astype(int)
        
        # Calculate metrics
        acc = accuracy_score(y_test, y_pred)
        auc = roc_auc_score(y_test, y_pred_proba)
        brier = brier_score_loss(y_test, y_pred_proba)
        logloss = log_loss(y_test, y_pred_proba)
        
        prec = precision_score(y_test, y_pred, zero_division=0)
        rec = recall_score(y_test, y_pred, zero_division=0)
        f1 = f1_score(y_test, y_pred, zero_division=0)
        
        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        tn, fp, fn, tp = cm.ravel()
        
        # Print results
        print(f"\n{model_name} Evaluation Metrics:")
        print(f"Accuracy:       {acc:.4f}")
        print(f"AUC:            {auc:.4f}")
        print(f"Brier Score:    {brier:.4f}")
        print(f"Log Loss:       {logloss:.4f}")
        print(f"Precision:      {prec:.4f}")
        print(f"Recall:         {rec:.4f}")
        print(f"F1 Score:       {f1:.4f}")
        print(f"Confusion Matrix: \n{cm}")
        
        # Detailed classification report
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred, zero_division=0))
        
        return {
            "accuracy": float(acc),
            "auc": float(auc),
            "brier_score": float(brier),
            "log_loss": float(logloss),
            "precision": float(prec),
            "recall": float(rec),
            "f1": float(f1),
            "tn": int(tn),
            "fp": int(fp),
            "fn": int(fn),
            "tp": int(tp)
        }

    FEATURES = [
        "x","y","dist_to_goal","shot_angle","shot_angle_abs",
        "dist_squared","dist_angle_interaction","is_setplay",
        "pressure_value","position_value","distance_zone","angle_zone",
        "dist_to_sideline","player_point_rate","player_goal_rate"
    ]

    # ---------- banner ----------
    print("\n" + "="*70)
    print("STARTING ENHANCED xP/xG CALCULATION")
    print("="*70)
    print(f"User ID         : {uid}")
    print(f"Training dataset: {train_ds}")
    print(f"Target dataset  : {target_ds}")
    print("="*70 + "\n")

    # ---------- try cached ----------
    cache_doc = db.collection("modelCache").document(f"{uid}_{train_ds}").get()
    cached_ok = False
    model_metrics = None
    
    if use_cache and cache_doc.exists:
        meta = cache_doc.to_dict()
        base = meta.get("model_path")
        scale = meta.get("scaler_path")
        if base and scale and all(os.path.exists(x)
                                for x in [base+"_points", base+"_goals", scale]):
            points_model = joblib.load(base + "_points")
            goals_model = joblib.load(base + "_goals")
            scaler = joblib.load(scale)
            if getattr(scaler, "n_features_in_", None) == len(FEATURES):
                cached_ok = True
                print(f"Using cached model from {base}")
                # Load metrics if they exist
                if os.path.exists(base+"_metrics.json"):
                    with open(base+"_metrics.json", 'r') as f:
                        model_metrics = json.load(f)
                        print("Loaded cached model metrics")
            else:
                print("Cached scaler dimension mismatch – will retrain")

    # ---------- train if needed ----------
    df_train = pd.DataFrame()
    if not cached_ok:
        print("Training new models …")

        train_games = db.collection("savedGames").document(uid) \
                        .collection("games") \
                        .where("datasetName","==",train_ds).stream()
        train_games_data = [g.to_dict() for g in train_games]
        df_train = pd.DataFrame(flatten(train_games_data))
        
        if df_train.empty:
            return jsonify({"error":"No training data found"}), 404

        # numeric clean & mirror
        df_train["x"] = pd.to_numeric(df_train["x"], errors="coerce").fillna(0)
        df_train["y"] = pd.to_numeric(df_train["y"], errors="coerce").fillna(0)
        mirror(df_train)
        goal_out = {'goal','scores goal','made goal','hit goal','penalty goal'}
        point_out = {'point','over','scores point','made point',
                    'offensive mark','fortyfive','free'}
        df_train["target_points"] = df_train["action"].str.lower().str.strip().isin(point_out).astype(int)
        df_train["target_goals"] = df_train["action"].str.lower().str.strip().isin(goal_out).astype(int)

        geom(df_train)
        buckets(df_train)

        df_train["dist_squared"] = df_train["dist_to_goal"]**2
        df_train["dist_angle_interaction"] = df_train["dist_to_goal"]*df_train["shot_angle_abs"]
        df_train["dist_to_sideline"] = (df_train["y"]-44).abs()
        df_train["is_setplay"] = df_train["action"].str.lower().str.contains(
                                            r"free|fortyfive|penalty|offensive mark").astype(int)
        press_map = {'none':0,'low':.33,'medium':.67,'high':1.0}
        pos_map = {'goalkeeper':0,'back':1,'midfielder':2,'forward':3}
        df_train["pressure_value"] = df_train["pressure"].str.lower().map(press_map).fillna(0)
        df_train["position_value"] = df_train["position"].str.lower().map(pos_map).fillna(2)

        # player priors (ASCII labels)
        pri_p = df_train["target_points"].mean(); k=10
        pri_g = df_train["target_goals"].mean()
        if "playerName" in df_train.columns:
            hist = df_train.groupby("playerName").agg(
                    n = ("target_points","count"),
                    p_mean = ("target_points","mean"),
                    g_mean = ("target_goals","mean")
                ).reset_index()
            hist["player_point_rate"] = (hist["p_mean"]*hist["n"] + pri_p*k)/(hist["n"]+k)
            hist["player_goal_rate"] = (hist["g_mean"]*hist["n"] + pri_g*k)/(hist["n"]+k)
            df_train = df_train.merge(
                hist[["playerName","player_point_rate","player_goal_rate"]],
                on="playerName", how="left")
        df_train["player_point_rate"] = df_train["player_point_rate"].fillna(0.5)
        df_train["player_goal_rate"] = df_train["player_goal_rate"].fillna(0.1)

        # train/scale
        X = df_train[FEATURES].values
        yP = df_train["target_points"].values
        yG = df_train["target_goals"].values
        scaler = StandardScaler().fit(X)
        Xs = scaler.transform(X)
        Xtr, Xte, yPtr, yPte, yGtr, yGte = train_test_split(
            Xs, yP, yG, test_size=0.25, random_state=42, stratify=yP)

        # Build function accepts both X and y
        def build(X, y):
            if np.min(np.bincount(y)) / np.max(np.bincount(y)) < 0.3:
                X_resampled, y_resampled = SMOTE(random_state=42).fit_resample(X, y)
            else:
                X_resampled, y_resampled = X, y
                
            lr = LogisticRegression(max_iter=1000, class_weight='balanced', random_state=42)
            gb = GradientBoostingClassifier(n_estimators=120, learning_rate=.08,
                                            max_depth=3, random_state=42)
                                            
            # Create the ensemble and fit it with the properly matched data
            ens = VotingClassifier([("lr", lr), ("gb", gb)], voting="soft")
            ens.fit(X_resampled, y_resampled)
                        
            # Create calibrated model and fit it with the SAME data
            cal = CalibratedClassifierCV(ens, method="isotonic", cv="prefit")
            return cal.fit(X_resampled, y_resampled)  # Use the same data here

        points_model = build(Xtr, yPtr)
        goals_model = build(Xtr, yGtr)

        # Evaluate the models on test data
        metrics = {
            "points_model": evaluate_model(Xte, yPte, points_model, "Points Model"),
            "goals_model": evaluate_model(Xte, yGte, goals_model, "Goals Model"),
            "training_samples": len(yPtr),
            "testing_samples": len(yPte),
            "points_distribution": {"positive": int(yP.sum()), "negative": int(len(yP) - yP.sum())},
            "goals_distribution": {"positive": int(yG.sum()), "negative": int(len(yG) - yG.sum())}
        }
        model_metrics = metrics

        # save cache
        model_dir = f"models/{uid}"; os.makedirs(model_dir, exist_ok=True)
        base = f"{model_dir}/{train_ds.replace(' ','_')}"
        joblib.dump(points_model, base+"_points")
        joblib.dump(goals_model, base+"_goals")
        joblib.dump(scaler, base+"_scaler.joblib")
        
        # Save metrics
        with open(base+"_metrics.json", 'w') as f:
            json.dump(metrics, f, indent=2)
            
        db.collection("modelCache").document(f"{uid}_{train_ds}").set({
            "model_path": base, 
            "scaler_path": base+"_scaler.joblib",
            "created_at": firestore.SERVER_TIMESTAMP
        })
        print(f"Saved new models to {base}")

    # ---------- target data ----------
    tgt_games_ref = db.collection("savedGames").document(uid) \
                  .collection("games") \
                  .where("datasetName", "==", target_ds)
    tgt_games = list(tgt_games_ref.stream())
    
    if not tgt_games:
        return jsonify({"error":"No target data found"}), 404
        
    # Store original game references for later update
    original_games = []
    for doc in tgt_games:
        game_data = doc.to_dict()
        original_games.append({
            'doc_ref': doc.reference,
            'doc_id': doc.id,
            'game_data': game_data.get('gameData', [])
        })
    
    df_target = pd.DataFrame(flatten([g.to_dict() for g in tgt_games]))

    df_target["x"] = pd.to_numeric(df_target["x"], errors="coerce").fillna(0)
    df_target["y"] = pd.to_numeric(df_target["y"], errors="coerce").fillna(0)
    mirror(df_target); geom(df_target); buckets(df_target)
    df_target["dist_squared"] = df_target["dist_to_goal"]**2
    df_target["dist_angle_interaction"] = df_target["dist_to_goal"]*df_target["shot_angle_abs"]
    df_target["dist_to_sideline"] = (df_target["y"]-44).abs()
    df_target["is_setplay"] = df_target["action"].str.lower().str.contains(
                                        r"free|fortyfive|penalty|offensive mark").astype(int)
    press_map = {'none':0,'low':.33,'medium':.67,'high':1.0}
    pos_map = {'goalkeeper':0,'back':1,'midfielder':2,'forward':3}
    df_target["pressure_value"] = df_target["pressure"].str.lower().map(press_map).fillna(0)
    df_target["position_value"] = df_target["position"].str.lower().map(pos_map).fillna(2)

    # Handle player statistics - ensure we create the columns if they don't exist
    df_target["player_point_rate"] = 0.5  # Default value
    df_target["player_goal_rate"] = 0.1   # Default value
    
    # Try to merge with training data player stats if available
    if not df_train.empty and "playerName" in df_train.columns:
        player_stats = df_train[["playerName", "player_point_rate", "player_goal_rate"]].drop_duplicates()
        if not player_stats.empty and "playerName" in df_target.columns:
            df_target = df_target.merge(
                player_stats,
                on="playerName", 
                how="left",
                suffixes=('', '_new')
            )
            # Update only if we got new values
            if "player_point_rate_new" in df_target.columns:
                df_target.loc[~df_target["player_point_rate_new"].isna(), "player_point_rate"] = \
                    df_target.loc[~df_target["player_point_rate_new"].isna(), "player_point_rate_new"]
                df_target = df_target.drop("player_point_rate_new", axis=1)
            
            if "player_goal_rate_new" in df_target.columns:
                df_target.loc[~df_target["player_goal_rate_new"].isna(), "player_goal_rate"] = \
                    df_target.loc[~df_target["player_goal_rate_new"].isna(), "player_goal_rate_new"]
                df_target = df_target.drop("player_goal_rate_new", axis=1)

    # Make predictions
    X_tar = scaler.transform(df_target[FEATURES])
    df_target["xPoints"] = points_model.predict_proba(X_tar)[:,1]
    df_target["xGoals_raw"] = goals_model.predict_proba(X_tar)[:,1]
    
    # Apply calibration factor to goals
    df_target["xGoals"] = df_target["xGoals_raw"] * GOAL_CALIBRATION_FACTOR
    
    # ---- CUSTOM GAA SCORING SYSTEM ----
    # Add column to identify shots outside 40m
    df_target["is_outside_40m"] = (df_target["dist_to_goal"] > 40.0).astype(int)
    
    # Calculate xP_adv using custom scoring:
    # - 3 points for a goal
    # - 2 points for a point scored outside 40m
    # - 1 point for a point scored inside 40m
    df_target["xPoints_value"] = df_target["xPoints"] * (1.0 + df_target["is_outside_40m"])
    df_target["xP_adv"] = df_target["xPoints_value"] + df_target["xGoals"] * 3.0

    # Create a mapping to update original data
    # We need to keep track of which shot in which game
    shot_idx = 0
    for g_idx, game in enumerate(original_games):
        for s_idx, _ in enumerate(game['game_data']):
            if shot_idx < len(df_target):
                # Get values for this shot
                xPoints = float(df_target.iloc[shot_idx]['xPoints'])
                xGoals_raw = float(df_target.iloc[shot_idx]['xGoals_raw'])
                xGoals = float(df_target.iloc[shot_idx]['xGoals'])
                is_outside_40m = float(df_target.iloc[shot_idx]['is_outside_40m'])
                
                # Use custom scoring system for xP_adv
                xPoints_value = xPoints * (1.0 + is_outside_40m)  # 1 or 2 points based on distance
                xP_adv = xPoints_value + xGoals * 3.0
                
                # Update the shot with new xP values
                original_games[g_idx]['game_data'][s_idx]['xPoints'] = xPoints
                original_games[g_idx]['game_data'][s_idx]['xGoals_raw'] = xGoals_raw
                original_games[g_idx]['game_data'][s_idx]['xGoals'] = xGoals
                original_games[g_idx]['game_data'][s_idx]['xP_adv'] = xP_adv
                
                # Add distance-based fields for reference
                original_games[g_idx]['game_data'][s_idx]['is_outside_40m'] = bool(is_outside_40m)
                original_games[g_idx]['game_data'][s_idx]['xPoints_value'] = xPoints_value
                original_games[g_idx]['game_data'][s_idx]['goal_calibration_factor'] = GOAL_CALIBRATION_FACTOR
                
                shot_idx += 1

    # Write updated data back to Firestore
    batch = db.batch()
    try:
        for game in original_games:
            doc_ref = game['doc_ref']
            batch.update(doc_ref, {'gameData': game['game_data']})
        batch.commit()
        print(f"Updated {shot_idx} shots in Firestore across {len(original_games)} games")
    except Exception as e:
        print(f"Error updating Firestore: {e}")
        return jsonify({"error": f"Failed to update Firestore: {str(e)}"}), 500

    # Calculate actual vs expected stats for target dataset if outcome data is available
    accuracy_stats = None
    if "action" in df_target.columns:
        goal_out = {'goal','scores goal','made goal','hit goal','penalty goal'}
        point_out = {'point','over','scores point','made point',
                    'offensive mark','fortyfive','free'}
        
        # Calculate actual outcomes
        df_target["actual_points"] = df_target["action"].str.lower().str.strip().isin(point_out).astype(int)
        df_target["actual_goals"] = df_target["action"].str.lower().str.strip().isin(goal_out).astype(int)
        
        # Apply custom scoring system to actual outcomes
        df_target["actual_points_value"] = df_target["actual_points"] * (1.0 + df_target["is_outside_40m"])
        df_target["actual_total_value"] = df_target["actual_points_value"] + df_target["actual_goals"] * 3.0
        
        # Calculate expected vs actual using custom scoring
        total_points_expected = df_target["xPoints_value"].sum()
        total_points_actual = df_target["actual_points_value"].sum()
        
        total_goals_raw_expected = df_target["xGoals_raw"].sum() * 3.0  # 3 points per goal (raw)
        total_goals_expected = df_target["xGoals"].sum() * 3.0  # 3 points per goal (calibrated)
        total_goals_actual = df_target["actual_goals"].sum() * 3.0  # 3 points per goal
        
        total_value_expected = df_target["xP_adv"].sum()
        total_value_actual = df_target["actual_total_value"].sum()
        
        points_delta = total_points_actual - total_points_expected
        goals_raw_delta = total_goals_actual - total_goals_raw_expected
        goals_delta = total_goals_actual - total_goals_expected
        total_delta = total_value_actual - total_value_expected
        
        # Calculate accuracy if we have enough data
        if len(df_target) >= 10:
            accuracy_stats = {
                "points": {
                    "expected": float(total_points_expected),
                    "actual": float(total_points_actual),
                    "delta": float(points_delta),
                    "delta_pct": float(points_delta / max(total_points_expected, 0.001) * 100)
                },
                "goals": {
                    "expected_raw": float(total_goals_raw_expected),
                    "expected_calibrated": float(total_goals_expected),
                    "actual": float(total_goals_actual),
                    "delta_raw": float(goals_raw_delta),
                    "delta": float(goals_delta),
                    "delta_pct": float(goals_delta / max(total_goals_expected, 0.001) * 100),
                    "calibration_factor": float(GOAL_CALIBRATION_FACTOR)
                },
                "total": {
                    "expected": float(total_value_expected),
                    "actual": float(total_value_actual),
                    "delta": float(total_delta),
                    "delta_pct": float(total_delta / max(total_value_expected, 0.001) * 100)
                },
                "scoring_system": {
                    "goal_points": 3,
                    "point_inside_40m": 1,
                    "point_outside_40m": 2
                },
                "shot_count": len(df_target),
                "outside_40m_count": int(df_target["is_outside_40m"].sum())
            }
            
            print("\nTarget Dataset Accuracy (Custom GAA Scoring):")
            print(f"Points: Expected={total_points_expected:.2f}, Actual={total_points_actual:.1f}, Delta={points_delta:.2f}")
            print(f"Goals (Raw x3): Expected={total_goals_raw_expected:.2f}, Actual={total_goals_actual:.1f}, Delta={goals_raw_delta:.2f}")
            print(f"Goals (Calibrated x3): Expected={total_goals_expected:.2f}, Actual={total_goals_actual:.1f}, Delta={goals_delta:.2f}")
            print(f"Total Value: Expected={total_value_expected:.2f}, Actual={total_value_actual:.1f}, Delta={total_delta:.2f}")
            print(f"Outside 40m shots: {df_target['is_outside_40m'].sum()} of {len(df_target)} ({df_target['is_outside_40m'].mean()*100:.1f}%)")

    summary = {
        "totalShots": int(len(df_target)),
        "xPointsTotal": float(df_target["xPoints"].sum()),
        "xPointsValueTotal": float(df_target["xPoints_value"].sum()),
        "xGoalsRawTotal": float(df_target["xGoals_raw"].sum()),
        "xGoalsTotal": float(df_target["xGoals"].sum()),
        "xP_advTotal": float(df_target["xP_adv"].sum()),
        "outside_40m_pct": float(df_target["is_outside_40m"].mean()),
        "processing_s": round(time.time()-start_time, 2),
        "model_metrics": model_metrics,
        "accuracy_stats": accuracy_stats,
        "scoring_system": {
            "goal_points": 3,
            "point_inside_40m": 1,
            "point_outside_40m": 2,
            "goal_calibration_factor": float(GOAL_CALIBRATION_FACTOR)
        }
    }
    
    print(f"Finished in {summary['processing_s']} s "
          f"({summary['totalShots']} shots processed)")

    return jsonify({"success": True, "summary": summary}), 200

"""
Full “recalculate_xpoints” endpoint – maximum-accuracy GAA xPoints / xGoals model
"""

import time, logging, traceback
import numpy as np
import pandas as pd

from flask import jsonify, request
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV
from sklearn.cluster import KMeans
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, brier_score_loss, f1_score,
    precision_score, recall_score, roc_auc_score,
    silhouette_score
)
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.preprocessing import StandardScaler

from imblearn.over_sampling import SMOTE

GOAL_CALIBRATION_FACTOR  = 0.95
MIN_SAMPLES_FOR_MODELING = 100
CV_FOLDS                 = 5
RANDOM_STATE             = 42


def bayesian_smoothing(success, total, prior, k, *, min_samples=5):
    if total < min_samples:
        return prior
    k_adj = k * (1 - min(0.9, total / 100))
    return (success + prior * k_adj) / (total + k_adj)


def optimal_threshold(y, p, *, default=0.5):
    if len(y) < 10 or len(np.unique(y)) < 2:
        return default
    th = np.linspace(0.1, 0.9, 100)
    scores = [f1_score(y, (p >= t).astype(int), zero_division=0) for t in th]
    return float(th[int(np.argmax(scores))])


def ensemble_probs(X, models, weights):
    if not models:
        return np.full(len(X), 0.5)
    preds = [
        np.nan_to_num(
            m.predict_proba(X)[:, 1] if hasattr(m, "predict_proba") else m.predict(X).astype(float),
            nan=0.5,
            posinf=1.0,
            neginf=0.0,
        )
        for m in models
    ]
    if len(weights) != len(preds):
        weights = [1 / len(preds)] * len(preds)
    out = np.zeros(len(X))
    for w, p in zip(weights, preds):
        out += w * p
    return np.clip(out, 0, 1)


def metrics(y, p, th):
    y_hat = (p >= th).astype(int)
    return dict(
        accuracy=float(accuracy_score(y, y_hat)),
        precision=float(precision_score(y, y_hat, zero_division=0)),
        recall=float(recall_score(y, y_hat, zero_division=0)),
        f1=float(f1_score(y, y_hat, zero_division=0)),
        roc_auc=float(roc_auc_score(y, p) if len(np.unique(y)) > 1 else 0.0),
        brier=float(brier_score_loss(y, p)),
    )


def scale(X_train, X_test):
    sc = StandardScaler().fit(X_train)
    return sc, sc.transform(X_train), sc.transform(X_test)


def make_folds(X, y, n=CV_FOLDS):
    if len(X) <= 20 or len(np.unique(y)) < 2:
        return None
    n = max(2, min(n, len(X) // 10))
    return list(StratifiedKFold(n, shuffle=True, random_state=RANDOM_STATE).split(X, y))


def train_cv(X_train, y_train, X_val=None, y_val=None, cv=None):
    lr = LogisticRegression(
        C=0.8,
        class_weight="balanced",
        max_iter=1000,
        random_state=RANDOM_STATE,
        solver="liblinear",
    )
    gbc = GradientBoostingClassifier(
        n_estimators=150,
        learning_rate=0.05,
        max_depth=3,
        min_samples_split=20,
        subsample=0.8,
        random_state=RANDOM_STATE,
    )
    rf = RandomForestClassifier(
        n_estimators=100,
        max_depth=4,
        min_samples_leaf=5,
        class_weight="balanced",
        random_state=RANDOM_STATE,
        bootstrap=True,
        max_features="sqrt",
    )
    base = dict(lr=lr, gbc=gbc, rf=rf)
    oof = {k: np.zeros(len(X_train)) for k in base}

    if cv:
        for tr_idx, vl_idx in cv:
            for name, mdl in base.items():
                m = clone(mdl).fit(X_train[tr_idx], y_train[tr_idx])
                oof[name][vl_idx] = m.predict_proba(X_train[vl_idx])[:, 1]

    for m in base.values():
        m.fit(X_train, y_train)

    cal = {
        n: CalibratedClassifierCV(b, "isotonic", cv="prefit").fit(X_train, y_train)
        for n, b in base.items()
    }

    scores = {}
    for n, o in oof.items():
        if not o.any():
            o = cal[n].predict_proba(X_train)[:, 1]
        scores[n] = brier_score_loss(y_train, o)

    if X_val is not None and len(X_val):
        for n in cal:
            scores[n] = 0.3 * scores[n] + 0.7 * brier_score_loss(
                y_val, cal[n].predict_proba(X_val)[:, 1]
            )

    inv_sum = sum(1 / s for s in scores.values()) or 1.0
    weights = [(1 / s) / inv_sum for s in scores.values()]
    ensemble_pred = sum(weights[i] * oof[n] for i, n in enumerate(base))
    threshold = optimal_threshold(y_train, ensemble_pred)
    return dict(base=base, cal=cal, w=weights, th=threshold)


import os, time, joblib, logging, re
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (accuracy_score, roc_auc_score, brier_score_loss,
                           log_loss, precision_score, recall_score, f1_score,
                           confusion_matrix, classification_report, r2_score)
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.feature_selection import RFE
from imblearn.over_sampling import SMOTE
from imblearn.pipeline import Pipeline as ImbPipeline
import matplotlib.pyplot as plt
# Removing seaborn dependency
# import seaborn as sns
from sklearn.inspection import permutation_importance


@app.route("/recalculate-xpoints", methods=["POST"])
def recalculate_xpoints():
    """
    Maximum-accuracy xPoints calculation with state-of-the-art sports analytics techniques.
    Uses a unified model approach where set plays are integrated directly into the primary model.
    """
    import numpy as np
    import pandas as pd
    from sklearn.linear_model import LogisticRegression
    from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split, StratifiedKFold
    from sklearn.metrics import (accuracy_score, precision_score, recall_score, f1_score, 
                              roc_auc_score, brier_score_loss, confusion_matrix, log_loss,
                              roc_curve)
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.cluster import KMeans
    import logging
    import time
    
    start_time = time.time()
    
    data = request.get_json() or {}
    USER_ID = data.get("user_id", "w9ZkqaYVM3dKSqqjWHLDVyh5sVg2")
    DATASET_NAME = data.get("dataset_name", "GAA All Shots")

    try:
        logging.info(f"=== xPoints calculation start | user={USER_ID} | dataset={DATASET_NAME}")

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

        goal_out = {"goal", "scores goal", "made goal", "hit goal", "penalty goal"}
        point_out = {"point", "over", "scores point", "made point", "offensive mark", 
                    "fortyfive", "free", "point scored", "free scored"}
        miss_out = {"miss", "wide", "short", "blocked", "saved", "hit post", "hit crossbar"}

        rows, outcome_counts = [], {"goal": 0, "point": 0, "miss": 0}
        for gi, g in enumerate(originals):
            for si, s in enumerate(g["gameData"]):
                action_raw = (s.get("Outcome") or s.get("action") or "").lower().strip()
                
                if any(term in action_raw for term in goal_out):
                    cat = "goal"
                elif any(term in action_raw for term in point_out):
                    cat = "point"
                else:
                    cat = "miss"
                    
                outcome_counts[cat] += 1
                
                try:
                    sx = float(s.get("x", 0))
                    sy = float(s.get("y", 0))
                except (ValueError, TypeError):
                    sx, sy = 0, 0
                
                dist_to_goal = ((145 - sx) ** 2 + (44 - sy) ** 2) ** 0.5
                
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
                    "position": (s.get("position") or "unknown").lower()
                }
                rows.append(row)

        df = pd.DataFrame(rows)
        logging.info(f"DataFrame shape {df.shape}")

        df["point_value"] = np.where(df["dist"] > 40, 2, 1)
        
        df["Score_Points"] = np.where(
            (df["cat"] == "point") & (df["dist"] > 40), 2,
            np.where(df["cat"] == "point", 1, 0)
        )
        df["Score_Goals"] = (df["cat"] == "goal").astype(int)
        df["Score_Binary_Points"] = (df["cat"] == "point").astype(int)
        
        df["Shot_Angle"] = np.degrees(np.arctan2(44 - df["y"], 145 - df["x"]))
        df["Shot_Angle_Abs"] = df["Shot_Angle"].abs()
        
        df["dist_to_sideline"] = np.minimum(df["y"], 88 - df["y"])
        
        df["dist_squared"] = df["dist"] ** 2
        df["dist_log"] = np.log1p(df["dist"])
        df["angle_squared"] = df["Shot_Angle_Abs"] ** 2
        
        df["dist_angle_interaction"] = df["dist"] * df["Shot_Angle_Abs"] / 90
        
        df["is_central_zone"] = ((df["Shot_Angle_Abs"] < 30) & (df["dist"] < 35)).astype(int)
        
        strict_set_play_pattern = r'\b(free|penalty|45|fortyfive|sideline|mark)\b'
        df["is_setplay"] = df["action"].str.contains(strict_set_play_pattern, case=False, regex=True, na=False).astype(int)
        
        df["set_play_subtype"] = "open_play"
        df.loc[df["is_setplay"] == 1, "set_play_subtype"] = "other"
        
        df.loc[df["is_setplay"] == 1 & df["action"].str.contains(r"\bpenalty\b", case=False, na=False, regex=True), "set_play_subtype"] = "penalty"
        df.loc[df["is_setplay"] == 1 & df["action"].str.contains(r"\bfree\b|\bfreekick\b", case=False, na=False, regex=True), "set_play_subtype"] = "free"
        df.loc[df["is_setplay"] == 1 & df["action"].str.contains(r"\b45\b|\bfortyfive\b", case=False, na=False, regex=True), "set_play_subtype"] = "45"
        df.loc[df["is_setplay"] == 1 & df["action"].str.contains(r"\bmark\b|\boffensive mark\b", case=False, na=False, regex=True), "set_play_subtype"] = "mark"
        df.loc[df["is_setplay"] == 1 & df["action"].str.contains(r"\bsideline\b|\bside line\b", case=False, na=False, regex=True), "set_play_subtype"] = "sideline"
        
        df["is_penalty"] = (df["set_play_subtype"] == "penalty").astype(int)
        df["is_free"] = (df["set_play_subtype"] == "free").astype(int)
        df["is_45"] = (df["set_play_subtype"] == "45").astype(int)
        df["is_mark"] = (df["set_play_subtype"] == "mark").astype(int)
        df["is_sideline"] = (df["set_play_subtype"] == "sideline").astype(int)
        
        set_play_mask = df["is_setplay"] == 1
        open_play_mask = ~set_play_mask
        penalty_mask = df["set_play_subtype"] == "penalty"
        
        set_play_success_rate = df.loc[set_play_mask, "Score_Binary_Points"].mean() if set_play_mask.any() else 0
        open_play_success_rate = df.loc[open_play_mask, "Score_Binary_Points"].mean() if open_play_mask.any() else 0
        
        logging.info(f"Set plays: {set_play_mask.sum()}, Open plays: {open_play_mask.sum()}")
        logging.info(f"Set play success rate: {set_play_success_rate:.3f}, Open play success rate: {open_play_success_rate:.3f}")
        
        subtype_counts = df["set_play_subtype"].value_counts().to_dict()
        
        subtype_success_rates = {}
        for subtype in df["set_play_subtype"].unique():
            subtype_mask = df["set_play_subtype"] == subtype
            if subtype_mask.sum() >= 3:
                subtype_success_rates[subtype] = df.loc[subtype_mask, "Score_Binary_Points"].mean()
        
        logging.info(f"Set play types: {subtype_counts}")
        logging.info(f"Success rates by type: {subtype_success_rates}")
        
        df["setplay_distance"] = df["is_setplay"] * df["dist"]
        df["setplay_angle"] = df["is_setplay"] * df["Shot_Angle_Abs"]
        df["penalty_distance"] = df["is_penalty"] * df["dist"]
        df["free_distance"] = df["is_free"] * df["dist"]
        
        pressure_map = {
            'none': 0, 'low': 0.33, 'medium': 0.67, 'high': 1.0, 
            'n': 0, 'y': 1, '': 0, 'no': 0, 'yes': 1
        }
        df["pressure_value"] = df["pressure"].map(pressure_map).fillna(0)
        
        position_map = {
            'goalkeeper': 0, 'goalie': 0, 'keeper': 0,
            'back': 1, 'defender': 1, 'defense': 1,
            'midfielder': 2, 'midfield': 2, 'mid': 2,
            'forward': 3, 'attacker': 3, 'striker': 3
        }
        df["position_value"] = df["position"].map(
            lambda p: position_map.get(p.lower().strip() if isinstance(p, str) else "unknown", 2)
        )
        
        df["is_right_foot"] = df["foot"].str.contains("right", case=False, na=False).astype(int)
        df["is_left_foot"] = df["foot"].str.contains("left", case=False, na=False).astype(int)
        
        df["is_left_side"] = (df["y"] < 44).astype(int)
        df["preferred_side_advantage"] = np.where(
            ((df["is_left_side"] == 1) & (df["is_left_foot"] == 1)) |
            ((df["is_left_side"] == 0) & (df["is_right_foot"] == 1)),
            1, 0
        )
        
        df["distance_zone_cat"] = pd.cut(
            df["dist"], 
            bins=[0, 20, 30, 40, 50, 60, 100],
            labels=["0", "1", "2", "3", "4", "5"]
        )
        df["distance_zone"] = pd.to_numeric(df["distance_zone_cat"], errors='coerce').fillna(0).astype(int)
        
        df["angle_zone_cat"] = pd.cut(
            df["Shot_Angle_Abs"], 
            bins=[0, 15, 30, 45, 60, 90],
            labels=["0", "1", "2", "3", "4"]
        )
        df["angle_zone"] = pd.to_numeric(df["angle_zone_cat"], errors='coerce').fillna(0).astype(int)
        
        df = df.drop(["distance_zone_cat", "angle_zone_cat"], axis=1)
        
        df["is_extreme_angle"] = (df["Shot_Angle_Abs"] > 60).astype(int)
        df["is_long_shot"] = (df["dist"] > 60).astype(int)
        df["is_very_close"] = (df["dist"] < 10).astype(int)
        df["is_beyond_40m"] = (df["dist"] > 40).astype(int)
        
        df["technical_difficulty"] = df["dist"] * np.sin(np.radians(df["Shot_Angle_Abs"] + 5))
        df["pressure_penalty"] = df["pressure_value"] * (1 + 0.5 * df["is_extreme_angle"])
        
        df["pressure_dist"] = df["pressure_value"] * df["dist"]
        
        cluster_features = df[['dist', 'Shot_Angle_Abs', 'pressure_value', 'is_setplay']].values
        
        cluster_scaler = StandardScaler()
        scaled_cluster_features = cluster_scaler.fit_transform(cluster_features)
        
        n_clusters = min(8, max(3, len(df) // 300))
        
        try:
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            df['shot_cluster'] = kmeans.fit_predict(scaled_cluster_features)
            
            cluster_stats = df.groupby('shot_cluster').agg({
                'Score_Binary_Points': 'mean',
                'Score_Goals': 'mean'
            }).reset_index()
            
            cluster_stats.columns = ['shot_cluster', 'cluster_point_rate', 'cluster_goal_rate']
            
            df = df.merge(cluster_stats, on='shot_cluster', how='left')
            
            for col in ['cluster_point_rate', 'cluster_goal_rate']:
                df[col] = df[col].fillna(df[col].mean())
                
        except Exception as cluster_error:
            logging.warning(f"Error in clustering: {cluster_error}")
            df['cluster_point_rate'] = df['Score_Binary_Points'].mean()
            df['cluster_goal_rate'] = df['Score_Goals'].mean()
        
        points_prior = df["Score_Binary_Points"].mean()
        goals_prior = df["Score_Goals"].mean()
        
        k_points = 15
        k_goals = 25
        
        if len(df["player"].unique()) > 5:
            player_point_stats = df.groupby("player").agg({
                "player": "count",
                "Score_Binary_Points": "sum"
            })
            player_point_stats.columns = ["shots", "point_successes"]
            
            player_point_stats["smoothed_point_rate"] = (
                (player_point_stats["point_successes"] + points_prior * k_points) / 
                (player_point_stats["shots"] + k_points)
            )
            
            player_goal_stats = df.groupby("player").agg({
                "player": "count",
                "Score_Goals": "sum"
            })
            player_goal_stats.columns = ["shots", "goal_successes"]
            
            player_goal_stats["smoothed_goal_rate"] = (
                (player_goal_stats["goal_successes"] + goals_prior * k_goals) / 
                (player_goal_stats["shots"] + k_goals)
            )
            
            df = df.merge(
                player_point_stats["smoothed_point_rate"],
                left_on="player", right_index=True, how="left"
            )
            
            df = df.merge(
                player_goal_stats["smoothed_goal_rate"],
                left_on="player", right_index=True, how="left"
            )
            
            df["smoothed_point_rate"] = df["smoothed_point_rate"].fillna(points_prior)
            df["smoothed_goal_rate"] = df["smoothed_goal_rate"].fillna(goals_prior)
        else:
            df["smoothed_point_rate"] = points_prior
            df["smoothed_goal_rate"] = goals_prior
        
        core_features = [
            "dist", "Shot_Angle_Abs", "pressure_value", "position_value",
            "is_setplay", "is_penalty", "is_free", "is_45", "is_mark", "is_sideline",
            "dist_to_sideline", "preferred_side_advantage", 
            "distance_zone", "angle_zone", "is_central_zone", "is_extreme_angle",
            "is_long_shot", "is_very_close", "is_beyond_40m"
        ]
        
        nonlinear_features = [
            "dist_squared", "dist_log", "angle_squared",
            "dist_angle_interaction", "technical_difficulty"
        ]
        
        interaction_features = [
            "pressure_dist", "setplay_distance", "setplay_angle",
            "penalty_distance", "free_distance"
        ]
        
        player_features = [
            "smoothed_point_rate", "smoothed_goal_rate"
        ]
        
        cluster_features = [
            "cluster_point_rate", "cluster_goal_rate"
        ]
        
        point_features = core_features + nonlinear_features + interaction_features + player_features + cluster_features
        goal_features = core_features + nonlinear_features + interaction_features + player_features + cluster_features
        
        point_features = [f for f in point_features if f in df.columns]
        goal_features = [f for f in goal_features if f in df.columns]
        
        X_points = df[point_features].values
        y_points = df["Score_Binary_Points"].values
        
        X_goals = df[goal_features].values
        y_goals = df["Score_Goals"].values
        
        X_points_train, X_points_test, y_points_train, y_points_test = train_test_split(
            X_points, y_points, test_size=0.25, random_state=42, stratify=y_points
        )
        
        X_goals_train, X_goals_test, y_goals_train, y_goals_test = train_test_split(
            X_goals, y_goals, test_size=0.25, random_state=42, stratify=y_goals
        )
        
        points_scaler = StandardScaler().fit(X_points_train)
        X_points_train_scaled = points_scaler.transform(X_points_train)
        X_points_test_scaled = points_scaler.transform(X_points_test)
        
        goals_scaler = StandardScaler().fit(X_goals_train)
        X_goals_train_scaled = goals_scaler.transform(X_goals_train)
        X_goals_test_scaled = goals_scaler.transform(X_goals_test)
        
        has_smote = False
        try:
            from imblearn.over_sampling import SMOTE
            has_smote = True
        except ImportError:
            logging.warning("imblearn not installed - skipping SMOTE")
        
        if has_smote:
            try:
                if np.sum(y_points_train) >= 5:
                    points_smote = SMOTE(random_state=42, k_neighbors=min(5, np.sum(y_points_train) - 1))
                    X_points_train_resampled, y_points_train_resampled = points_smote.fit_resample(
                        X_points_train_scaled, y_points_train
                    )
                else:
                    X_points_train_resampled, y_points_train_resampled = X_points_train_scaled, y_points_train
                
                if np.sum(y_goals_train) >= 3:
                    goals_smote = SMOTE(random_state=42, k_neighbors=min(3, np.sum(y_goals_train) - 1))
                    X_goals_train_resampled, y_goals_train_resampled = goals_smote.fit_resample(
                        X_goals_train_scaled, y_goals_train
                    )
                else:
                    X_goals_train_resampled, y_goals_train_resampled = X_goals_train_scaled, y_goals_train
            except Exception as e:
                logging.warning(f"SMOTE error: {e}")
                X_points_train_resampled, y_points_train_resampled = X_points_train_scaled, y_points_train
                X_goals_train_resampled, y_goals_train_resampled = X_goals_train_scaled, y_goals_train
        else:
            X_points_train_resampled, y_points_train_resampled = X_points_train_scaled, y_points_train
            X_goals_train_resampled, y_goals_train_resampled = X_goals_train_scaled, y_goals_train
        
        log_p = LogisticRegression(class_weight="balanced", C=0.8, max_iter=1000, random_state=42)
        gb_p = GradientBoostingClassifier(n_estimators=150, learning_rate=0.05, max_depth=3, 
                                         min_samples_split=20, random_state=42)
        rf_p = RandomForestClassifier(n_estimators=100, max_depth=4, class_weight='balanced', 
                                     random_state=42)
        
        log_p.fit(X_points_train_resampled, y_points_train_resampled)
        gb_p.fit(X_points_train_resampled, y_points_train_resampled)
        rf_p.fit(X_points_train_resampled, y_points_train_resampled)
        
        cal_log_p = CalibratedClassifierCV(log_p, method='isotonic', cv='prefit')
        cal_log_p.fit(X_points_train_scaled, y_points_train)
        
        cal_gb_p = CalibratedClassifierCV(gb_p, method='isotonic', cv='prefit')
        cal_gb_p.fit(X_points_train_scaled, y_points_train)
        
        cal_rf_p = CalibratedClassifierCV(rf_p, method='isotonic', cv='prefit')
        cal_rf_p.fit(X_points_train_scaled, y_points_train)
        
        log_g = LogisticRegression(class_weight={0:1, 1:8}, C=0.5, max_iter=1000, random_state=42)
        gb_g = GradientBoostingClassifier(n_estimators=200, learning_rate=0.03, max_depth=3, 
                                         min_samples_split=10, random_state=42)
        rf_g = RandomForestClassifier(n_estimators=150, max_depth=3, class_weight={0:1, 1:10}, 
                                     random_state=42)
        
        log_g.fit(X_goals_train_resampled, y_goals_train_resampled)
        gb_g.fit(X_goals_train_resampled, y_goals_train_resampled)
        rf_g.fit(X_goals_train_resampled, y_goals_train_resampled)
        
        cal_log_g = CalibratedClassifierCV(log_g, method='isotonic', cv='prefit')
        cal_log_g.fit(X_goals_train_scaled, y_goals_train)
        
        cal_gb_g = CalibratedClassifierCV(gb_g, method='isotonic', cv='prefit')
        cal_gb_g.fit(X_goals_train_scaled, y_goals_train)
        
        cal_rf_g = CalibratedClassifierCV(rf_g, method='isotonic', cv='prefit')
        cal_rf_g.fit(X_goals_train_scaled, y_goals_train)
        
        log_p_probs = cal_log_p.predict_proba(X_points_test_scaled)[:, 1]
        gb_p_probs = cal_gb_p.predict_proba(X_points_test_scaled)[:, 1]
        rf_p_probs = cal_rf_p.predict_proba(X_points_test_scaled)[:, 1]
        
        log_p_brier = brier_score_loss(y_points_test, log_p_probs)
        gb_p_brier = brier_score_loss(y_points_test, gb_p_probs)
        rf_p_brier = brier_score_loss(y_points_test, rf_p_probs)
        
        total_inv_brier_p = (1/log_p_brier) + (1/gb_p_brier) + (1/rf_p_brier)
        log_p_weight = (1/log_p_brier) / total_inv_brier_p
        gb_p_weight = (1/gb_p_brier) / total_inv_brier_p
        rf_p_weight = (1/rf_p_brier) / total_inv_brier_p
        
        points_ensemble_probs = (
            log_p_weight * log_p_probs +
            gb_p_weight * gb_p_probs +
            rf_p_weight * rf_p_probs
        )
        
        log_g_probs = cal_log_g.predict_proba(X_goals_test_scaled)[:, 1]
        gb_g_probs = cal_gb_g.predict_proba(X_goals_test_scaled)[:, 1]
        rf_g_probs = cal_rf_g.predict_proba(X_goals_test_scaled)[:, 1]
        
        log_g_brier = brier_score_loss(y_goals_test, log_g_probs)
        gb_g_brier = brier_score_loss(y_goals_test, gb_g_probs)
        rf_g_brier = brier_score_loss(y_goals_test, rf_g_probs)
        
        total_inv_brier_g = (1/log_g_brier) + (1/gb_g_brier) + (1/rf_g_brier)
        log_g_weight = (1/log_g_brier) / total_inv_brier_g
        gb_g_weight = (1/gb_g_brier) / total_inv_brier_g
        rf_g_weight = (1/rf_g_brier) / total_inv_brier_g
        
        goals_ensemble_probs = (
            log_g_weight * log_g_probs +
            gb_g_weight * gb_g_probs +
            rf_g_weight * rf_g_probs
        )

        # Calculate Overall Model Metrics - THIS WAS MISSING
        # We need to compute these metrics before they're referenced later in the code
        
        # Apply standard calibration for initial metrics calculation
        points_calibration_factor = 1.0
        if np.mean(points_ensemble_probs) > 0 and np.mean(y_points_test) > 0:
            points_calibration_factor = np.mean(y_points_test) / np.mean(points_ensemble_probs)
            points_calibration_factor = min(max(points_calibration_factor, 0.8), 1.2)
            
        calibrated_points_probs = points_ensemble_probs * points_calibration_factor
        calibrated_points_probs = np.clip(calibrated_points_probs, 0, 1)
        
        # For goals
        GOAL_CALIBRATION_FACTOR = 0.65
        if np.sum(y_goals_test) >= 5 and np.mean(goals_ensemble_probs) > 0:
            goal_ratio = np.mean(y_goals_test) / np.mean(goals_ensemble_probs)
            GOAL_CALIBRATION_FACTOR = 0.6 * GOAL_CALIBRATION_FACTOR + 0.4 * goal_ratio
            GOAL_CALIBRATION_FACTOR = min(max(GOAL_CALIBRATION_FACTOR, 0.3), 0.9)
            
        calibrated_goals_probs = goals_ensemble_probs * GOAL_CALIBRATION_FACTOR
        calibrated_goals_probs = np.clip(calibrated_goals_probs, 0, 1)
        
        # Find optimal thresholds
        fpr, tpr, thresholds = roc_curve(y_points_test, calibrated_points_probs)
        optimal_idx = np.argmax(tpr - fpr)
        optimal_point_threshold = thresholds[optimal_idx]
        
        optimal_goal_threshold = 0.15
        if np.sum(y_goals_test) >= 5:
            fpr_g, tpr_g, thresholds_g = roc_curve(y_goals_test, calibrated_goals_probs)
            if len(thresholds_g) > 1:
                optimal_idx_g = np.argmax(tpr_g - fpr_g)
                candidate_threshold = thresholds_g[optimal_idx_g]
                if 0.05 <= candidate_threshold <= 0.3:
                    optimal_goal_threshold = candidate_threshold
        
        points_preds = (calibrated_points_probs >= optimal_point_threshold).astype(int)
        goals_preds = (calibrated_goals_probs >= optimal_goal_threshold).astype(int)
        
        # Calculate overall model metrics
        overall_pts_metrics = {
            "accuracy": accuracy_score(y_points_test, points_preds),
            "precision": precision_score(y_points_test, points_preds),
            "recall": recall_score(y_points_test, points_preds),
            "f1": f1_score(y_points_test, points_preds),
            "roc_auc": roc_auc_score(y_points_test, calibrated_points_probs),
            "brier": brier_score_loss(y_points_test, calibrated_points_probs),
            "calibration_factor": points_calibration_factor,
            "optimal_threshold": optimal_point_threshold
        }
        
        # Goals metrics
        overall_gls_metrics = {
            "accuracy": accuracy_score(y_goals_test, goals_preds),
            "precision": precision_score(y_goals_test, goals_preds),
            "recall": recall_score(y_goals_test, goals_preds),
            "f1": f1_score(y_goals_test, goals_preds),
            "roc_auc": roc_auc_score(y_goals_test, calibrated_goals_probs),
            "brier": brier_score_loss(y_goals_test, calibrated_goals_probs),
            "calibration_factor": GOAL_CALIBRATION_FACTOR,
            "optimal_threshold": optimal_goal_threshold
        }
        
        # R² for points
        points_weights = np.ones_like(y_points_test, dtype=float)
        points_weights[y_points_test == 1] = 2.0
       
        weighted_mean = np.average(y_points_test, weights=points_weights)
        total_ss = np.sum(points_weights * (y_points_test - weighted_mean)**2)
        residual_ss = np.sum(points_weights * (y_points_test - calibrated_points_probs)**2)
       
        points_r2 = 1 - (residual_ss / total_ss) if total_ss > 0 else 0
        overall_pts_metrics["r_squared"] = points_r2
        
        # R² for goals
        goals_weights = np.ones_like(y_goals_test, dtype=float)
        goals_weights[y_goals_test == 1] = 5.0
        
        weighted_mean_g = np.average(y_goals_test, weights=goals_weights)
        total_ss_g = np.sum(goals_weights * (y_goals_test - weighted_mean_g)**2)
        residual_ss_g = np.sum(goals_weights * (y_goals_test - calibrated_goals_probs)**2)
        
        goals_r2 = 1 - (residual_ss_g / total_ss_g) if total_ss_g > 0 else 0
        overall_gls_metrics["r_squared"] = goals_r2
        
        # Confusion matrices
        overall_pts_metrics["confusion_matrix"] = confusion_matrix(y_points_test, points_preds).tolist()
        overall_gls_metrics["confusion_matrix"] = confusion_matrix(y_goals_test, goals_preds).tolist()
        
        # Create test masks for specific shot types
        test_indices = np.arange(len(df))[X_points_train.shape[0]:]
        test_set_play_mask = set_play_mask.iloc[test_indices].values
        test_open_play_mask = open_play_mask.iloc[test_indices].values
        
        # Calculate set play specific metrics
        if np.sum(test_set_play_mask) >= 5:
            set_play_y_test = y_points_test[test_set_play_mask]
            set_play_probs = calibrated_points_probs[test_set_play_mask]
            set_play_preds = points_preds[test_set_play_mask]
            
            set_play_pts_metrics = {
                "accuracy": accuracy_score(set_play_y_test, set_play_preds),
                "precision": precision_score(set_play_y_test, set_play_preds, zero_division=0),
                "recall": recall_score(set_play_y_test, set_play_preds, zero_division=0),
                "f1": f1_score(set_play_y_test, set_play_preds, zero_division=0),
                "brier": brier_score_loss(set_play_y_test, set_play_probs),
                "mean_pred": np.mean(set_play_probs),
                "mean_actual": np.mean(set_play_y_test),
                "count": int(np.sum(test_set_play_mask))
            }
            
            # Add ROC AUC if we have both positive and negative samples
            if len(np.unique(set_play_y_test)) > 1:
                set_play_pts_metrics["roc_auc"] = roc_auc_score(set_play_y_test, set_play_probs)
            else:
                set_play_pts_metrics["roc_auc"] = 0.5  # Default for single-class
                
            # Calculate R²
            if np.var(set_play_y_test) > 0:
                set_play_ss_tot = np.sum((set_play_y_test - np.mean(set_play_y_test)) ** 2)
                set_play_ss_res = np.sum((set_play_y_test - set_play_probs) ** 2)
                set_play_r2 = 1 - (set_play_ss_res / set_play_ss_tot) if set_play_ss_tot > 0 else 0
                set_play_pts_metrics["r_squared"] = set_play_r2
            else:
                set_play_pts_metrics["r_squared"] = 0.0
        else:
            # Not enough set play samples in test set
            set_play_pts_metrics = {
                "accuracy": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0,
                "roc_auc": 0.5, "brier": 0.0, "r_squared": 0.0,
                "mean_pred": 0.0, "mean_actual": 0.0, "count": 0
            }
            
        # Calculate open play specific metrics
        if np.sum(test_open_play_mask) >= 5:
            open_play_y_test = y_points_test[test_open_play_mask]
            open_play_probs = calibrated_points_probs[test_open_play_mask]
            open_play_preds = points_preds[test_open_play_mask]
            
            open_play_pts_metrics = {
                "accuracy": accuracy_score(open_play_y_test, open_play_preds),
                "precision": precision_score(open_play_y_test, open_play_preds, zero_division=0),
                "recall": recall_score(open_play_y_test, open_play_preds, zero_division=0),
                "f1": f1_score(open_play_y_test, open_play_preds, zero_division=0),
                "brier": brier_score_loss(open_play_y_test, open_play_probs),
                "mean_pred": np.mean(open_play_probs),
                "mean_actual": np.mean(open_play_y_test),
                "count": int(np.sum(test_open_play_mask))
            }
            
            # Add ROC AUC if we have both positive and negative samples
            if len(np.unique(open_play_y_test)) > 1:
                open_play_pts_metrics["roc_auc"] = roc_auc_score(open_play_y_test, open_play_probs)
            else:
                open_play_pts_metrics["roc_auc"] = 0.5  # Default for single-class
                
            # Calculate R²
            if np.var(open_play_y_test) > 0:
                open_play_ss_tot = np.sum((open_play_y_test - np.mean(open_play_y_test)) ** 2)
                open_play_ss_res = np.sum((open_play_y_test - open_play_probs) ** 2)
                open_play_r2 = 1 - (open_play_ss_res / open_play_ss_tot) if open_play_ss_tot > 0 else 0
                open_play_pts_metrics["r_squared"] = open_play_r2
            else:
                open_play_pts_metrics["r_squared"] = 0.0
        else:
            # Not enough open play samples in test set
            open_play_pts_metrics = {
                "accuracy": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0,
                "roc_auc": 0.5, "brier": 0.0, "r_squared": 0.0,
                "mean_pred": 0.0, "mean_actual": 0.0, "count": 0
            }
            
        # Calculate separate calibration factors for open play and set play
        # For open play
        if np.sum(test_open_play_mask) > 0 and np.mean(points_ensemble_probs[test_open_play_mask]) > 0:
            open_play_points = points_ensemble_probs[test_open_play_mask]
            open_play_actual = y_points_test[test_open_play_mask]
            open_play_calibration_factor = np.mean(open_play_actual) / np.mean(open_play_points)
            open_play_calibration_factor = min(max(open_play_calibration_factor, 0.7), 1.2)
        else:
            open_play_calibration_factor = 1.0
        
        # For set play - use a more conservative calibration to avoid excessively high probabilities
        if np.sum(test_set_play_mask) > 0 and np.mean(points_ensemble_probs[test_set_play_mask]) > 0:
            set_play_points = points_ensemble_probs[test_set_play_mask]
            set_play_actual = y_points_test[test_set_play_mask]
            set_play_calibration_factor = np.mean(set_play_actual) / np.mean(set_play_points)
            
            # For set plays, apply stricter bounds to avoid inflated xPoints
            set_play_calibration_factor = min(max(set_play_calibration_factor, 0.6), 0.9)
            
            # If we have sufficient data, we can analyze by subtype
            set_play_subtype_calibration = {}
            for subtype in ["penalty", "free", "45", "mark", "sideline"]:
                subtype_mask = df.iloc[test_indices]["set_play_subtype"] == subtype
                if subtype_mask.sum() >= 5:
                    subtype_probs = points_ensemble_probs[subtype_mask]
                    subtype_actual = y_points_test[subtype_mask]
                    if np.mean(subtype_probs) > 0:
                        subtype_factor = np.mean(subtype_actual) / np.mean(subtype_probs)
                        subtype_factor = min(max(subtype_factor, 0.5), 0.95)
                        set_play_subtype_calibration[subtype] = subtype_factor
        else:
            set_play_calibration_factor = 0.8  # Conservative default
            set_play_subtype_calibration = {}
        
        # Generate predictions from each model for the entire dataset
        X_points_full = df[point_features].values
        X_goals_full = df[goal_features].values
        
        X_points_full_scaled = points_scaler.transform(X_points_full)
        X_goals_full_scaled = goals_scaler.transform(X_goals_full)
        
        log_p_full_probs = cal_log_p.predict_proba(X_points_full_scaled)[:, 1]
        gb_p_full_probs = cal_gb_p.predict_proba(X_points_full_scaled)[:, 1]
        rf_p_full_probs = cal_rf_p.predict_proba(X_points_full_scaled)[:, 1]
        
        log_g_full_probs = cal_log_g.predict_proba(X_goals_full_scaled)[:, 1]
        gb_g_full_probs = cal_gb_g.predict_proba(X_goals_full_scaled)[:, 1]
        rf_g_full_probs = cal_rf_g.predict_proba(X_goals_full_scaled)[:, 1]
        
        # Combine using optimal weights
        df["xPoints_raw"] = (
            log_p_weight * log_p_full_probs +
            gb_p_weight * gb_p_full_probs +
            rf_p_weight * rf_p_full_probs
        )
        
        df["xGoals_raw"] = (
            log_g_weight * log_g_full_probs +
            gb_g_weight * gb_g_full_probs +
            rf_g_weight * rf_g_full_probs
        )
        
        # Apply separate calibration factors for open play and set play shots
        df["xPoints"] = df["xPoints_raw"].copy()
        
        # Apply open play calibration
        open_play_indices = df[df["is_setplay"] == 0].index
        df.loc[open_play_indices, "xPoints"] = np.clip(
            df.loc[open_play_indices, "xPoints_raw"] * open_play_calibration_factor, 0, 0.95)
        
        # Apply set play calibration
        set_play_indices = df[df["is_setplay"] == 1].index
        df.loc[set_play_indices, "xPoints"] = np.clip(
            df.loc[set_play_indices, "xPoints_raw"] * set_play_calibration_factor, 0, 0.9)
        
        # Apply subtype-specific calibrations if available
        for subtype, factor in set_play_subtype_calibration.items():
            subtype_indices = df[df["set_play_subtype"] == subtype].index
            if not subtype_indices.empty:
                df.loc[subtype_indices, "xPoints"] = np.clip(
                    df.loc[subtype_indices, "xPoints_raw"] * factor, 0, 0.88)
        
        # Final sanity check to cap any extreme values by shot difficulty
        for idx, row in df.iterrows():
            # Additional caps based on angle and distance
            if row["is_extreme_angle"] == 1 and row["Shot_Angle_Abs"] > 75:
                df.at[idx, "xPoints"] = min(df.at[idx, "xPoints"], 0.7)
            if row["dist"] > 65:  # Very long shots
                df.at[idx, "xPoints"] = min(df.at[idx, "xPoints"], 0.6)
        
        # Apply calibration for goals
        df["xGoals"] = np.clip(df["xGoals_raw"] * GOAL_CALIBRATION_FACTOR, 0, 0.9)
        
        # Set category for UI display
        df["category"] = np.where(df["is_setplay"] == 1, "setPlayScore", "openPlayScore")
        
        # Get importance from Random Forest model (most interpretable)
        points_importance = rf_p.feature_importances_
        goals_importance = rf_g.feature_importances_
        
        # Create dictionaries of feature importance
        points_feature_importance = dict(zip(point_features, points_importance))
        goals_feature_importance = dict(zip(goal_features, goals_importance))
        
        # Check if set play features are important
        set_play_importance = {
            "is_setplay": points_feature_importance.get("is_setplay", 0),
            "is_penalty": points_feature_importance.get("is_penalty", 0),
            "is_free": points_feature_importance.get("is_free", 0),
            "is_45": points_feature_importance.get("is_45", 0),
            "is_mark": points_feature_importance.get("is_mark", 0),
            "is_sideline": points_feature_importance.get("is_sideline", 0),
            "setplay_distance": points_feature_importance.get("setplay_distance", 0),
            "setplay_angle": points_feature_importance.get("setplay_angle", 0)
        }
        
        # Log set play feature importance
        logging.info(f"Set play feature importance: {set_play_importance}")
        
        # Custom GAA scoring system
        df["xP_weighted"] = df["xPoints"] * df["point_value"]  # 1 or 2 points based on distance
        df["xP_adv"] = df["xP_weighted"] + (df["xGoals"] * 3)  # 3 points for goals
        
        # Shot quality percentiles
        df["point_quality"] = df["xPoints"].rank(pct=True)
        df["goal_quality"] = df["xGoals"].rank(pct=True)
        df["shot_quality"] = df["xP_adv"].rank(pct=True)
        
        # Calculate expected and actual values
        total_expected_points = df["xP_weighted"].sum()
        total_actual_points = df.apply(
            lambda row: row["point_value"] if row["cat"] == "point" else 0, axis=1
        ).sum()
        
        total_expected_goals = (df["xGoals"].sum() * 3)
        total_actual_goals = (df["Score_Goals"].sum() * 3)
        
        total_expected_value = df["xP_adv"].sum()
        total_actual_value = df.apply(
            lambda row: 3 if row["cat"] == "goal" else 
                        (row["point_value"] if row["cat"] == "point" else 0), 
            axis=1
        ).sum()
        
        # Player Analysis
        player_stats = []

        # Get unique players
        unique_players = df['player'].unique()

        for player in unique_players:
            # Get this player's shots
            player_df = df[df['player'] == player]
            
            # Basic counts
            num_shots = len(player_df)
            points_scored = player_df['Score_Points'].sum()
            goals_scored = player_df['Score_Goals'].sum()
            
            # Expected values
            xpoints = player_df['xPoints'].sum()
            xpoints_weighted = player_df['xP_weighted'].sum()
            xgoals = player_df['xGoals'].sum()
            xp_adv = player_df['xP_adv'].sum()
            
            # Other metrics
            two_point_shots = player_df['is_beyond_40m'].sum() if 'is_beyond_40m' in player_df.columns else 0
            shot_quality_avg = player_df['shot_quality'].mean() if 'shot_quality' in player_df.columns else 0.5
            
            # Set play analysis
            player_set_plays = player_df[player_df['is_setplay'] == 1]
            set_play_count = len(player_set_plays)
            set_play_points = player_set_plays['Score_Binary_Points'].sum() if set_play_count > 0 else 0
            set_play_xpoints = player_set_plays['xPoints'].sum() if set_play_count > 0 else 0
            set_play_efficiency = set_play_points / set_play_xpoints if set_play_xpoints > 0 else 1.0
            
            # Differences
            diff_points = points_scored - xpoints_weighted
            diff_goals = goals_scored * 3 - xgoals * 3
            diff_total = diff_points + diff_goals
            
            # Efficiency (safe division)
            points_efficiency = points_scored / xpoints_weighted if xpoints_weighted > 0 else 1.0
            goals_efficiency = goals_scored / xgoals if xgoals > 0 else 1.0
            total_points = points_scored + goals_scored * 3
            total_efficiency = total_points / xp_adv if xp_adv > 0 else 1.0
            
            # Create player record
            player_record = {
                'player': player,
                'Shots': num_shots,
                'Score_Points': points_scored,
                'Score_Goals': goals_scored,
                'xPoints': xpoints,
                'xP_weighted': xpoints_weighted,
                'xGoals': xgoals,
                'xP_adv': xp_adv,
                'TwoPointShots': two_point_shots,
                'shot_quality_avg': shot_quality_avg,
                'SetPlays': set_play_count,
                'SetPlayPoints': set_play_points,
                'SetPlayXPoints': set_play_xpoints,
                'SetPlayEfficiency': set_play_efficiency,
                'DiffPoints': diff_points,
                'DiffGoals': diff_goals,
                'DiffTotal': diff_total,
                'PointsEfficiency': points_efficiency,
                'GoalsEfficiency': goals_efficiency,
                'TotalEfficiency': total_efficiency
            }
            
            player_stats.append(player_record)

        # Create DataFrame from the list of records
        agg = pd.DataFrame(player_stats)
        
        # Sort by total shots
        if not agg.empty:
            agg = agg.sort_values("Shots", ascending=False)
        
        # Update Original Data
        batch, shots_upd = db.batch(), 0
        for gi, g in enumerate(originals):
            gdata = g["gameData"]
            for si, s in enumerate(gdata):
                idx = df.index[(df["gi"] == gi) & (df["si"] == si)]
                if len(idx) > 0:
                    s["xPoints"] = float(df.at[idx[0], "xPoints"])
                    s["xGoals"] = float(df.at[idx[0], "xGoals"])
                    s["point_value"] = int(df.at[idx[0], "point_value"])
                    s["xP_weighted"] = float(df.at[idx[0], "xP_weighted"])
                    s["xP_adv"] = float(df.at[idx[0], "xP_adv"])
                    s["shot_quality"] = float(df.at[idx[0], "shot_quality"])
                    s["category"] = str(df.at[idx[0], "category"])
                    # Add set play specific info if applicable
                    if df.at[idx[0], "is_setplay"] == 1 and "set_play_subtype" in df.columns:
                        s["set_play_type"] = str(df.at[idx[0], "set_play_subtype"])
                    shots_upd += 1
            batch.set(g["ref"], {"gameData": gdata}, merge=True)
        batch.commit()
        
        # Handle Firebase storage
        try:
            try:
                from firebase_admin import storage
                bucket = storage.bucket()
            except (ImportError, ValueError):
                logging.warning("Firebase storage not configured – skipping leaderboard upload")
                bucket = None
        except Exception as storage_error:
            logging.warning(f"Error accessing storage: {storage_error}")
            bucket = None
            
        # Upload leaderboard if storage available
        if bucket:
            try:
                blob_path = f"analytics/{USER_ID}/{DATASET_NAME}/leaderboard.csv"
                bucket.blob(blob_path).upload_from_string(
                    agg.to_csv(index=False), content_type="text/csv"
                )
            except Exception as upload_error:
                logging.warning(f"Error uploading leaderboard: {upload_error}")
        
        # Prepare model summary for Firestore (flattened to avoid nesting issues)
        model_summary = {
            "timestamp": firestore.SERVER_TIMESTAMP,
            "dataset_name": DATASET_NAME,
            "user_id": USER_ID,
            "points_model_accuracy": float(overall_pts_metrics["accuracy"]),
            "points_model_r_squared": float(overall_pts_metrics["r_squared"]),
            "points_model_auc": float(overall_pts_metrics["roc_auc"]),
            "points_model_f1": float(overall_pts_metrics["f1"]),
            "points_model_calibration_factor": float(points_calibration_factor),
            "set_play_calibration_factor": float(set_play_calibration_factor),
            "open_play_calibration_factor": float(open_play_calibration_factor),
            "goals_model_accuracy": float(overall_gls_metrics["accuracy"]),
            "goals_model_r_squared": float(overall_gls_metrics["r_squared"]),
            "goals_model_auc": float(overall_gls_metrics["roc_auc"]),
            "goals_model_f1": float(overall_gls_metrics["f1"]),
            "goals_model_calibration_factor": float(GOAL_CALIBRATION_FACTOR),
            "ensemble_weights_points_log": float(log_p_weight),
            "ensemble_weights_points_gb": float(gb_p_weight),
            "ensemble_weights_points_rf": float(rf_p_weight),
            "ensemble_weights_goals_log": float(log_g_weight),
            "ensemble_weights_goals_gb": float(gb_g_weight),
            "ensemble_weights_goals_rf": float(rf_g_weight),
            "expected_points": float(total_expected_points),
            "actual_points": float(total_actual_points),
            "expected_goals": float(total_expected_goals),
            "actual_goals": float(total_actual_goals),
            "expected_total": float(total_expected_value),
            "actual_total": float(total_actual_value),
            "total_shots": int(len(df)),
            "total_games": int(len(originals)),
            "set_play_success_rate": float(set_play_success_rate) if set_play_mask.any() else 0.0,
            "open_play_success_rate": float(open_play_success_rate) if open_play_mask.any() else 0.0,
            "set_play_count": int(set_play_mask.sum()),
            "open_play_count": int(open_play_mask.sum()),
            "execution_time_seconds": float(time.time() - start_time)
        }
        
        # Add set play importance metrics
        for feat, imp in set_play_importance.items():
            model_summary[f"importance_{feat}"] = float(imp)
        
        # Add set play subtype info if available
        if set_play_mask.sum() > 0 and "set_play_subtype" in df.columns:
            for subtype in df.loc[set_play_mask, "set_play_subtype"].unique():
                if subtype != "open_play":  # Skip open play
                    subtype_mask = df["set_play_subtype"] == subtype
                    if subtype_mask.sum() >= 3:
                        model_summary[f"setplay_{subtype}_count"] = int(subtype_mask.sum())
                        model_summary[f"setplay_{subtype}_success_rate"] = float(df.loc[subtype_mask, "Score_Binary_Points"].mean())
                        model_summary[f"setplay_{subtype}_xp_mean"] = float(df.loc[subtype_mask, "xPoints"].mean())
                        if subtype in set_play_subtype_calibration:
                            model_summary[f"setplay_{subtype}_calibration"] = float(set_play_subtype_calibration[subtype])
        
        # Save to Firestore
        try:
            db.collection("analytics").document(USER_ID) \
                .collection("model_summaries").document(DATASET_NAME) \
                .set(model_summary)
        except Exception as db_error:
            logging.warning(f"Error saving model summary to Firestore: {db_error}")
        
        # Return Response
        execution_time = time.time() - start_time
        logging.info(f"Unified xPoints model calculation completed in {execution_time:.2f} seconds")
        
        # Format metrics for the frontend to match the expected structure
        frontend_model_summary = {
            "points_open_model": open_play_pts_metrics,
            "points_set_model": set_play_pts_metrics,
            "goals_model": overall_gls_metrics,
            "feature_importance": {
                "set_play_features": set_play_importance,
                "top_features": dict(sorted(points_feature_importance.items(), key=lambda x: x[1], reverse=True)[:10])
            },
            "calibration": {
                "open_play": open_play_calibration_factor,
                "set_play": set_play_calibration_factor,
                "set_play_subtypes": set_play_subtype_calibration
            }
        }
        
        # Create set play subtype metrics for the frontend
        set_play_subtype_metrics = {}
        if set_play_mask.sum() > 0 and "set_play_subtype" in df.columns:
            for subtype in df.loc[set_play_mask, "set_play_subtype"].unique():
                if subtype != "open_play":  # Skip open play
                    subtype_mask = df["set_play_subtype"] == subtype
                    if subtype_mask.sum() >= 3:
                        subtype_actual = df.loc[subtype_mask, "Score_Binary_Points"].mean()
                        subtype_pred = df.loc[subtype_mask, "xPoints"].mean()
                        set_play_subtype_metrics[subtype] = {
                            "count": int(subtype_mask.sum()),
                            "actual_rate": float(subtype_actual),
                            "predicted_rate": float(subtype_pred),
                            "diff": float(subtype_actual - subtype_pred),
                            "calibration_factor": float(set_play_subtype_calibration.get(subtype, set_play_calibration_factor))
                        }
                        
        # Add set play subtype metrics if available
        if set_play_subtype_metrics:
            frontend_model_summary["set_play_subtypes"] = set_play_subtype_metrics
        
        # Return response
        return jsonify({
            "status": "success",
            "message": f"Updated {shots_upd} shots with unified xPoints model values",
            "execution_time_seconds": float(execution_time),
            "model_summary": frontend_model_summary,
            "leaderboard": agg.to_dict("records"),
            "total_metrics": {
                "total_shots": len(df),
                "total_games": len(originals),
                "expected_points": float(total_expected_points),
                "actual_points": float(total_actual_points),
                "expected_goals": float(total_expected_goals),
                "actual_goals": float(total_actual_goals),
                "expected_total_value": float(total_expected_value),
                "actual_total_value": float(total_actual_value),
                "set_play_count": int(set_play_mask.sum()),
                "open_play_count": int(open_play_mask.sum()),
                "set_play_success_rate": float(set_play_success_rate),
                "open_play_success_rate": float(open_play_success_rate)
            }
        }), 200

    except Exception as e:
        logging.error("Unified xPoints model calculation failed", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Error in unified xPoints calculation",
            "error": str(e)
        }), 500


# Middleware function to check dataset publishing permissions
def check_publish_permissions(uid, userType=None):
    """
    Checks if a user has permission to publish datasets based on admin settings.
    
    Args:
        uid (str): User ID
        userType (str, optional): User type (free, premium). If not provided, will fetch from user document
        
    Returns:
        bool: True if user has permission to publish, False otherwise
    """
    try:
        # Get user info if userType not provided
        if userType is None:
            user_doc = db.collection('users').document(uid).get()
            if not user_doc.exists:
                logging.error(f"User {uid} not found")
                return False
            
            user_data = user_doc.to_dict()
            userType = user_data.get('role', '')
            email = user_data.get('email', '')
            
            # Check if user is admin
            if check_admin_status(uid, email):
                return True
        
        # Get publishing permissions
        admin_config = db.collection('adminSettings').document('datasetConfig').get()
        if not admin_config.exists:
            # Default to admin-only if config doesn't exist
            return False
        
        # Get publishing access level
        permissions = admin_config.to_dict().get('permissions', {})
        publish_access = permissions.get('datasetPublishing', 3)  # Default to admin-only
        
        # Check if user has permission based on access level
        if publish_access == 0:  # All users
            return True
        elif publish_access == 1:  # Free users or higher
            return userType != ''
        elif publish_access == 2:  # Premium users only
            return userType == 'premium'
        else:  # Admin only (level 3)
            return False
    
    except Exception as e:
        logging.error(f"Error checking publish permissions: {str(e)}")
        return False

# Middleware function to check dataset viewing permissions
def check_view_permissions(uid, userType=None):
    """
    Checks if a user has permission to view datasets based on admin settings.
    
    Args:
        uid (str): User ID
        userType (str, optional): User type (free, premium). If not provided, will fetch from user document
        
    Returns:
        bool: True if user has permission to view datasets, False otherwise
    """
    try:
        # Handle anonymous users (no uid)
        if not uid:
            # Get permission settings
            admin_config = db.collection('adminSettings').document('datasetConfig').get()
            if not admin_config.exists:
                # Default to all users if config doesn't exist
                return True
            
            # Get viewing access level
            permissions = admin_config.to_dict().get('permissions', {})
            view_access = permissions.get('datasetViewing', 0)  # Default to all users
            
            # Allow anonymous users only if viewAccess is set to "All Users" (0)
            return view_access == 0
        
        # Get user info if userType not provided
        if userType is None:
            user_doc = db.collection('users').document(uid).get()
            if not user_doc.exists:
                logging.error(f"User {uid} not found")
                return False
            
            user_data = user_doc.to_dict()
            userType = user_data.get('role', '')
            email = user_data.get('email', '')
            
            # Check if user is admin
            if check_admin_status(uid, email):
                return True
        
        # Get viewing permissions
        admin_config = db.collection('adminSettings').document('datasetConfig').get()
        if not admin_config.exists:
            # Default to all users if config doesn't exist
            return True
        
        # Get viewing access level
        permissions = admin_config.to_dict().get('permissions', {})
        view_access = permissions.get('datasetViewing', 0)  # Default to all users
        
        # Check if user has permission based on access level
        if view_access == 0:  # All users
            return True
        elif view_access == 1:  # Free users or higher
            return userType != ''
        elif view_access == 2:  # Premium users only
            return userType == 'premium'
        else:
            return False
    
    except Exception as e:
        logging.error(f"Error checking view permissions: {str(e)}")
        return False
    
# Add these API routes to your Flask application
# Place them with your other route definitions

# Endpoint to check if user is an admin
@app.route('/check-admin-status', methods=['POST'])
def api_check_admin_status():
    try:
        data = request.json
        uid = data.get('uid')
        
        if not uid:
            logging.error("UID not provided for admin status check")
            return jsonify({'error': 'UID is required'}), 400
        
        # Fetch user email
        user_doc = db.collection('users').document(uid).get()
        if not user_doc.exists:
            logging.error(f"User {uid} not found")
            return jsonify({'error': 'User not found'}), 404
        
        email = user_doc.to_dict().get('email')
        if not email:
            logging.error(f"Email not found for user {uid}")
            return jsonify({'error': 'User email not found'}), 400
        
        # Check admin status
        is_admin = check_admin_status(uid, email)
        
        return jsonify({'isAdmin': is_admin}), 200
    
    except Exception as e:
        logging.error(f"Error checking admin status: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Endpoint to get dataset publishing permissions
@app.route('/dataset-permissions', methods=['POST'])
def get_dataset_permissions():
    try:
        data = request.json
        uid = data.get('uid')
        userType = data.get('userType')
        
        if not uid:
            logging.error("UID not provided for permissions check")
            return jsonify({'error': 'UID is required'}), 400
        
        # Get user info if userType not provided
        if userType is None:
            user_doc = db.collection('users').document(uid).get()
            if not user_doc.exists:
                logging.error(f"User {uid} not found")
                return jsonify({'error': 'User not found'}), 404
            
            userType = user_doc.to_dict().get('role', '')
        
        # Get admin settings
        admin_config = db.collection('adminSettings').document('datasetConfig').get()
        
        # Default permissions if config doesn't exist
        permissions = {
            'canPublish': False,
            'canView': True,
            'isAdmin': False
        }
        
        # Check if user is admin
        is_admin = check_admin_status(uid)
        if is_admin:
            permissions['isAdmin'] = True
            permissions['canPublish'] = True
            permissions['canView'] = True
        else:
            # Check permissions based on settings
            if admin_config.exists:
                settings = admin_config.to_dict().get('permissions', {})
                
                # Publishing permissions
                publish_access = settings.get('datasetPublishing', 3)
                if publish_access == 0:  # All users
                    permissions['canPublish'] = True
                elif publish_access == 1 and userType:  # Free users
                    permissions['canPublish'] = True
                elif publish_access == 2 and userType == 'premium':  # Premium users
                    permissions['canPublish'] = True
                
                # Viewing permissions
                view_access = settings.get('datasetViewing', 0)
                if view_access == 0:  # All users
                    permissions['canView'] = True
                elif view_access == 1 and userType:  # Free users
                    permissions['canView'] = True
                elif view_access == 2 and userType == 'premium':  # Premium users
                    permissions['canView'] = True
        
        return jsonify(permissions), 200
    
    except Exception as e:
        logging.error(f"Error getting dataset permissions: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Endpoint to save admin settings
@app.route('/save-admin-settings', methods=['POST'])
def save_admin_settings():
    try:
        data = request.json
        uid = data.get('uid')
        settings = data.get('settings')
        
        if not uid or not settings:
            logging.error("UID or settings not provided")
            return jsonify({'error': 'UID and settings are required'}), 400
        
        # Check if user is admin
        if not check_admin_status(uid):
            logging.error(f"User {uid} is not an admin")
            return jsonify({'error': 'Only admins can update settings'}), 403
        
        # Get current settings to preserve any fields not included in update
        admin_config_ref = db.collection('adminSettings').document('datasetConfig')
        admin_config = admin_config_ref.get()
        
        if admin_config.exists:
            current_settings = admin_config.to_dict()
            
            # Ensure we don't remove current user from admin list
            if 'adminUsers' in settings and 'adminUsers' in current_settings:
                user_doc = db.collection('users').document(uid).get()
                if user_doc.exists:
                    email = user_doc.to_dict().get('email')
                    if email and email not in settings['adminUsers']:
                        settings['adminUsers'].append(email)
            
            # Update settings
            admin_config_ref.set(settings, merge=True)
        else:
            # If no settings exist, ensure the current user is an admin
            if 'adminUsers' not in settings:
                user_doc = db.collection('users').document(uid).get()
                if user_doc.exists:
                    email = user_doc.to_dict().get('email')
                    if email:
                        settings['adminUsers'] = [email]
            
            # Create settings
            admin_config_ref.set(settings)
        
        logging.info(f"Admin settings updated by user {uid}")
        return jsonify({'success': True}), 200
    
    except Exception as e:
        logging.error(f"Error saving admin settings: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Endpoint to get list of admin users
@app.route('/admin-users', methods=['POST'])
def get_admin_users():
    try:
        data = request.json
        uid = data.get('uid')
        
        if not uid:
            logging.error("UID not provided for admin users request")
            return jsonify({'error': 'UID is required'}), 400
        
        # Check if user is admin
        if not check_admin_status(uid):
            logging.error(f"User {uid} is not an admin")
            return jsonify({'error': 'Only admins can view admin users list'}), 403
        
        # Get admin users list
        admin_config = db.collection('adminSettings').document('datasetConfig').get()
        
        if admin_config.exists:
            admin_users = admin_config.to_dict().get('adminUsers', [])
        else:
            # If no config exists, only include the current user
            user_doc = db.collection('users').document(uid).get()
            if user_doc.exists:
                email = user_doc.to_dict().get('email')
                admin_users = [email] if email else []
            else:
                admin_users = []
        
        return jsonify({'adminUsers': admin_users}), 200
    
    except Exception as e:
        logging.error(f"Error getting admin users: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Endpoint to add an admin user
@app.route('/add-admin-user', methods=['POST'])
def add_admin_user():
    try:
        data = request.json
        uid = data.get('uid')
        new_admin_email = data.get('newAdminEmail')
        
        if not uid or not new_admin_email:
            logging.error("UID or new admin email not provided")
            return jsonify({'error': 'UID and newAdminEmail are required'}), 400
        
        # Check if user is admin
        if not check_admin_status(uid):
            logging.error(f"User {uid} is not an admin")
            return jsonify({'error': 'Only admins can add admin users'}), 403
        
        # Get admin settings
        admin_config_ref = db.collection('adminSettings').document('datasetConfig')
        admin_config = admin_config_ref.get()
        
        if admin_config.exists:
            current_settings = admin_config.to_dict()
            admin_users = current_settings.get('adminUsers', [])
            
            # Check if user is already an admin
            if new_admin_email in admin_users:
                return jsonify({'message': 'User is already an admin'}), 200
            
            # Add new admin
            admin_users.append(new_admin_email)
            admin_config_ref.update({'adminUsers': admin_users})
        else:
            # If no settings exist, create with current user and new admin
            user_doc = db.collection('users').document(uid).get()
            current_email = user_doc.to_dict().get('email') if user_doc.exists else None
            
            admin_users = [current_email, new_admin_email] if current_email else [new_admin_email]
            admin_config_ref.set({
                'adminUsers': admin_users,
                'permissions': {
                    'datasetPublishing': 3,  # Admin only by default
                    'datasetViewing': 0      # All users by default
                }
            })
        
        logging.info(f"Added {new_admin_email} as admin by user {uid}")
        return jsonify({'success': True}), 200
    
    except Exception as e:
        logging.error(f"Error adding admin user: {str(e)}")
        return jsonify({'error': str(e)}), 500


# Replace the existing move-game endpoint in your Flask backend with this corrected version

@app.route('/move-game', methods=['POST'])
def move_game():
    """Move a game from one dataset to another in the savedGames collection structure"""
    try:
        # Get the request data
        data = request.get_json()
        uid = data.get('uid')
        game_id = data.get('gameId')
        source_dataset = data.get('sourceDataset')
        target_dataset = data.get('targetDataset')
        
        # Validate required fields
        if not all([uid, game_id, source_dataset, target_dataset]):
            logging.error("Missing required fields for move game")
            return jsonify({'error': 'Missing required fields: uid, gameId, sourceDataset, targetDataset'}), 400
        
        if source_dataset == target_dataset:
            logging.error("Source and target datasets are the same")
            return jsonify({'error': 'Source and target datasets cannot be the same'}), 400
        
        # Check if user exists
        user_doc = db.collection('users').document(uid).get()
        if not user_doc.exists:
            logging.error(f"User {uid} not found")
            return jsonify({'error': 'User not found'}), 404
        
        # Reference to the user's games collection (matches your SavedGames structure)
        games_ref = db.collection('savedGames').document(uid).collection('games')
        
        # Find the game to move in the source dataset
        source_query = games_ref.where('datasetName', '==', source_dataset)
        source_games = list(source_query.stream())
        
        game_to_move = None
        game_doc_ref = None
        
        # Look for the game by gameId or gameName (document ID)
        for game_doc in source_games:
            if game_doc.id == game_id:  # Check document ID first
                game_to_move = game_doc.to_dict()
                game_doc_ref = game_doc.reference
                break
            
            # Also check if gameId matches a field in the document
            game_data = game_doc.to_dict()
            if game_data.get('gameId') == game_id or game_data.get('gameName') == game_id:
                game_to_move = game_data
                game_doc_ref = game_doc.reference
                break
        
        if game_to_move is None:
            logging.error(f"Game {game_id} not found in source dataset {source_dataset}")
            return jsonify({'error': f'Game "{game_id}" not found in source dataset "{source_dataset}"'}), 404
        
        # Check if target dataset exists (has at least one game)
        target_query = games_ref.where('datasetName', '==', target_dataset)
        target_games = list(target_query.stream())
        
        # If target dataset doesn't exist, we'll create it by updating the game
        # (The dataset is implicit - it exists when games reference it)
        
        # Update the game's dataset name
        game_to_move['datasetName'] = target_dataset
        
        # Update the game document with the new dataset name
        game_doc_ref.update(game_to_move)
        
        game_name = game_to_move.get('gameName', game_doc_ref.id)
        
        logging.info(f"Successfully moved game '{game_name}' from '{source_dataset}' to '{target_dataset}' for user {uid}")
        
        return jsonify({
            'success': True,
            'message': f'Game "{game_name}" moved successfully from "{source_dataset}" to "{target_dataset}"'
        }), 200
        
    except Exception as e:
        logging.error(f"Error moving game: {str(e)}")
        return jsonify({'error': f'Failed to move game: {str(e)}'}), 500


# Alternative version using Firestore transactions for better data consistency
@app.route('/move-game-transaction', methods=['POST'])
def move_game_with_transaction():
    """Move a game between datasets using Firestore transactions for data consistency"""
    try:
        data = request.get_json()
        uid = data.get('uid')
        game_id = data.get('gameId')
        source_dataset = data.get('sourceDataset')
        target_dataset = data.get('targetDataset')
        
        # Validate inputs
        if not all([uid, game_id, source_dataset, target_dataset]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        if source_dataset == target_dataset:
            return jsonify({'error': 'Source and target datasets cannot be the same'}), 400
        
        # Reference to the user's games collection
        games_ref = db.collection('savedGames').document(uid).collection('games')
        
        # Find the game document
        game_doc_ref = games_ref.document(game_id)
        
        @firestore.transactional
        def move_game_transaction(transaction):
            # Get the game document
            game_doc = transaction.get(game_doc_ref)
            
            if not game_doc.exists:
                raise ValueError(f'Game "{game_id}" not found')
            
            game_data = game_doc.to_dict()
            current_dataset = game_data.get('datasetName')
            
            # Verify the game is in the source dataset
            if current_dataset != source_dataset:
                raise ValueError(f'Game is in dataset "{current_dataset}", not "{source_dataset}"')
            
            # Update the game's dataset name
            game_data['datasetName'] = target_dataset
            
            # Update the document
            transaction.update(game_doc_ref, game_data)
            
            return game_data
        
        # Execute the transaction
        moved_game = move_game_transaction(db.transaction())
        
        game_name = moved_game.get('gameName', game_id)
        
        logging.info(f"Successfully moved game '{game_name}' from '{source_dataset}' to '{target_dataset}' for user {uid}")
        
        return jsonify({
            'success': True,
            'message': f'Game "{game_name}" moved successfully from "{source_dataset}" to "{target_dataset}"',
            'game': moved_game
        }), 200
        
    except ValueError as ve:
        logging.error(f"Validation error in move game: {str(ve)}")
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        logging.error(f"Error in move game transaction: {str(e)}")
        return jsonify({'error': f'Failed to move game: {str(e)}'}), 500
    
# Endpoint to remove an admin user
@app.route('/remove-admin-user', methods=['POST'])
def remove_admin_user():
    try:
        data = request.json
        uid = data.get('uid')
        admin_email = data.get('adminEmail')
        
        if not uid or not admin_email:
            logging.error("UID or admin email not provided")
            return jsonify({'error': 'UID and adminEmail are required'}), 400
        
        # Check if user is admin
        if not check_admin_status(uid):
            logging.error(f"User {uid} is not an admin")
            return jsonify({'error': 'Only admins can remove admin users'}), 403
        
        # Get user email
        user_doc = db.collection('users').document(uid).get()
        if not user_doc.exists:
            logging.error(f"User {uid} not found")
            return jsonify({'error': 'User not found'}), 404
        
        user_email = user_doc.to_dict().get('email')
        
        # Prevent removing yourself
        if user_email == admin_email:
            logging.error(f"User {uid} tried to remove themselves as admin")
            return jsonify({'error': 'You cannot remove yourself as admin'}), 400
        
        # Get admin settings
        admin_config_ref = db.collection('adminSettings').document('datasetConfig')
        admin_config = admin_config_ref.get()
        
        if not admin_config.exists:
            logging.error("Admin config not found")
            return jsonify({'error': 'Admin settings not found'}), 404
        
        current_settings = admin_config.to_dict()
        admin_users = current_settings.get('adminUsers', [])
        
        # Check if user is an admin
        if admin_email not in admin_users:
            return jsonify({'message': 'User is not an admin'}), 200
        
        # Remove admin
        admin_users.remove(admin_email)
        admin_config_ref.update({'adminUsers': admin_users})
        
        logging.info(f"Removed {admin_email} as admin by user {uid}")
        return jsonify({'success': True}), 200
    
    except Exception as e:
        logging.error(f"Error removing admin user: {str(e)}")
        return jsonify({'error': str(e)}), 500

    
if __name__ == '__main__':
    app.run(port=5001, debug=True)


@app.route('/run-xp-model', methods=['POST'])
def run_xp_model():
    """
    Simplified xP model that uses historical data to predict shot success
    without complex adjustments or calibration factors
    """
    import numpy as np
    import pandas as pd
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.neighbors import KNeighborsClassifier
    from sklearn.model_selection import train_test_split, cross_val_score
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
    from sklearn.preprocessing import StandardScaler
    import time
    import gc  # Add garbage collection
    
    try:
        data = request.get_json()
        uid = data.get('uid')
        source_dataset = data.get('source_dataset')
        target_dataset = data.get('target_dataset')
        model_type = data.get('model_type', 'random_forest')
        
        if not all([uid, source_dataset, target_dataset]):
            return jsonify({'error': 'Missing required parameters'}), 400
        
        logging.info(f"Starting xP model: {model_type} for user {uid}")
        start_time = time.time()
        
        # Load source dataset for training
        source_games = db.collection('savedGames').document(uid)\
            .collection('games').where('datasetName', '==', source_dataset).stream()
        
        source_shots = []
        for game in source_games:
            game_data = game.to_dict().get('gameData', [])
            source_shots.extend(game_data)
        
        logging.info(f"Loaded {len(source_shots)} shots for training")
        
        if len(source_shots) < 100:
            return jsonify({'error': 'Not enough training data (minimum 100 shots)'}), 400
        
        # Create training dataframe
        df = pd.DataFrame(source_shots)
        
        # Fix the pandas warning with explicit conversion
        df['x'] = pd.to_numeric(df.get('x', 0), errors='coerce')
        df['y'] = pd.to_numeric(df.get('y', 0), errors='coerce')
        
        # Fill NaN values explicitly
        df['x'] = df['x'].fillna(0)
        df['y'] = df['y'].fillna(0)
        
        # Calculate basic features
        goal_x, goal_y = 145, 44
        df['distance'] = np.sqrt((df['x'] - goal_x)**2 + (df['y'] - goal_y)**2)
        df['angle'] = np.degrees(np.arctan2(np.abs(df['y'] - goal_y), goal_x - df['x']))
        
        # Create simple categorical mappings
        position_map = {
            'forward': 3, 'midfielder': 2, 'back': 1, 'goalkeeper': 0
        }
        df['position_value'] = df.get('position', 'midfielder').astype(str).str.lower().map(position_map).fillna(2)
        
        pressure_map = {
            'high': 3, 'medium': 2, 'low': 1, 'none': 0
        }
        df['pressure_value'] = df.get('pressure', 'none').astype(str).str.lower().map(pressure_map).fillna(0)
        
        # Simple outcome classification
        positive_outcomes = {'point', 'goal', 'scores', 'over'}
        df['success'] = df.get('action', '').astype(str).str.lower().apply(
            lambda x: 1 if any(outcome in x for outcome in positive_outcomes) else 0
        )
        
        logging.info(f"Success rate in training data: {df['success'].mean():.3f}")
        
        # Player historical success rate (simple)
        player_success = df.groupby('playerName')['success'].agg(['mean', 'count'])
        player_success['smoothed_rate'] = (
            (player_success['mean'] * player_success['count'] + 0.3 * 10) / 
            (player_success['count'] + 10)
        )
        
        # Merge player success rate
        df = df.merge(
            player_success[['smoothed_rate']], 
            left_on='playerName', 
            right_index=True, 
            how='left'
        )
        df['smoothed_rate'] = df['smoothed_rate'].fillna(0.3)
        
        # Select features and remove any infinite/NaN values
        features = ['distance', 'angle', 'position_value', 'pressure_value', 'smoothed_rate']
        X = df[features].copy()
        
        # Clean the data
        X = X.replace([np.inf, -np.inf], np.nan).fillna(0)
        y = df['success'].values
        
        logging.info(f"Training data shape: {X.shape}, Features: {features}")
        
        # Check if we have enough variation in target
        if len(np.unique(y)) < 2:
            return jsonify({'error': 'Not enough variation in outcomes for training'}), 400
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        logging.info(f"Training model: {model_type}")
        
        # Train selected model with more conservative parameters for memory
        models = {
            'random_forest': RandomForestClassifier(
                n_estimators=50,  # Reduced from 100
                max_depth=4,      # Reduced from 5
                random_state=42,
                n_jobs=1          # Single threaded to save memory
            ),
            'logistic': LogisticRegression(
                C=1.0, 
                random_state=42,
                max_iter=500,     # Explicit max iterations
                solver='lbfgs'    # Explicit solver
            ),
            'gradient_boost': GradientBoostingClassifier(
                n_estimators=50,  # Reduced from 100
                learning_rate=0.1,
                max_depth=3,
                random_state=42
            ),
            'knn': KNeighborsClassifier(
                n_neighbors=min(20, len(X_train) // 5),  # Adaptive neighbors
                weights='distance',
                n_jobs=1          # Single threaded
            )
        }
        
        model = models.get(model_type, models['random_forest'])
        
        try:
            model.fit(X_train_scaled, y_train)
            logging.info(f"Model {model_type} trained successfully")
        except Exception as e:
            logging.error(f"Model training failed: {str(e)}")
            return jsonify({'error': f'Model training failed: {str(e)}'}), 500
        
        # Evaluate model
        try:
            y_pred = model.predict(X_test_scaled)
            y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]
            
            # Calculate metrics
            metrics = {
                'accuracy': float(accuracy_score(y_test, y_pred)),
                'precision': float(precision_score(y_test, y_pred, zero_division=0)),
                'recall': float(recall_score(y_test, y_pred, zero_division=0)),
                'f1_score': float(f1_score(y_test, y_pred, zero_division=0)),
                'auc_roc': float(roc_auc_score(y_test, y_pred_proba)) if len(np.unique(y_test)) > 1 else 0.5
            }
            
            logging.info(f"Model metrics: {metrics}")
            
        except Exception as e:
            logging.error(f"Model evaluation failed: {str(e)}")
            return jsonify({'error': f'Model evaluation failed: {str(e)}'}), 500
        
        # Cross-validation score (optional, skip if memory tight)
        try:
            cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=3, scoring='f1')  # Reduced CV folds
            metrics['cv_f1_mean'] = float(cv_scores.mean())
            metrics['cv_f1_std'] = float(cv_scores.std())
        except Exception as e:
            logging.warning(f"Cross-validation failed, skipping: {str(e)}")
            metrics['cv_f1_mean'] = metrics['f1_score']
            metrics['cv_f1_std'] = 0.0
        
        # Apply to target dataset
        logging.info(f"Applying model to target dataset: {target_dataset}")
        
        target_games = db.collection('savedGames').document(uid)\
            .collection('games').where('datasetName', '==', target_dataset).stream()
        
        updated_games = []
        total_shots = 0
        
        for game in target_games:
            game_data = game.to_dict()
            shots = game_data.get('gameData', [])
            
            for shot in shots:
                try:
                    # Extract features
                    x = float(shot.get('x', 0))
                    y = float(shot.get('y', 0))
                    distance = np.sqrt((x - goal_x)**2 + (y - goal_y)**2)
                    angle = np.degrees(np.arctan2(np.abs(y - goal_y), goal_x - x))
                    
                    position_value = position_map.get(
                        str(shot.get('position', 'midfielder')).lower(), 2
                    )
                    pressure_value = pressure_map.get(
                        str(shot.get('pressure', 'none')).lower(), 0
                    )
                    
                    # Get player success rate
                    player_name = shot.get('playerName', 'Unknown')
                    player_rate = player_success.loc[player_name, 'smoothed_rate'] if player_name in player_success.index else 0.3
                    
                    # Predict
                    shot_features = np.array([[distance, angle, position_value, pressure_value, player_rate]])
                    shot_features = np.nan_to_num(shot_features, nan=0.0, posinf=0.0, neginf=0.0)  # Clean features
                    shot_features_scaled = scaler.transform(shot_features)
                    
                    xP = float(model.predict_proba(shot_features_scaled)[0, 1])
                    
                    # Update shot with simple xP
                    shot['xP'] = min(max(xP, 0.0), 1.0)  # Clamp between 0 and 1
                    shot['model_type'] = model_type
                    total_shots += 1
                    
                except Exception as e:
                    logging.warning(f"Failed to process shot: {str(e)}")
                    shot['xP'] = 0.3  # Default value
                    shot['model_type'] = model_type
            
            # Update game in Firestore
            try:
                game.reference.update({'gameData': shots})
                updated_games.append(game.id)
            except Exception as e:
                logging.error(f"Failed to update game {game.id}: {str(e)}")
        
        # Calculate summary statistics
        execution_time = time.time() - start_time
        
        # Save model run to history
        model_run = {
            'timestamp': firestore.SERVER_TIMESTAMP,
            'model_type': model_type,
            'source_dataset': source_dataset,
            'target_dataset': target_dataset,
            'metrics': metrics,
            'total_shots_updated': total_shots,
            'execution_time': execution_time,
            'training_size': len(df),
            'features_used': features
        }
        
        try:
            db.collection('modelRuns').document(uid).collection('history').add(model_run)
        except Exception as e:
            logging.warning(f"Failed to save model run history: {str(e)}")
        
        # Clean up memory
        del df, X, y, X_train, X_test, model
        gc.collect()
        
        logging.info(f"Model run completed successfully in {execution_time:.2f}s")
        
        return jsonify({
            'success': True,
            'model_type': model_type,
            'metrics': metrics,
            'shots_updated': total_shots,
            'games_updated': len(updated_games),
            'execution_time': round(execution_time, 2)
        }), 200
        
    except Exception as e:
        logging.error(f"Error in run_xp_model: {str(e)}")
        # Clean up memory on error
        gc.collect()
        return jsonify({'error': str(e)}), 500


@app.route('/get-model-history', methods=['POST'])
def get_model_history():
    """Get history of model runs for the leaderboard"""
    try:
        data = request.get_json()
        uid = data.get('uid')
        
        if not uid:
            return jsonify({'error': 'UID required'}), 400
        
        # Get last 20 model runs
        history = db.collection('modelRuns').document(uid)\
            .collection('history').order_by('timestamp', direction=firestore.Query.DESCENDING)\
            .limit(20).stream()
        
        runs = []
        for doc in history:
            run_data = doc.to_dict()
            run_data['id'] = doc.id
            # Convert timestamp to ISO format if it exists
            if run_data.get('timestamp'):
                run_data['timestamp'] = run_data['timestamp'].isoformat() if hasattr(run_data['timestamp'], 'isoformat') else str(run_data['timestamp'])
            runs.append(run_data)
        
        return jsonify({'history': runs}), 200
        
    except Exception as e:
        logging.error(f"Error getting model history: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/get-user-datasets', methods=['POST'])
def get_user_datasets():
    """Get list of datasets for a user"""
    try:
        data = request.get_json()
        uid = data.get('uid')
        
        if not uid:
            return jsonify({'error': 'UID required'}), 400
        
        # Get unique dataset names
        games = db.collection('savedGames').document(uid).collection('games').stream()
        
        datasets = set()
        for game in games:
            dataset_name = game.to_dict().get('datasetName', 'Default')
            datasets.add(dataset_name)
        
        return jsonify({'datasets': sorted(list(datasets))}), 200
        
    except Exception as e:
        logging.error(f"Error getting datasets: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/reset-xp-values', methods=['POST'])
def reset_xp_values():
    """Reset all xP values to 0 for a specific dataset"""
    try:
        data = request.get_json()
        uid = data.get('uid')
        dataset_name = data.get('dataset_name')
        
        if not all([uid, dataset_name]):
            return jsonify({'error': 'Missing required parameters'}), 400
        
        logging.info(f"Resetting xP values for dataset: {dataset_name}")
        
        # Get all games in the dataset
        games = db.collection('savedGames').document(uid)\
            .collection('games').where('datasetName', '==', dataset_name).stream()
        
        updated_count = 0
        shots_reset = 0
        
        for game in games:
            game_data = game.to_dict()
            shots = game_data.get('gameData', [])
            
            # Reset xP for each shot
            for shot in shots:
                if 'xP' in shot:
                    shot['xP'] = 0.0
                    shot['model_type'] = 'reset'
                    shots_reset += 1
            
            # Update game in Firestore
            try:
                game.reference.update({'gameData': shots})
                updated_count += 1
            except Exception as e:
                logging.error(f"Failed to update game {game.id}: {str(e)}")
        
        return jsonify({
            'success': True,
            'games_updated': updated_count,
            'shots_reset': shots_reset
        }), 200
        
    except Exception as e:
        logging.error(f"Error in reset_xp_values: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/run-advanced-xp-model', methods=['POST'])
def run_advanced_xp_model():
    """
    Advanced xP model with configurable parameters for better accuracy
    """
    import numpy as np
    import pandas as pd
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.neighbors import KNeighborsClassifier
    from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
    from sklearn.preprocessing import StandardScaler
    from sklearn.feature_selection import SelectKBest, f_classif
    import time
    import gc
    
    try:
        data = request.get_json()
        uid = data.get('uid')
        source_dataset = data.get('source_dataset')
        target_dataset = data.get('target_dataset')
        model_type = data.get('model_type', 'random_forest')
        
        # Advanced parameters
        train_size = data.get('train_size', 0.8)  # Training data percentage
        use_feature_selection = data.get('use_feature_selection', False)
        use_grid_search = data.get('use_grid_search', False)
        balance_classes = data.get('balance_classes', False)
        add_interaction_features = data.get('add_interaction_features', False)
        
        if not all([uid, source_dataset, target_dataset]):
            return jsonify({'error': 'Missing required parameters'}), 400
        
        logging.info(f"Starting advanced xP model: {model_type} with train_size={train_size}")
        start_time = time.time()
        
        # Load source dataset
        source_games = db.collection('savedGames').document(uid)\
            .collection('games').where('datasetName', '==', source_dataset).stream()
        
        source_shots = []
        for game in source_games:
            game_data = game.to_dict().get('gameData', [])
            source_shots.extend(game_data)
        
        if len(source_shots) < 100:
            return jsonify({'error': 'Not enough training data (minimum 100 shots)'}), 400
        
        # Create training dataframe
        df = pd.DataFrame(source_shots)
        
        # Fix pandas warnings
        df['x'] = pd.to_numeric(df.get('x', 0), errors='coerce').fillna(0)
        df['y'] = pd.to_numeric(df.get('y', 0), errors='coerce').fillna(0)
        
        # Calculate basic features
        goal_x, goal_y = 145, 44
        df['distance'] = np.sqrt((df['x'] - goal_x)**2 + (df['y'] - goal_y)**2)
        df['angle'] = np.degrees(np.arctan2(np.abs(df['y'] - goal_y), goal_x - df['x']))
        
        # Additional features for better accuracy
        df['distance_squared'] = df['distance'] ** 2
        df['log_distance'] = np.log1p(df['distance'])
        df['angle_rad'] = np.radians(df['angle'])
        df['sin_angle'] = np.sin(df['angle_rad'])
        df['cos_angle'] = np.cos(df['angle_rad'])
        
        # Zone-based features
        df['central_zone'] = ((df['y'] > 30) & (df['y'] < 58)).astype(int)
        df['penalty_area'] = (df['x'] > 125).astype(int)
        
        # Position and pressure mappings
        position_map = {'forward': 3, 'midfielder': 2, 'back': 1, 'goalkeeper': 0}
        df['position_value'] = df.get('position', 'midfielder').astype(str).str.lower().map(position_map).fillna(2)
        
        pressure_map = {'high': 3, 'medium': 2, 'low': 1, 'none': 0}
        df['pressure_value'] = df.get('pressure', 'none').astype(str).str.lower().map(pressure_map).fillna(0)
        
        # Outcome classification
        positive_outcomes = {'point', 'goal', 'scores', 'over'}
        df['success'] = df.get('action', '').astype(str).str.lower().apply(
            lambda x: 1 if any(outcome in x for outcome in positive_outcomes) else 0
        )
        
        # Enhanced player success rate with more sophisticated smoothing
        player_stats = df.groupby('playerName').agg({
            'success': ['mean', 'count', 'std']
        }).fillna(0)
        player_stats.columns = ['success_rate', 'shot_count', 'success_std']
        
        # Bayesian smoothing with dynamic prior
        overall_success_rate = df['success'].mean()
        prior_weight = 20  # Increased for more stable estimates
        player_stats['smoothed_rate'] = (
            (player_stats['success_rate'] * player_stats['shot_count'] + overall_success_rate * prior_weight) / 
            (player_stats['shot_count'] + prior_weight)
        )
        player_stats['player_consistency'] = 1 / (1 + player_stats['success_std'])
        
        # Merge player stats
        df = df.merge(
            player_stats[['smoothed_rate', 'player_consistency']], 
            left_on='playerName', 
            right_index=True, 
            how='left'
        )
        df['smoothed_rate'] = df['smoothed_rate'].fillna(overall_success_rate)
        df['player_consistency'] = df['player_consistency'].fillna(1.0)
        
        # Feature list
        features = [
            'distance', 'angle', 'distance_squared', 'log_distance',
            'sin_angle', 'cos_angle', 'central_zone', 'penalty_area',
            'position_value', 'pressure_value', 'smoothed_rate', 'player_consistency'
        ]
        
        # Add interaction features if requested
        if add_interaction_features:
            df['distance_x_angle'] = df['distance'] * df['angle']
            df['distance_x_pressure'] = df['distance'] * df['pressure_value']
            df['position_x_zone'] = df['position_value'] * df['central_zone']
            features.extend(['distance_x_angle', 'distance_x_pressure', 'position_x_zone'])
        
        X = df[features].copy()
        X = X.replace([np.inf, -np.inf], np.nan).fillna(0)
        y = df['success'].values
        
        # Check target variation
        if len(np.unique(y)) < 2:
            return jsonify({'error': 'Not enough variation in outcomes'}), 400
        
        # Split data with configurable train size
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=(1 - train_size), random_state=42, stratify=y
        )
        
        # Feature selection if requested
        if use_feature_selection:
            selector = SelectKBest(f_classif, k=min(10, len(features)))
            X_train = selector.fit_transform(X_train, y_train)
            X_test = selector.transform(X_test)
            selected_features = [features[i] for i in selector.get_support(indices=True)]
            logging.info(f"Selected features: {selected_features}")
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Model configurations with class balancing
        class_weight = 'balanced' if balance_classes else None
        
        models = {
            'random_forest': RandomForestClassifier(
                n_estimators=100 if not use_grid_search else 50,
                max_depth=5,
                min_samples_split=5,
                min_samples_leaf=2,
                class_weight=class_weight,
                random_state=42,
                n_jobs=-1
            ),
            'logistic': LogisticRegression(
                C=1.0,
                class_weight=class_weight,
                random_state=42,
                max_iter=1000
            ),
            'gradient_boost': GradientBoostingClassifier(
                n_estimators=100 if not use_grid_search else 50,
                learning_rate=0.1,
                max_depth=4,
                min_samples_split=5,
                subsample=0.8,
                random_state=42
            ),
            'knn': KNeighborsClassifier(
                n_neighbors=min(30, len(X_train) // 10),
                weights='distance',
                metric='minkowski',
                p=2,
                n_jobs=-1
            )
        }
        
        model = models.get(model_type, models['random_forest'])
        
        # Grid search for hyperparameter tuning if requested
        if use_grid_search and model_type in ['random_forest', 'gradient_boost']:
            logging.info("Performing grid search for hyperparameters...")
            
            param_grids = {
                'random_forest': {
                    'n_estimators': [50, 100],
                    'max_depth': [3, 5, 7],
                    'min_samples_split': [2, 5, 10]
                },
                'gradient_boost': {
                    'n_estimators': [50, 100],
                    'learning_rate': [0.05, 0.1, 0.15],
                    'max_depth': [3, 4, 5]
                }
            }
            
            grid_search = GridSearchCV(
                model,
                param_grids.get(model_type, {}),
                cv=3,
                scoring='f1',
                n_jobs=-1
            )
            grid_search.fit(X_train_scaled, y_train)
            model = grid_search.best_estimator_
            logging.info(f"Best parameters: {grid_search.best_params_}")
        else:
            model.fit(X_train_scaled, y_train)
        
        # Evaluate model
        y_pred = model.predict(X_test_scaled)
        y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]
        
        metrics = {
            'accuracy': float(accuracy_score(y_test, y_pred)),
            'precision': float(precision_score(y_test, y_pred, zero_division=0)),
            'recall': float(recall_score(y_test, y_pred, zero_division=0)),
            'f1_score': float(f1_score(y_test, y_pred, zero_division=0)),
            'auc_roc': float(roc_auc_score(y_test, y_pred_proba)) if len(np.unique(y_test)) > 1 else 0.5
        }
        
        # Feature importance for tree-based models
        if hasattr(model, 'feature_importances_'):
            feature_importance = dict(zip(
                features if not use_feature_selection else selected_features,
                model.feature_importances_
            ))
            metrics['feature_importance'] = feature_importance
        
        # Apply to target dataset
        target_games = db.collection('savedGames').document(uid)\
            .collection('games').where('datasetName', '==', target_dataset).stream()
        
        updated_games = []
        total_shots = 0
        
        for game in target_games:
            game_data = game.to_dict()
            shots = game_data.get('gameData', [])
            
            for shot in shots:
                try:
                    # Extract all features
                    x = float(shot.get('x', 0))
                    y = float(shot.get('y', 0))
                    distance = np.sqrt((x - goal_x)**2 + (y - goal_y)**2)
                    angle = np.degrees(np.arctan2(np.abs(y - goal_y), goal_x - x))
                    
                    # Calculate additional features
                    shot_features = {
                        'distance': distance,
                        'angle': angle,
                        'distance_squared': distance ** 2,
                        'log_distance': np.log1p(distance),
                        'sin_angle': np.sin(np.radians(angle)),
                        'cos_angle': np.cos(np.radians(angle)),
                        'central_zone': int((y > 30) and (y < 58)),
                        'penalty_area': int(x > 125),
                        'position_value': position_map.get(str(shot.get('position', 'midfielder')).lower(), 2),
                        'pressure_value': pressure_map.get(str(shot.get('pressure', 'none')).lower(), 0),
                        'smoothed_rate': player_stats.loc[shot.get('playerName', 'Unknown'), 'smoothed_rate'] if shot.get('playerName', 'Unknown') in player_stats.index else overall_success_rate,
                        'player_consistency': player_stats.loc[shot.get('playerName', 'Unknown'), 'player_consistency'] if shot.get('playerName', 'Unknown') in player_stats.index else 1.0
                    }
                    
                    if add_interaction_features:
                        shot_features['distance_x_angle'] = distance * angle
                        shot_features['distance_x_pressure'] = distance * shot_features['pressure_value']
                        shot_features['position_x_zone'] = shot_features['position_value'] * shot_features['central_zone']
                    
                    # Create feature array
                    feature_array = np.array([[shot_features[f] for f in features]])
                    
                    if use_feature_selection:
                        feature_array = selector.transform(feature_array)
                    
                    feature_array = np.nan_to_num(feature_array, nan=0.0, posinf=0.0, neginf=0.0)
                    feature_array_scaled = scaler.transform(feature_array)
                    
                    xP = float(model.predict_proba(feature_array_scaled)[0, 1])
                    
                    shot['xP'] = min(max(xP, 0.0), 1.0)
                    shot['model_type'] = f"{model_type}_advanced"
                    shot['model_params'] = {
                        'train_size': train_size,
                        'feature_selection': use_feature_selection,
                        'grid_search': use_grid_search,
                        'balance_classes': balance_classes
                    }
                    total_shots += 1
                    
                except Exception as e:
                    logging.warning(f"Failed to process shot: {str(e)}")
                    shot['xP'] = overall_success_rate
                    shot['model_type'] = f"{model_type}_advanced"
            
            # Update game
            try:
                game.reference.update({'gameData': shots})
                updated_games.append(game.id)
            except Exception as e:
                logging.error(f"Failed to update game {game.id}: {str(e)}")
        
        execution_time = time.time() - start_time
        
        # Enhanced model run record
        model_run = {
            'timestamp': firestore.SERVER_TIMESTAMP,
            'model_type': model_type,
            'is_advanced': True,
            'source_dataset': source_dataset,
            'target_dataset': target_dataset,
            'metrics': metrics,
            'total_shots_updated': total_shots,
            'execution_time': execution_time,
            'training_size': len(df),
            'features_used': features if not use_feature_selection else selected_features,
            'parameters': {
                'train_size': train_size,
                'use_feature_selection': use_feature_selection,
                'use_grid_search': use_grid_search,
                'balance_classes': balance_classes,
                'add_interaction_features': add_interaction_features
            }
        }
        
        try:
            db.collection('modelRuns').document(uid).collection('history').add(model_run)
        except Exception as e:
            logging.warning(f"Failed to save model run history: {str(e)}")
        
        # Cleanup
        del df, X, y, X_train, X_test, model
        gc.collect()
        
        return jsonify({
            'success': True,
            'model_type': f"{model_type}_advanced",
            'metrics': metrics,
            'shots_updated': total_shots,
            'games_updated': len(updated_games),
            'execution_time': round(execution_time, 2),
            'parameters': model_run['parameters']
        }), 200
        
    except Exception as e:
        logging.error(f"Error in run_advanced_xp_model: {str(e)}")
        gc.collect()
        return jsonify({'error': str(e)}), 500

import threading
import time

# Global dictionary to store job status
processing_jobs = {}

@app.route('/run-cmc-model', methods=['POST'])
def run_cmc_model():
    """Start CMC model processing in background"""
    try:
        data = request.get_json()
        uid = data.get('uid')
        source_dataset = data.get('source_dataset')
        target_dataset = data.get('target_dataset')
        
        if not all([uid, source_dataset, target_dataset]):
            return jsonify({'error': 'Missing required parameters'}), 400
        
        # Create unique job ID
        job_id = f"cmc_{uid}_{int(time.time())}"
        
        # Initialize job status
        processing_jobs[job_id] = {
            'status': 'starting',
            'progress': 0,
            'total_shots': 0,
            'games_processed': 0,
            'start_time': time.time(),
            'error': None,
            'metrics': None,
            'phase': 'initialization'
        }
        
        # Start background processing
        thread = threading.Thread(
            target=process_cmc_model_background,
            args=(job_id, uid, source_dataset, target_dataset)
        )
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'success': True,
            'job_id': job_id,
            'status': 'processing_started',
            'message': 'CMC model processing started in background'
        }), 200
        
    except Exception as e:
        logging.error(f"Error starting CMC model: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/check-model-status', methods=['POST'])
def check_model_status():
    """Check status of background model processing"""
    try:
        data = request.get_json()
        job_id = data.get('job_id')
        
        if not job_id:
            return jsonify({'error': 'job_id required'}), 400
        
        if job_id not in processing_jobs:
            return jsonify({'error': 'Job not found'}), 404
        
        job_status = processing_jobs[job_id].copy()
        
        # Clean up completed jobs older than 1 hour
        if job_status['status'] in ['completed', 'failed']:
            if time.time() - job_status['start_time'] > 3600:
                del processing_jobs[job_id]
        
        return jsonify(job_status), 200
        
    except Exception as e:
        logging.error(f"Error checking model status: {str(e)}")
        return jsonify({'error': str(e)}), 500

def process_cmc_model_background(job_id, uid, source_dataset, target_dataset):
    """
    Background function to process the CMC model
    CMC Model v3 - Enhanced with better feature engineering and set piece detection
    """
    import numpy as np
    import pandas as pd
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split, cross_val_score
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
    from sklearn.preprocessing import StandardScaler
    import gc
    
    try:
        logging.info(f"Starting CMC v3 background processing for job {job_id}")
        start_time = time.time()
        
        # Update status
        processing_jobs[job_id].update({
            'status': 'loading_data',
            'phase': 'data_loading'
        })
        
        # Constants
        goal_x, goal_y = 145, 44
        pitch_width, pitch_height = 145, 88
        midline_x, midline_y = 72.5, 44
        BATCH_SIZE = 100
        MAX_BATCH_SIZE = 25  # Smaller batches for background processing
        
        # Comprehensive set piece indicators
        set_piece_indicators = [
            'free', 'penalty', '45', 'fortyfive', 'forty five', 'forty-five',
            'sideline', 'placed', 'offensive mark', 'mark', 'penalty goal',
            'spot kick', 'kickout', 'kick out', 'line ball'
        ]
        
        # Helper functions
        def standardize_coordinates(x, y, midline_x, midline_y):
            """Mirror shots to one side of the pitch for consistency"""
            if x <= midline_x:
                return 2 * midline_x - x, 2 * midline_y - y
            return x, y
        
        def is_preferable_side(y, foot, midline_y):
            """Enhanced preferred side calculation"""
            if foot == 'hand':
                return 0
            side = 'right' if y > midline_y else 'left'
            if (side == 'left' and foot == 'right') or (side == 'right' and foot == 'left'):
                return 1
            return 0
        
        def calculate_goal_angle(x, y, goal_x, goal_y, goal_width=7.32):
            """Calculate the angle to goal posts"""
            post1_y = goal_y - goal_width/2
            post2_y = goal_y + goal_width/2
            angle1 = np.arctan2(post1_y - y, goal_x - x)
            angle2 = np.arctan2(post2_y - y, goal_x - x)
            goal_angle = abs(angle2 - angle1)
            return np.degrees(goal_angle)
        
        def detect_set_piece(shot, indicators):
            """Comprehensive set piece detection"""
            if shot.get('is_setplay') is not None:
                return 1 if shot.get('is_setplay') else 0
            if shot.get('set_play_type') and shot.get('set_play_type') != 'none':
                return 1
            if shot.get('category') and 'setPlay' in str(shot.get('category')):
                return 1
            action = str(shot.get('action', '')).lower()
            return 1 if any(ind in action for ind in indicators) else 0
        
        def get_set_piece_type(shot):
            """Get specific set piece type for categorical encoding"""
            if shot.get('set_play_type'):
                return shot.get('set_play_type')
            action = str(shot.get('action', '')).lower()
            if 'free' in action:
                return 'free'
            elif 'penalty' in action:
                return 'penalty'
            elif '45' in action or 'fortyfive' in action:
                return 'fortyfive'
            elif 'offensive mark' in action or 'mark' in action:
                return 'mark'
            elif 'sideline' in action:
                return 'sideline'
            return 'none'
        
        # Load source dataset
        processing_jobs[job_id]['phase'] = 'loading_training_data'
        source_shots = []
        source_games_query = db.collection('savedGames').document(uid)\
            .collection('games').where('datasetName', '==', source_dataset)
        
        batch_count = 0
        for game in source_games_query.stream():
            game_data = game.to_dict().get('gameData', [])
            source_shots.extend(game_data)
            batch_count += 1
            
            if batch_count % BATCH_SIZE == 0:
                processing_jobs[job_id]['progress'] = min(30, batch_count * 0.1)
                logging.info(f"Job {job_id}: Processed {batch_count} games, {len(source_shots)} shots so far")
                gc.collect()
        
        logging.info(f"Job {job_id}: Loaded {len(source_shots)} shots for training")
        
        if len(source_shots) < 100:
            processing_jobs[job_id].update({
                'status': 'failed',
                'error': 'Not enough training data (minimum 100 shots)',
                'completion_time': time.time()
            })
            return
        
        # Create training dataframe
        processing_jobs[job_id]['phase'] = 'preprocessing_data'
        essential_data = []
        for shot in source_shots:
            try:
                essential_data.append({
                    'x': float(shot.get('x', 0)),
                    'y': float(shot.get('y', 0)),
                    'foot': str(shot.get('foot', 'right')).lower(),
                    'position': str(shot.get('position', 'midfielder')).lower(),
                    'pressure': str(shot.get('pressure', 'none')).lower(),
                    'action': str(shot.get('action', '')).lower(),
                    'playerName': shot.get('playerName', 'Unknown'),
                    'is_setplay': shot.get('is_setplay'),
                    'set_play_type': shot.get('set_play_type'),
                    'category': shot.get('category'),
                    'shot_quality': shot.get('shot_quality'),
                    'minute': int(shot.get('minute', 0))
                })
            except:
                continue
        
        df = pd.DataFrame(essential_data)
        del source_shots
        gc.collect()
        
        # Feature engineering
        processing_jobs[job_id]['phase'] = 'feature_engineering'
        df[['stand_x', 'stand_y']] = df.apply(
            lambda row: standardize_coordinates(row['x'], row['y'], midline_x, midline_y),
            axis=1, result_type='expand'
        )
        
        # Calculate features
        df['distance'] = np.sqrt((df['stand_x'] - goal_x)**2 + (df['stand_y'] - goal_y)**2)
        df['distance_squared'] = df['distance'] ** 2
        df['log_distance'] = np.log1p(df['distance'])
        
        df['angle_to_center'] = np.degrees(np.arctan2(
            np.abs(df['stand_y'] - goal_y), 
            goal_x - df['stand_x']
        ))
        df['goal_angle'] = df.apply(
            lambda row: calculate_goal_angle(row['stand_x'], row['stand_y'], goal_x, goal_y),
            axis=1
        )
        
        # Distance bands
        df['close_range'] = (df['distance'] < 20).astype(int)
        df['mid_range'] = ((df['distance'] >= 20) & (df['distance'] < 35)).astype(int)
        df['long_range'] = ((df['distance'] >= 35) & (df['distance'] < 50)).astype(int)
        df['beyond_50m'] = (df['distance'] >= 50).astype(int)
        df['beyond_40m'] = (df['distance'] >= 40).astype(int)
        
        # Zones
        df['central_zone'] = ((df['stand_y'] > 30) & (df['stand_y'] < 58)).astype(int)
        df['penalty_area'] = (df['stand_x'] > 125).astype(int)
        df['danger_zone'] = ((df['stand_x'] > 110) & (df['central_zone'] == 1)).astype(int)
        
        # Shot characteristics
        df['preferred_side'] = df.apply(
            lambda row: is_preferable_side(row['stand_y'], row['foot'], midline_y),
            axis=1
        )
        
        df['placed_ball'] = df.apply(
            lambda row: detect_set_piece(row, set_piece_indicators),
            axis=1
        )
        
        # Set piece encoding
        set_piece_type_map = {
            'none': 0, 'free': 1, 'penalty': 2, 'fortyfive': 3,
            'mark': 4, 'sideline': 5, 'offensive mark': 4
        }
        df['set_piece_type'] = df.apply(get_set_piece_type, axis=1)
        df['set_piece_type_value'] = df['set_piece_type'].map(set_piece_type_map).fillna(0)
        
        # Categorical mappings
        position_map = {
            'forward': 3, 'midfielder': 2, 'midfield': 2, 
            'back': 1, 'defender': 1, 'goalkeeper': 0
        }
        df['position_value'] = df['position'].map(position_map).fillna(2)
        
        pressure_map = {
            'high': 3, 'medium': 2, 'low': 1, 'none': 0,
            'y': 2, 'yes': 2, 'n': 0, 'no': 0,
            '0': 0, '1': 1, '2': 2, '3': 3
        }
        df['pressure_value'] = df['pressure'].map(pressure_map).fillna(0)
        
        foot_map = {'right': 0, 'left': 1, 'hand': 2}
        df['foot_value'] = df['foot'].map(foot_map).fillna(0)
        
        # Time features
        df['early_game'] = (df['minute'] <= 20).astype(int)
        df['late_game'] = (df['minute'] >= 60).astype(int)
        
        # Outcome variable
        scoring_actions = {
            'point', 'goal', 'penalty goal', 'free', 'offensive mark',
            'fortyfive', 'forty five', '45', 'scores', 'over'
        }
        df['success'] = df['action'].apply(
            lambda x: 1 if any(outcome in x for outcome in scoring_actions) else 0
        )
        
        # Point values
        def calculate_points_value(row):
            action = row['action']
            if 'goal' in action:
                return 3.0
            elif any(outcome in action for outcome in ['point', 'scores', 'over', 'free', 'mark', '45']):
                if row['beyond_40m'] and '45' not in action and 'fortyfive' not in action:
                    return 2.0
                else:
                    return 1.0
            else:
                return 0.0
        
        df['points_value'] = df.apply(calculate_points_value, axis=1)
        
        # Player quality metrics
        processing_jobs[job_id]['phase'] = 'calculating_player_stats'
        player_stats = df.groupby('playerName').agg({
            'success': ['mean', 'count', 'std'],
            'points_value': ['sum', 'mean'],
            'placed_ball': 'mean',
            'distance': 'mean'
        }).fillna(0)
        
        player_stats.columns = ['success_rate', 'shot_count', 'success_std', 
                               'total_points', 'avg_points', 'set_piece_ratio', 'avg_distance']
        
        # Bayesian smoothing
        position_priors = {'forward': 0.35, 'midfielder': 0.30, 'back': 0.25, 'goalkeeper': 0.20}
        overall_success_rate = df['success'].mean()
        player_positions = df.groupby('playerName')['position'].agg(lambda x: x.mode()[0] if len(x) > 0 else 'midfielder')
        
        prior_weight = 15
        player_stats['player_quality'] = player_stats.apply(
            lambda row: (row['success_rate'] * row['shot_count'] + 
                        position_priors.get(player_positions.get(row.name, 'midfielder'), overall_success_rate) * prior_weight) / 
                       (row['shot_count'] + prior_weight),
            axis=1
        )
        
        player_stats['player_consistency'] = 1 / (1 + player_stats['success_std'])
        player_stats['player_efficiency'] = player_stats['avg_points'] * player_stats['success_rate']
        
        # Merge player stats
        df = df.merge(
            player_stats[['player_quality', 'player_consistency', 'player_efficiency', 
                         'set_piece_ratio', 'avg_distance']], 
            left_on='playerName', 
            right_index=True, 
            how='left'
        )
        
        # Fill missing values
        df['player_quality'] = df['player_quality'].fillna(overall_success_rate)
        df['player_consistency'] = df['player_consistency'].fillna(1.0)
        df['player_efficiency'] = df['player_efficiency'].fillna(overall_success_rate)
        df['set_piece_ratio'] = df['set_piece_ratio'].fillna(df['placed_ball'].mean())
        df['avg_distance'] = df['avg_distance'].fillna(df['distance'].mean())
        
        # Interaction features
        df['distance_x_pressure'] = df['distance'] * df['pressure_value']
        df['quality_x_position'] = df['player_quality'] * df['position_value']
        df['angle_x_distance'] = df['angle_to_center'] * df['distance']
        df['preferred_x_quality'] = df['preferred_side'] * df['player_quality']
        
        # Feature set
        features = [
            'distance', 'distance_squared', 'log_distance',
            'angle_to_center', 'goal_angle',
            'close_range', 'mid_range', 'long_range', 'beyond_50m', 'beyond_40m',
            'central_zone', 'penalty_area', 'danger_zone',
            'preferred_side', 'pressure_value', 'position_value', 'foot_value',
            'placed_ball', 'set_piece_type_value',
            'player_quality', 'player_consistency', 'player_efficiency',
            'early_game', 'late_game',
            'distance_x_pressure', 'quality_x_position', 'angle_x_distance', 'preferred_x_quality'
        ]
        
        X = df[features].values
        y = df['success'].values
        X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
        
        processing_jobs[job_id]['progress'] = 40
        logging.info(f"Job {job_id}: Training data shape: {X.shape}, Success rate: {y.mean():.3f}")
        
        if len(np.unique(y)) < 2:
            processing_jobs[job_id].update({
                'status': 'failed',
                'error': 'Not enough variation in outcomes',
                'completion_time': time.time()
            })
            return
        
        # Train model
        processing_jobs[job_id]['phase'] = 'training_model'
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        del df, X, y
        gc.collect()
        
        model = LogisticRegression(
            max_iter=2000,
            C=0.5,
            random_state=42,
            solver='liblinear',
            class_weight='balanced',
            penalty='l2'
        )
        
        model.fit(X_train_scaled, y_train)
        
        # Evaluate model
        cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5, scoring='roc_auc')
        y_pred = model.predict(X_test_scaled)
        y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]
        
        metrics = {
            'accuracy': float(accuracy_score(y_test, y_pred)),
            'precision': float(precision_score(y_test, y_pred, zero_division=0)),
            'recall': float(recall_score(y_test, y_pred, zero_division=0)),
            'f1_score': float(f1_score(y_test, y_pred, zero_division=0)),
            'auc_roc': float(roc_auc_score(y_test, y_pred_proba)) if len(np.unique(y_test)) > 1 else 0.5,
            'cv_auc_mean': float(cv_scores.mean()),
            'cv_auc_std': float(cv_scores.std())
        }
        
        feature_importance = dict(zip(features, model.coef_[0]))
        metrics['top_features'] = sorted(feature_importance.items(), key=lambda x: abs(x[1]), reverse=True)[:10]
        
        processing_jobs[job_id].update({
            'progress': 50,
            'metrics': metrics
        })
        
        del X_train, X_test, y_train, y_test, X_train_scaled, X_test_scaled
        gc.collect()
        
        # Apply to target dataset
        processing_jobs[job_id].update({
            'phase': 'applying_predictions',
            'progress': 55
        })
        
        target_games_query = db.collection('savedGames').document(uid)\
            .collection('games').where('datasetName', '==', target_dataset)
        
        batch = db.batch()
        batch_count = 0
        total_shots = 0
        games_processed = 0
        
        for game in target_games_query.stream():
            game_data = game.to_dict()
            shots = game_data.get('gameData', [])
            
            for shot in shots:
                try:
                    # Extract coordinates
                    x = float(shot.get('x', 0))
                    y = float(shot.get('y', 0))
                    stand_x, stand_y = standardize_coordinates(x, y, midline_x, midline_y)
                    
                    # Calculate features
                    distance = np.sqrt((stand_x - goal_x)**2 + (stand_y - goal_y)**2)
                    distance_squared = distance ** 2
                    log_distance = np.log1p(distance)
                    
                    angle_to_center = np.degrees(np.arctan2(
                        np.abs(stand_y - goal_y), 
                        goal_x - stand_x
                    ))
                    goal_angle = calculate_goal_angle(stand_x, stand_y, goal_x, goal_y)
                    
                    # Distance bands
                    close_range = int(distance < 20)
                    mid_range = int(20 <= distance < 35)
                    long_range = int(35 <= distance < 50)
                    beyond_50m = int(distance >= 50)
                    beyond_40m = int(distance >= 40)
                    
                    # Zones
                    central_zone = int((stand_y > 30) and (stand_y < 58))
                    penalty_area = int(stand_x > 125)
                    danger_zone = int((stand_x > 110) and (central_zone == 1))
                    
                    # Shot characteristics
                    foot = str(shot.get('foot', 'right')).lower()
                    preferred_side = is_preferable_side(stand_y, foot, midline_y)
                    
                    placed_ball = detect_set_piece(shot, set_piece_indicators)
                    set_piece_type = get_set_piece_type(shot)
                    set_piece_type_value = set_piece_type_map.get(set_piece_type, 0)
                    
                    position_value = position_map.get(
                        str(shot.get('position', 'midfielder')).lower(), 2
                    )
                    pressure_value = pressure_map.get(
                        str(shot.get('pressure', 'none')).lower(), 0
                    )
                    foot_value = foot_map.get(foot, 0)
                    
                    # Time features
                    minute = int(shot.get('minute', 0))
                    early_game = int(minute <= 20)
                    late_game = int(minute >= 60)
                    
                    # Player quality
                    player_name = shot.get('playerName', 'Unknown')
                    if player_name in player_stats.index:
                        player_quality = player_stats.loc[player_name, 'player_quality']
                        player_consistency = player_stats.loc[player_name, 'player_consistency']
                        player_efficiency = player_stats.loc[player_name, 'player_efficiency']
                    else:
                        player_quality = overall_success_rate
                        player_consistency = 1.0
                        player_efficiency = overall_success_rate
                    
                    # Interaction features
                    distance_x_pressure = distance * pressure_value
                    quality_x_position = player_quality * position_value
                    angle_x_distance = angle_to_center * distance
                    preferred_x_quality = preferred_side * player_quality
                    
                    # Feature array
                    shot_features = np.array([[
                        distance, distance_squared, log_distance,
                        angle_to_center, goal_angle,
                        close_range, mid_range, long_range, beyond_50m, beyond_40m,
                        central_zone, penalty_area, danger_zone,
                        preferred_side, pressure_value, position_value, foot_value,
                        placed_ball, set_piece_type_value,
                        player_quality, player_consistency, player_efficiency,
                        early_game, late_game,
                        distance_x_pressure, quality_x_position, angle_x_distance, preferred_x_quality
                    ]])
                    
                    shot_features_scaled = scaler.transform(shot_features)
                    
                    # Predict
                    xP = float(model.predict_proba(shot_features_scaled)[0, 1])
                    
                    # Calculate expected points
                    if 'goal' in str(shot.get('action', '')).lower():
                        expected_points = xP * 3.0
                    elif beyond_40m and not any(x in str(shot.get('action', '')).lower() for x in ['45', 'fortyfive']):
                        expected_points = xP * 2.0
                    else:
                        expected_points = xP * 1.0
                    
                    # Update shot
                    shot['xP'] = min(max(xP, 0.0), 1.0)
                    shot['xPoints'] = expected_points
                    shot['model_type'] = 'cmc_v3'
                    shot['cmc_features'] = {
                        'preferred_side': preferred_side,
                        'placed_ball': placed_ball,
                        'set_piece_type': set_piece_type,
                        'beyond_40m': beyond_40m,
                        'shot_angle': round(angle_to_center, 2),
                        'goal_angle': round(goal_angle, 2),
                        'distance': round(distance, 2),
                        'danger_zone': danger_zone,
                        'player_quality': round(player_quality, 3)
                    }
                    total_shots += 1
                    
                except Exception as e:
                    logging.warning(f"Job {job_id}: Failed to process shot: {str(e)}")
                    shot['xP'] = 0.3
                    shot['xPoints'] = 0.3
                    shot['model_type'] = 'cmc_v3'
            
            # Add to batch
            batch.update(game.reference, {'gameData': shots})
            batch_count += 1
            games_processed += 1
            
            # Update progress
            progress = 55 + (games_processed * 40 / max(100, games_processed))  # Scale progress
            processing_jobs[job_id].update({
                'games_processed': games_processed,
                'total_shots': total_shots,
                'progress': min(progress, 95)
            })
            
            # Commit batch
            if batch_count >= MAX_BATCH_SIZE:
                try:
                    batch.commit()
                    logging.info(f"Job {job_id}: Committed batch - {games_processed} games, {total_shots} shots")
                    batch = db.batch()
                    batch_count = 0
                    gc.collect()
                except Exception as e:
                    logging.error(f"Job {job_id}: Batch commit failed: {str(e)}")
                    batch = db.batch()
                    batch_count = 0
        
        # Final commit
        if batch_count > 0:
            try:
                batch.commit()
                logging.info(f"Job {job_id}: Final commit - {games_processed} games total")
            except Exception as e:
                logging.error(f"Job {job_id}: Final commit failed: {str(e)}")
        
        execution_time = time.time() - start_time
        
        # Save model run to history
        model_run = {
            'timestamp': firestore.SERVER_TIMESTAMP,
            'model_type': 'cmc_v3',
            'source_dataset': source_dataset,
            'target_dataset': target_dataset,
            'metrics': metrics,
            'total_shots_updated': total_shots,
            'execution_time': execution_time,
            'training_size': len(essential_data),
            'features_used': features,
            'feature_count': len(features)
        }
        
        try:
            db.collection('modelRuns').document(uid).collection('history').add(model_run)
        except Exception as e:
            logging.warning(f"Job {job_id}: Failed to save model run history: {str(e)}")
        
        # Mark as completed
        processing_jobs[job_id].update({
            'status': 'completed',
            'progress': 100,
            'final_shots': total_shots,
            'final_games': games_processed,
            'completion_time': time.time(),
            'execution_time': execution_time,
            'phase': 'completed'
        })
        
        # Cleanup
        del model, scaler, player_stats
        gc.collect()
        
        logging.info(f"Job {job_id} completed successfully in {execution_time:.2f}s")
        
    except Exception as e:
        logging.error(f"Job {job_id} failed: {str(e)}")
        processing_jobs[job_id].update({
            'status': 'failed',
            'error': str(e),
            'completion_time': time.time(),
            'phase': 'error'
        })
        gc.collect()