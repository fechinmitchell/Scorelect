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
from flask import Flask, request, jsonify  # Flask framework components
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
        'https://fonts.gstatic.com'  # Google Fonts API
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


# Endpoint to load saved games from Firestore, optionally filtered by datasetName
@app.route('/load-games', methods=['POST'])
def load_games():
    try:
        data = request.json  # Get the JSON data from the request
        user_id = data.get('uid')  # Extract the user ID

        # Validate if user ID is provided
        if not user_id:
            logging.error("UID not provided for loading games.")
            return jsonify({'error': 'UID is required.'}), 400

        # Reference the saved games collection in Firestore for the user
        games_ref = db.collection('savedGames').document(user_id).collection('games')

        games_snapshot = games_ref.stream()
        games = []  # Initialize an empty list to hold the games

        # Iterate over the documents in the games collection
        for doc in games_snapshot:
            game_data = doc.to_dict()  # Convert each document to a dictionary
            game_data['gameName'] = doc.id  # Add the document ID as the game name
            games.append(game_data)  # Add the game data to the list

        logging.info(f"Loaded {len(games)} games for user {user_id}.")
        return jsonify(games), 200  # Return the list of games in JSON
    except Exception as e:
        logging.error(f"Error loading games: {str(e)}")
        return jsonify({'error': str(e)}), 400

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
        batch = firestore.batch()
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


# Endpoint to manually refresh subscription status
@app.route('/refresh-subscription-status', methods=['POST'])
def refresh_subscription_status():
    try:
        data = request.json  # Get the JSON data from the request
        uid = data.get('uid')  # Extract the user ID
        stripe_customer_id = data.get('stripeCustomerId')  # Extract the Stripe customer ID

        # Validate if UID and Stripe customer ID are provided
        if not uid or not stripe_customer_id:
            return jsonify({'error': 'UID and Stripe Customer ID are required.'}), 400  # Respond with error

        # Call function to retrieve and update subscription status
        retrieve_and_update_subscription(uid, stripe_customer_id)
        return jsonify({'message': 'Subscription status updated successfully.'})  # Respond with success
    except Exception as e:
        logging.error(f"Error refreshing subscription status: {str(e)}")  # Log any errors
        return jsonify({'error': 'Failed to refresh subscription status.'}), 500  # Respond with error in JSON


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

        if not stripe_customer_id:
            # No Stripe customer ID in Firestore, try to find the customer on Stripe by email
            email = user_data.get('email')
            if email:
                # Search Stripe for the customer by email
                customers = stripe.Customer.list(email=email).data
                if customers:
                    stripe_customer_id = customers[0].id  # Get the Stripe customer ID
                    logging.info(f"Found Stripe customer ID for {email}: {stripe_customer_id}")

                    # Save the Stripe customer ID to Firestore
                    user_ref = db.collection('users').document(uid)
                    user_ref.set({'stripeCustomerId': stripe_customer_id}, merge=True)
                    logging.info(f"Saved Stripe customer ID {stripe_customer_id} for UID: {uid}")
                else:
                    logging.warning(f"No Stripe customer found for email: {email}")
                    return jsonify(user_data)  # Return user data without Stripe info

        # Retrieve the subscription from Stripe
        subscriptions = stripe.Subscription.list(customer=stripe_customer_id)

        if subscriptions and subscriptions['data']:
            subscription = subscriptions['data'][0]  # Get the first subscription
            status = subscription['status']  # Get the subscription status (e.g., 'active', 'canceled')

            # Update the Firestore user's role based on subscription status
            user_ref = db.collection('users').document(uid)
            if status in ['active', 'trialing']:
                user_ref.set({'role': 'paid'}, merge=True)  # Set role to 'paid'
                logging.info(f"Updated user {uid} to 'paid' plan.")
                user_data['role'] = 'paid'  # Update the local data being returned
            else:
                user_ref.set({'role': 'free'}, merge=True)  # Set role to 'free'
                logging.info(f"Updated user {uid} to 'free' plan due to subscription status: {status}")
                user_data['role'] = 'free'  # Update the local data being returned
        else:
            logging.warning(f"No active subscription found for customer {stripe_customer_id}.")
            user_ref.set({'role': 'free'}, merge=True)  # Set role to 'free' if no active subscription found
            user_data['role'] = 'free'  # Update the local data being returned

        # Return the user data (including the role: 'paid' or 'free')
        return jsonify(user_data)
    except Exception as e:
        logging.error(f"Error retrieving user data: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
#Sports Hub Section 
# Helper function to add a new dataset
# Helper function to add a new dataset
def add_dataset(name, description, price, creator_uid, preview_snippet, category):
    try:
        dataset_ref = db.collection('datasets').document()
        dataset_ref.set({
            'name': name,
            'description': description,
            'price': price,
            'creator_uid': creator_uid,
            'preview_snippet': preview_snippet,
            'category': category,
            'created_at': firestore.SERVER_TIMESTAMP
        })
        logging.info(f"Dataset '{name}' added with ID {dataset_ref.id}.")
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

# Updated /publish-dataset Endpoint
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
        price = data.get('price')
        creator_uid = data.get('creator_uid')
        # preview_snippet = data.get('preview_snippet')  # Commented out for now
        category = data.get('category')
        is_free = data.get('isFree') == 'true'  # Convert string to boolean

        # Validate required fields
        if not all([name, description, creator_uid, category]):
            logging.error("Incomplete dataset publishing data provided.")
            return jsonify({'error': 'Name, description, creator_uid, and category are required.'}), 400

        # Validate price if the dataset is not free
        if not is_free:
            if not price or float(price) <= 0:
                logging.error("Invalid price provided for a paid dataset.")
                return jsonify({'error': 'Valid price is required for paid datasets.'}), 400
            price = float(price)
        else:
            price = 0.0  # Set price to 0 for free datasets

        # Check free dataset limit if applicable
        if is_free:
            free_limit = 20  # Set your free dataset limit here
            user_games_ref = db.collection('datasets').where('creator_uid', '==', creator_uid).where('price', '==', 0.0)
            # Manual count since .count() is not available
            free_count = sum(1 for _ in user_games_ref.stream())
            logging.info(f"User {creator_uid} has {free_count} free datasets.")
            if free_count >= free_limit:
                logging.error("Free dataset limit reached.")
                return jsonify({'error': 'Free dataset limit reached. Upgrade to premium to publish more datasets.'}), 403

        # Handle image upload if provided (Commented out for now)
        # if 'image' in files:
        #     image = files['image']
        #     if image and image.filename.endswith(('.png', '.jpg', '.jpeg', '.gif')):
        #         image_url = save_image(image)
        #         if image_url:
        #             preview_snippet = image_url  # Use the image URL as the preview snippet
        #         else:
        #             logging.error("Failed to save image.")
        #             return jsonify({'error': 'Failed to save image.'}), 500
        #     else:
        #         logging.error("Invalid image file uploaded.")
        #         return jsonify({'error': 'Invalid image file.'}), 400

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
        price = dataset.get('price')
        creator_uid = dataset.get('creator_uid')

        if not all([price, creator_uid]):
            logging.error(f"Incomplete dataset information for '{dataset_id}'.")
            return jsonify({'error': 'Dataset information incomplete.'}), 400

        # Retrieve the creator's Stripe account ID
        creator_doc = db.collection('users').document(creator_uid).get()
        if not creator_doc.exists:
            logging.error(f"Creator '{creator_uid}' not found.")
            return jsonify({'error': 'Dataset creator not found.'}), 404

        creator = creator_doc.to_dict()
        stripe_account_id = creator.get('stripeAccountId')

        if not stripe_account_id:
            logging.error(f"Stripe account not connected for creator '{creator_uid}'.")
            return jsonify({'error': 'Dataset creator Stripe account not connected.'}), 400

        # Calculate commission and creator payout
        commission_percentage = 0.20
        commission = price * commission_percentage
        payout = price - commission

        # Create a PaymentIntent with destination charge for Stripe Connect
        payment_intent = stripe.PaymentIntent.create(
            amount=int(price * 100),  # Convert to cents
            currency='usd',
            payment_method=payment_method,
            confirmation_method='manual',
            confirm=True,
            transfer_data={
                'destination': stripe_account_id,
                'amount': int(payout * 100),
            },
        )

        # Record the transaction in Firestore
        transaction_id = record_transaction(buyer_uid, dataset_id, price, commission)

        logging.info(f"PaymentIntent created for transaction {transaction_id}.")
        return jsonify({
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
    
@app.route('/published-datasets', methods=['GET'])
def get_published_datasets():
    try:
        datasets_ref = db.collection('datasets')
        datasets = []
        for doc in datasets_ref.stream():
            dataset = doc.to_dict()
            dataset['id'] = doc.id
            datasets.append(dataset)
        logging.info(f"Fetched {len(datasets)} published datasets.")
        return jsonify({'datasets': datasets}), 200
    except Exception as e:
        logging.error(f"Error fetching published datasets: {str(e)}")
        return jsonify({'error': 'Failed to fetch published datasets.'}), 500

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

@app.route('/recalculate-xpoints', methods=['POST'])
def recalculate_xpoints():
    """
    Recalculates xPoints and xGoals for a specified user and dataset using a
    three-way train/validation/test split to reduce overfitting and provide
    a more realistic measure of model performance.
    """
    data = request.get_json()
    USER_ID = data.get('user_id', "w9ZkqaYVM3dKSqqjWHLDVyh5sVg2")
    DATASET_NAME = data.get('dataset_name', "GAA All Shots")

    try:
        logging.info(f"Starting recalculation of xPoints and xGoals for user: {USER_ID}, dataset: {DATASET_NAME}")

        # ---------------------------
        # Step 1: Fetch data
        # ---------------------------
        games_ref = db.collection('savedGames').document(USER_ID).collection('games').where('datasetName', '==', DATASET_NAME)
        games_snapshot = games_ref.stream()

        original_games = []
        all_shots = []
        game_count = 0
        for doc in games_snapshot:
            game_data = doc.to_dict()
            shots = game_data.get('gameData', [])
            if shots:
                original_games.append({
                    'doc_ref': doc.reference,
                    'doc_id': doc.id,
                    'game_data': shots
                })
                all_shots.extend(shots)
                game_count += 1

        logging.info(f"Found {game_count} games with datasetName '{DATASET_NAME}'. Total shots: {len(all_shots)}")

        if not all_shots:
            logging.warning(f'No data found for dataset "{DATASET_NAME}".')
            return jsonify({'error': f'No data found for dataset "{DATASET_NAME}".'}), 404

        # ---------------------------
        # Step 2: Categorize Shots
        # ---------------------------
        goalOutcomes = ['goal', 'scores goal', 'made goal', 'hit goal', 'penalty goal']
        pointOutcomes = ['point', 'over', 'scores point', 'made point', 'offensive mark', 'fortyfive', 'free']
        missOutcomes = [
            'miss', 'blocked', 'post', 'short', 'wide', 'failed', 'free wide', 'free short', 'free post',
            'offensive mark short', 'fortyfive short', 'fortyfive wide', 'offensive mark wide',
            'offensive mark post', 'goal miss', 'pen miss', 'sideline wide', 'fortyfive post'
        ]

        indexed_shots = []
        for g_i, game in enumerate(original_games):
            for s_i, shot in enumerate(game['game_data']):
                outcome = (shot.get('Outcome', '') or shot.get('action', '') or 'unknown').lower()
                if outcome in goalOutcomes:
                    category = 'goal'
                elif outcome in pointOutcomes:
                    category = 'point'
                else:
                    category = 'miss'

                # Validate coordinates
                try:
                    shot_x = float(shot.get('x', 0))
                    shot_y = float(shot.get('y', 0))
                except ValueError:
                    shot_x, shot_y = 0.0, 0.0
                    logging.error(f"Invalid x or y values in shot: {shot}")

                # Calculate shot distance
                goal_x, goal_y = 145, 44
                shot_distance = np.sqrt((goal_x - shot_x)**2 + (goal_y - shot_y)**2)

                s = {
                    'g_i': g_i,
                    's_i': s_i,
                    'player': shot.get('playerName', 'Unknown Player'),
                    'team': shot.get('team', 'Unknown Team'),
                    'action': shot.get('action', 'unknown'),
                    'category': category,
                    'x': shot_x,
                    'y': shot_y,
                    'foot': shot.get('foot', 'unknown').lower(),
                    'pressure': shot.get('pressure', 'n').lower(),
                    'shotDistance': shot_distance,
                    'position': shot.get('position', 'unknown'),
                }
                indexed_shots.append(s)

        df = pd.DataFrame(indexed_shots)

        # ---------------------------
        # Step 3: Add Score Columns
        # ---------------------------
        df['Score_Points'] = df['category'].apply(lambda x: 1 if x == 'point' else 0)
        df['Score_Goals'] = df['category'].apply(lambda x: 1 if x == 'goal' else 0)

        # ---------------------------
        # Step 4: Feature Engineering
        # ---------------------------
        def is_preferable_side(y, foot):
            if y < 44:
                side = 'left'
            elif y > 44:
                side = 'right'
            else:
                side = 'center'
            # Prefer right foot on left side / left foot on right side
            if ((side == 'left' and foot in ['right', 'hand']) or
                (side == 'right' and foot in ['left', 'hand'])):
                return 1
            return 0

        df['Preferred_Side'] = df.apply(lambda row: is_preferable_side(row['y'], row['foot']), axis=1)
        df['shot_type'] = df['action'].apply(lambda x: 'set_play' if x == 'free' else 'open_play')
        shot_type_map = {'open_play': 0, 'set_play': 1}
        df['Shot_Type_Value'] = df['shot_type'].map(shot_type_map).fillna(0).astype(int)

        # Pressure * distance
        df['pressure_shotDistance'] = df['pressure'].map({'y': 1, 'n': 0}).fillna(0).astype(int) * df['shotDistance']

        pressureMap = {'y': 1, 'n': 0}
        positionMap = {'goalkeeper': 0, 'back': 1, 'midfielder': 2, 'forward': 3}
        footMap = {'right': 0, 'left': 1, 'hand': 2}

        df['Pressure_Value'] = df['pressure'].map(pressureMap).fillna(0).astype(int)
        df['Position_Value'] = df['position'].map(positionMap).fillna(0).astype(int)
        df['Foot_Value'] = df['foot'].map(footMap).fillna(0).astype(int)

        def calculate_shot_angle(row):
            goal_x, goal_y = 145, 44
            delta_x = goal_x - row['x']
            delta_y = goal_y - row['y']
            angle_radians = np.arctan2(delta_y, delta_x)
            return np.degrees(angle_radians) if delta_x != 0 else 90.0

        df['Shot_Angle'] = df.apply(calculate_shot_angle, axis=1)

        # Placed ball
        placedBallActions = ['point', 'free', 'offensive mark', 'fortyfive']
        df['Placed_Ball'] = df['action'].apply(lambda x: 1 if x.lower() in placedBallActions else 0)

        # ---------------------------
        # Step 5: Data Scaling
        # ---------------------------
        scaler = StandardScaler()
        df[['x_scaled', 'y_scaled', 'Shot_Angle', 'shotDistance']] = scaler.fit_transform(
            df[['x', 'y', 'Shot_Angle', 'shotDistance']]
        )

        # ---------------------------
        # Step 6: Prepare Features
        # ---------------------------
        X_cols = [
            'Preferred_Side', 'Pressure_Value', 'Position_Value',
            'Foot_Value', 'Shot_Angle', 'shotDistance', 'Placed_Ball',
            'Shot_Type_Value', 'pressure_shotDistance'
        ]

        X_features = df[X_cols].fillna(0).values
        y_points = df['Score_Points'].values
        y_goals = df['Score_Goals'].values

        logging.info(f"Features shape: {X_features.shape}, y_points: {y_points.shape}, y_goals: {y_goals.shape}")

        # ---------------------------
        # Step 7: Three-Way Split
        # ---------------------------
        X_trainval, X_test, y_points_trainval, y_points_test, y_goals_trainval, y_goals_test = train_test_split(
            X_features, y_points, y_goals, test_size=0.2, random_state=42, stratify=y_points
        )

        X_train, X_calib, y_points_train, y_points_calib, y_goals_train, y_goals_calib = train_test_split(
            X_trainval, y_points_trainval, y_goals_trainval,
            test_size=0.3,  # 30% of the 80%
            random_state=42,
            stratify=y_points_trainval
        )

        logging.info(f"Train shape: {X_train.shape}, Calib shape: {X_calib.shape}, Test shape: {X_test.shape}")

        # -----------------------------
        # Points Model Training
        # -----------------------------
        if len(np.unique(y_points_train)) < 2:
            logging.warning("All Score_Points in train set are identical. Setting xP_adv_Points to 0.5.")
            df['xP_adv_Points'] = 0.5
        else:
            try:
                logging.info(f"Points Distribution (Train): {Counter(y_points_train)}")
                
                # SMOTE on the training set only
                smote_p = SMOTE(random_state=42, sampling_strategy='auto', k_neighbors=3)
                X_train_p_resampled, y_train_p_resampled = smote_p.fit_resample(X_train, y_points_train)
                logging.info(f"After SMOTE (Points): {Counter(y_train_p_resampled)}")

                rf_points = RandomForestClassifier(
                    n_estimators=100,
                    class_weight='balanced',  # or tweak further if needed
                    random_state=42,
                    max_depth=10,
                    min_samples_split=5,
                    min_samples_leaf=2
                )
                rf_points.fit(X_train_p_resampled, y_train_p_resampled)

                # Calibrate
                calibrated_model_points = CalibratedClassifierCV(
                    estimator=rf_points,
                    method='isotonic',
                    cv='prefit'
                )
                calibrated_model_points.fit(X_calib, y_points_calib)

                logging.info("Points Model: training + calibration done.")

                # Evaluate on test
                y_points_pred = calibrated_model_points.predict(X_test)
                test_acc_points = accuracy_score(y_points_test, y_points_pred)
                logging.info(f"Points Model Test Accuracy: {test_acc_points*100:.2f}%")
                logging.info("Points Model Classification Report (Test):\n" +
                             classification_report(y_points_test, y_points_pred))

                # Predict probabilities on the entire dataset
                df['xP_adv_Points'] = calibrated_model_points.predict_proba(X_features)[:, 1]
                # Force points prob to zero for actual goals
                df.loc[df['category'] == 'goal', 'xP_adv_Points'] = 0

            except Exception as e:
                logging.error(f"Failed to train Points Model: {e}")
                return jsonify({'error': 'Failed to train Points Model.'}), 500

        # -----------------------------
        # Goals Model Training
        # -----------------------------
        if len(np.unique(y_goals_train)) < 2:
            logging.warning("All Score_Goals in train set are identical. Setting xP_adv_Goals to 0.5.")
            df['xP_adv_Goals'] = 0.5
        else:
            try:
                logging.info(f"Goals Distribution (Train): {Counter(y_goals_train)}")

                # 1) SMOTE more aggressively for goals
                smote_g = SMOTE(random_state=42, sampling_strategy=1.0, k_neighbors=5)
                X_train_g_resampled, y_train_g_resampled = smote_g.fit_resample(X_train, y_goals_train)
                logging.info(f"After SMOTE (Goals): {Counter(y_train_g_resampled)}")

                # 2) More emphasis on minority class
                rf_goals = RandomForestClassifier(
                    n_estimators=100,
                    class_weight={0:1, 1:5},  # Increase weighting for goals
                    random_state=42,
                    max_depth=10,
                    min_samples_split=5,
                    min_samples_leaf=2
                )
                rf_goals.fit(X_train_g_resampled, y_train_g_resampled)

                # 3) Calibrate with isotonic
                calibrated_model_goals = CalibratedClassifierCV(
                    estimator=rf_goals,
                    method='isotonic',
                    cv='prefit'
                )
                calibrated_model_goals.fit(X_calib, y_goals_calib)
                logging.info("Goals Model: training + calibration done.")

                # Evaluate on the test set
                y_goals_proba_test = calibrated_model_goals.predict_proba(X_test)[:, 1]
                # Instead of the default 0.5, let's try a custom threshold
                custom_threshold = 0.3  
                y_goals_pred_threshold = (y_goals_proba_test >= custom_threshold).astype(int)

                logging.info(f"Goals Model Classification Report (Test) @ threshold={custom_threshold}:\n" +
                             classification_report(y_goals_test, y_goals_pred_threshold))

                # If you still want the default 0.5 metrics:
                y_goals_pred_default = calibrated_model_goals.predict(X_test)
                logging.info("Goals Model Classification Report (Test) @ default=0.5:\n" +
                             classification_report(y_goals_test, y_goals_pred_default))

                # Predict probabilities on the entire dataset
                df['xP_adv_Goals'] = calibrated_model_goals.predict_proba(X_features)[:, 1]

                # Zero out goals probability for actual points
                df.loc[df['category'] == 'point', 'xP_adv_Goals'] = 0

            except Exception as e:
                logging.error(f"Failed to train Goals Model: {e}")
                return jsonify({'error': 'Failed to train Goals Model.'}), 500

        # ---------------------------
        # Step 8: KNN for xPoints/xGoals
        # ---------------------------
        space_threshold_points = 3
        min_neighbors_points = 3
        space_threshold_goals = 3
        min_neighbors_goals = 3

        coords_scaled = df[['x_scaled', 'y_scaled']].values
        tree_points = KDTree(coords_scaled, leaf_size=2)
        tree_goals = KDTree(coords_scaled, leaf_size=2)

        # xPoints
        indices_points = tree_points.query_radius(coords_scaled, r=space_threshold_points)
        xPoints = []
        for i, neighbors in enumerate(indices_points):
            neighbors = neighbors[neighbors != i]
            if len(neighbors) >= min_neighbors_points:
                mean_score = df.iloc[neighbors]['Score_Points'].mean()
                xPoints.append(mean_score)
            else:
                xPoints.append(df['Score_Points'].mean())
        df['xPoints'] = xPoints

        # xGoals
        indices_goals = tree_goals.query_radius(coords_scaled, r=space_threshold_goals)
        xGoals = []
        for i, neighbors in enumerate(indices_goals):
            neighbors = neighbors[neighbors != i]
            if len(neighbors) >= min_neighbors_goals:
                mean_score = df.iloc[neighbors]['Score_Goals'].mean()
                xGoals.append(mean_score)
            else:
                xGoals.append(df['Score_Goals'].mean())
        df['xGoals'] = xGoals

        # ---------------------------
        # Step 9: Conditional Assignment
        # ---------------------------
        df['xPoints_Final'] = df.apply(
            lambda row: row['xPoints'] if row['category'] in ['point', 'miss'] else None,
            axis=1
        )
        df['xGoals_Final'] = df.apply(
            lambda row: row['xGoals'] if row['category'] in ['goal', 'miss'] else None,
            axis=1
        )

        # ---------------------------
        # Step 10: Validation
        # ---------------------------
        if not df['xPoints_Final'].dropna().between(0, 1).all():
            logging.error("Some xPoints_Final values are outside [0, 1].")
            return jsonify({'error': 'xPoints out of bounds.'}), 500
        if not df['xGoals_Final'].dropna().between(0, 1).all():
            logging.error("Some xGoals_Final values are outside [0, 1].")
            return jsonify({'error': 'xGoals out of bounds.'}), 500

        # ---------------------------
        # Step 11: Leaderboard
        # ---------------------------
        player_stats = df.groupby('player').agg(
            Shots=('player', 'count'),
            Points=('Score_Points', 'sum'),
            Goals=('Score_Goals', 'sum'),
            xP_adv_Points=('xP_adv_Points', 'sum'),
            xP_adv_Goals=('xP_adv_Goals', 'sum'),
            xPoints=('xPoints_Final', 'mean'),
            xGoals=('xGoals_Final', 'mean')
        ).reset_index()

        player_stats['Difference_Points'] = player_stats['Points'] - player_stats['xP_adv_Points']
        player_stats['Difference_Goals'] = player_stats['Goals'] - player_stats['xP_adv_Goals']

        leaderboard_points = player_stats.sort_values(by='Difference_Points', ascending=False)
        leaderboard_goals = player_stats.sort_values(by='Difference_Goals', ascending=False)

        top_points = leaderboard_points.head(20)
        top_goals = leaderboard_goals.head(20)

        finalLeaderboard = {
            'Points_Leaderboard': top_points.to_dict(orient='records'),
            'Goals_Leaderboard': top_goals.to_dict(orient='records')
        }

        # ---------------------------
        # Step 12: Update Firestore
        # ---------------------------
        batch = db.batch()
        for index, row in df.iterrows():
            g_i = row['g_i']
            s_i = row['s_i']
            original_games[g_i]['game_data'][s_i]['xPoints'] = row['xPoints_Final']
            original_games[g_i]['game_data'][s_i]['xGoals'] = row['xGoals_Final']

        try:
            for game in original_games:
                doc_ref = game['doc_ref']
                batch.update(doc_ref, {'gameData': game['game_data']})
            batch.commit()
        except Exception as firestore_error:
            logging.error(f"Firestore batch commit failed: {firestore_error}", exc_info=True)
            return jsonify({'error': 'Failed to update Firestore.'}), 500

        # ---------------------------
        # Step 13: Store Leaderboard
        # ---------------------------
        try:
            leaderboard_ref = db.collection('savedGames').document(USER_ID).collection('leaderboard').document(DATASET_NAME)
            leaderboard_ref.set({'leaderboardData': finalLeaderboard}, merge=True)
            logging.info("Leaderboard data updated in Firestore.")
        except Exception as leaderboard_error:
            logging.error(f"Failed to update leaderboard in Firestore: {leaderboard_error}", exc_info=True)
            return jsonify({'error': 'Failed to update leaderboard in Firestore.'}), 500

        logging.info(f"Recalculation completed for user: {USER_ID}, dataset: {DATASET_NAME}.")
        return jsonify({'success': True, 'message': 'Recalculation completed.'}), 200

    except Exception as e:
        logging.error(f"Error recalculating xpoints: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
# Run the Flask app on port 5001 in debug mode
if __name__ == '__main__':
    app.run(port=5001, debug=True)