import os  # Standard library for interacting with the operating system, e.g., for environment variables
import stripe  # Stripe's Python library for payments and subscriptions
import logging  # Standard Python library for logging events, useful for debugging and monitoring
from flask import Flask, request, jsonify  # Flask framework for building web apps and APIs
from flask_cors import CORS, cross_origin  # Flask extension for enabling Cross-Origin Resource Sharing (CORS)
from flask_talisman import Talisman  # Flask extension for security by adding Content Security Policy (CSP)
import firebase_admin  # Firebase Admin SDK for interacting with Firebase services
from firebase_admin import credentials, firestore  # For Firebase authentication and Firestore database
from dotenv import load_dotenv  # Library for loading environment variables from a .env file
import openai  # OpenAI API for interacting with GPT models
from openai import OpenAI, OpenAIError  # Classes and error handling for OpenAI API

# Load environment variables from the .env file into the application
load_dotenv()

# Set up logging configuration to output info-level logs
logging.basicConfig(level=logging.INFO)

# Initialize the Flask application
app = Flask(__name__)

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
        "'self'",  # Allow connections (e.g., fetch, xhr) to the same origin
        'https://api.stripe.com',  # Allow connections to Stripe API
        'https://www.googleapis.com',  # Allow Google APIs (used by Firebase)
        'https://firestore.googleapis.com',  # Allow Firestore API
        'https://securetoken.googleapis.com',  # Firebase authentication API
        'https://firebase.googleapis.com',  # Allow Firebase API
        'https://*.firebaseio.com',  # Allow Firebase Realtime Database URLs
        'https://*.firebase.com',  # Allow older Firebase URLs
        'https://api.openai.com'  # Allow connections to OpenAI API
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


# Endpoint to save a game to Firestore
@app.route('/save-game', methods=['POST'])
def save_game():
    try:
        data = request.json  # Get the JSON data from the request
        user_id = data.get('uid')  # Extract the user ID
        game_name = data.get('gameName')  # Extract the game name
        game_data = data.get('gameData')  # Extract the game data

        # Validate if required fields are provided
        if not user_id or not game_name or not game_data:
            logging.error("Incomplete game data provided.")  # Log the error
            return jsonify({'error': 'UID, gameName, and gameData are required.'}), 400  # Respond with error

        # Save the game data in Firestore under the user's document
        game_doc_ref = db.collection('savedGames').document(user_id).collection('games').document(game_name)
        game_doc_ref.set({'gameData': game_data}, merge=True)  # Merge to avoid overwriting existing data

        logging.info(f"Game '{game_name}' saved for user {user_id}")  # Log the save action
        return jsonify({"success": True})  # Respond with success
    except Exception as e:
        logging.error(f"Error saving game: {str(e)}")  # Log any errors
        return jsonify(error=str(e)), 400  # Respond with error in JSON


# Endpoint to load saved games from Firestore
@app.route('/load-games', methods=['POST'])
def load_games():
    try:
        data = request.json  # Get the JSON data from the request
        user_id = data.get('uid')  # Extract the user ID

        # Validate if user ID is provided
        if not user_id:
            logging.error("UID not provided for loading games.")  # Log the error
            return jsonify({'error': 'UID is required.'}), 400  # Respond with error

        # Reference the saved games collection in Firestore for the user
        games_ref = db.collection('savedGames').document(user_id).collection('games')
        games = []  # Initialize an empty list to hold the games

        # Iterate over the documents in the games collection
        for doc in games_ref.stream():
            game_data = doc.to_dict()  # Convert each document to a dictionary
            game_data['gameName'] = doc.id  # Add the document ID as the game name
            games.append(game_data)  # Add the game data to the list

        logging.info(f"Loaded {len(games)} games for user {user_id}")  # Log the number of games loaded
        return jsonify(games)  # Return the list of games in JSON
    except Exception as e:
        logging.error(f"Error loading games: {str(e)}")  # Log any errors
        return jsonify(error=str(e)), 400  # Respond with error in JSON


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

        logging.info(f"Received event: {event['type']}")

        # Handle the checkout session completion event
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            customer_id = session['customer']  # Stripe customer ID
            subscription_id = session['subscription']  # Stripe subscription ID

            # Retrieve the user from Firestore using the Stripe customer ID
            user_docs = db.collection('users').where('stripeCustomerId', '==', customer_id).get()
            for doc in user_docs:
                uid = doc.id  # Get the Firestore user document ID

                # Update Firestore with the subscription ID and set the role to 'paid'
                user_ref = db.collection('users').document(uid)
                user_ref.set({
                    'subscriptionId': subscription_id,
                    'role': 'paid'  # Set the role to 'paid'
                }, merge=True)
                logging.info(f"Updated user {uid} to 'paid' with subscription {subscription_id}")

        return jsonify(success=True)
    except stripe.error.SignatureVerificationError as e:
        logging.error(f"Signature verification error: {str(e)}")
        return jsonify(error=str(e)), 400
    except Exception as e:
        logging.error(f"Webhook error: {str(e)}")
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

# Run the Flask app on port 5001 in debug mode
if __name__ == '__main__':
    app.run(port=5001, debug=True)
