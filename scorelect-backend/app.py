import os
import stripe
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
from flask_talisman import Talisman
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
from openai import OpenAI



# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": [
    "http://localhost:3000",
    "http://localhost:3001",  # Added this line
    "https://scorelect.vercel.app",
    "https://scorelect.com",
    "https://www.scorelect.com"
]}})

# Initialize Talisman for CSP
csp = {
    'default-src': [
        "'self'",
        'https://js.stripe.com',
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com'
    ],
    'style-src': [
        "'self'",
        'https://fonts.googleapis.com',
        "'unsafe-inline'"
    ],
    'style-src-elem': [
        "'self'",
        'https://fonts.googleapis.com',
        "'unsafe-inline'"
    ],
    'font-src': [
        "'self'",
        'https://fonts.gstatic.com',
        'data:'
    ],
    'script-src': [
        "'self'",
        'https://js.stripe.com'
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
        'https://api.openai.com'  # Added OpenAI API endpoint
    ]
}

Talisman(app, content_security_policy=csp)

# Initialize Stripe
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

# Initialize Firebase
firebase_config = {
    "type": os.getenv("FIREBASE_TYPE"),
    "project_id": os.getenv("FIREBASE_PROJECT_ID"),
    "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID"),
    "private_key": os.getenv("FIREBASE_PRIVATE_KEY").replace('\\n', '\n'),
    "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
    "client_id": os.getenv("FIREBASE_CLIENT_ID"),
    "auth_uri": os.getenv("FIREBASE_AUTH_URI"),
    "token_uri": os.getenv("FIREBASE_TOKEN_URI"),
    "auth_provider_x509_cert_url": os.getenv("FIREBASE_AUTH_PROVIDER_CERT_URL"),
    "client_x509_cert_url": os.getenv("FIREBASE_CLIENT_CERT_URL"),
    "universe_domain": os.getenv("FIREBASE_UNIVERSE_DOMAIN")
}
cred = credentials.Certificate(firebase_config)
firebase_admin.initialize_app(cred)
db = firestore.client()

# Set up OpenAI API key
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))


# Endpoint to create a Stripe checkout session
@app.route('/create-checkout-session', methods=['POST'])
def create_checkout_session():
    try:
        data = request.json
        email = data.get('email')
        uid = data.get('uid')
        coupon = data.get('coupon')  # Get coupon code if provided

        if not email or not uid:
            logging.error("Email or UID not provided.")
            return jsonify({'error': 'Email and UID are required.'}), 400

        # Create Stripe Checkout session
        success_url = f'https://scorelect.com/profile?session_id={{CHECKOUT_SESSION_ID}}&uid={uid}'
        cancel_url = 'https://scorelect.com/cancel'

        session_data = {
            'payment_method_types': ['card'],
            'customer_email': email,
            'line_items': [{
                'price': 'price_1PSb9kRsFqpmi3sgRjiYWmAp',  # Replace with your actual price ID
                'quantity': 1,
            }],
            'mode': 'subscription',
            'success_url': success_url,
            'cancel_url': cancel_url,
        }

        # Include coupon code if available
        if coupon:
            session_data['discounts'] = [{'coupon': coupon}]

        session = stripe.checkout.Session.create(**session_data)

        logging.info(f"Created checkout session for UID: {uid}")
        return jsonify({'url': session.url})  # Changed from {'id': session.id} to {'url': session.url}
    except Exception as e:
        logging.error(f"Error creating checkout session: {str(e)}")
        return jsonify(error=str(e)), 400

# Endpoint to renew subscription
@app.route('/renew-subscription', methods=['POST'])
def renew_subscription():
    try:
        data = request.json
        uid = data.get('uid')

        if not uid:
            logging.error("UID not provided for renewal.")
            return jsonify({'error': 'UID is required.'}), 400

        # Fetch user document
        user_doc = db.collection('users').document(uid).get()
        if not user_doc.exists():
            logging.error(f"User not found for UID: {uid}")
            return jsonify({'error': 'User not found'}), 404

        user_data = user_doc.to_dict()
        customer_email = user_data.get('email')

        if not customer_email:
            logging.error(f"Email not found for UID: {uid}")
            return jsonify({'error': 'User email not found'}), 400

        logging.info(f"Creating renewal session for user {uid}")

        # Create a new Checkout Session for subscription renewal
        success_url = f'https://scorelect.com/profile?session_id={{CHECKOUT_SESSION_ID}}&uid={uid}'
        cancel_url = 'https://scorelect.com/profile'

        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            mode='subscription',
            customer_email=customer_email,
            line_items=[{
                'price': 'price_1PSb9kRsFqpmi3sgRjiYWmAp',  # Replace with your actual price ID
                'quantity': 1,
            }],
            success_url=success_url,
            cancel_url=cancel_url,
        )

        logging.info(f"Created renewal checkout session for user {uid}")
        return jsonify({'checkoutUrl': session.url})
    except Exception as e:
        logging.error(f"Error renewing subscription: {str(e)}")
        return jsonify(error=str(e)), 400

# Endpoint to cancel subscription
@app.route('/cancel-subscription', methods=['POST'])
def cancel_subscription():
    try:
        data = request.json
        subscription_id = data.get('subscriptionId')
        uid = data.get('uid')

        if not subscription_id or not uid:
            logging.error("Subscription ID or UID not provided for cancellation.")
            return jsonify({'error': 'Subscription ID and UID are required.'}), 400

        # Set the subscription to cancel at period end
        subscription = stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=True
        )

        logging.info(f"Set subscription {subscription_id} to cancel at period end for user {uid}")
        return jsonify({"success": True, "subscription": subscription})
    except Exception as e:
        logging.error(f"Error canceling subscription: {str(e)}")
        return jsonify(error=str(e)), 400

# Endpoint to get subscription details
@app.route('/get-subscription', methods=['POST'])
def get_subscription():
    try:
        data = request.json
        subscription_id = data.get('subscriptionId')
        session_id = data.get('session_id')
        uid = data.get('uid')

        if subscription_id:
            # Fetch subscription using subscription_id
            subscription = stripe.Subscription.retrieve(subscription_id)
        elif session_id and uid:
            # Fetch session using session_id
            session = stripe.checkout.Session.retrieve(session_id)
            subscription_id = session.get('subscription')
            if not subscription_id:
                logging.error("Subscription ID not found in session.")
                return jsonify({'error': 'Subscription ID not found in session.'}), 400

            # Fetch subscription using subscription_id
            subscription = stripe.Subscription.retrieve(subscription_id)

            # Save subscription_id and role to Firestore
            user_ref = db.collection('users').document(uid)
            user_ref.set({'subscriptionId': subscription_id, 'role': 'paid'}, merge=True)
            logging.info(f"Updated user {uid} with subscription ID and set role to paid.")

        else:
            logging.error("Subscription ID or Session ID with UID not provided.")
            return jsonify({'error': 'Subscription ID or Session ID with UID is required.'}), 400

        return jsonify(subscription)
    except Exception as e:
        logging.error(f"Error retrieving subscription: {str(e)}")
        return jsonify(error=str(e)), 400

# Endpoint to retrieve Stripe session details
@app.route('/retrieve-session', methods=['POST'])
def retrieve_session():
    try:
        data = request.json
        session_id = data.get('session_id')

        if not session_id:
            logging.error("Session ID not provided.")
            return jsonify({'error': 'Session ID is required.'}), 400

        session = stripe.checkout.Session.retrieve(session_id)

        return jsonify(session)
    except Exception as e:
        logging.error(f"Error retrieving session: {str(e)}")
        return jsonify(error=str(e)), 400

# Endpoint to save a game
@app.route('/save-game', methods=['POST'])
def save_game():
    try:
        data = request.json
        user_id = data.get('uid')
        game_name = data.get('gameName')
        game_data = data.get('gameData')

        if not user_id or not game_name or not game_data:
            logging.error("Incomplete game data provided.")
            return jsonify({'error': 'UID, gameName, and gameData are required.'}), 400

        game_doc_ref = db.collection('savedGames').document(user_id).collection('games').document(game_name)
        game_doc_ref.set({'gameData': game_data}, merge=True)

        logging.info(f"Game '{game_name}' saved for user {user_id}")
        return jsonify({"success": True})
    except Exception as e:
        logging.error(f"Error saving game: {str(e)}")
        return jsonify(error=str(e)), 400

# Endpoint to load games
@app.route('/load-games', methods=['POST'])
def load_games():
    try:
        data = request.json
        user_id = data.get('uid')

        if not user_id:
            logging.error("UID not provided for loading games.")
            return jsonify({'error': 'UID is required.'}), 400

        games_ref = db.collection('savedGames').document(user_id).collection('games')
        games = []
        for doc in games_ref.stream():
            game_data = doc.to_dict()
            game_data['gameName'] = doc.id
            games.append(game_data)

        logging.info(f"Loaded {len(games)} games for user {user_id}")
        return jsonify(games)
    except Exception as e:
        logging.error(f"Error loading games: {str(e)}")
        return jsonify(error=str(e)), 400

# Endpoint to generate AI insights
@app.route('/generate-insights', methods=['POST'])
@cross_origin()
def generate_insights():
    try:
        data = request.json
        logging.info(f"Received data from frontend: {data}")

        summary = data.get('summary')

        if not summary:
            logging.error("Summary not provided for AI insights generation.")
            return jsonify({'error': 'Summary is required.'}), 400

        # Prepare the messages for the OpenAI Chat Completion
        messages = [
            {
                "role": "system",
                "content": "You are a football analyst. Provide tactical and positional advice based on the data provided."
            },
            {
                "role": "user",
                "content": summary
            }
        ]

        logging.info(f"Sending messages to OpenAI API: {messages}")

        # Use the new API method
        completion = client.chat.completions.create(
            model="gpt-4o",  # Make sure this is an available model in your API key
            messages=messages,
            max_tokens=500,
            n=1,
            temperature=0.7,
            stream=True
        )

        insights = ""
        for chunk in completion:
            content = getattr(chunk.choices[0].delta, 'content', None)
            if content:
                insights += content

        logging.info("AI insights generated successfully.")
        return jsonify({'insights': insights})

    except OpenAIError as e:
        logging.error(f"OpenAI API Error: {str(e)}", exc_info=True)
        return jsonify({'error': f'OpenAI API Error: {str(e)}'}), 500
    except Exception as e:
        logging.error(f"Error generating AI insights: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to generate AI insights: {str(e)}'}), 500

# Endpoint to refresh subscription status (manual trigger)
@app.route('/refresh-subscription-status', methods=['POST'])
def refresh_subscription_status():
    try:
        data = request.json
        uid = data.get('uid')
        stripe_customer_id = data.get('stripeCustomerId')

        if not uid or not stripe_customer_id:
            return jsonify({'error': 'UID and Stripe Customer ID are required.'}), 400

        retrieve_and_update_subscription(uid, stripe_customer_id)
        return jsonify({'message': 'Subscription status updated successfully.'})
    except Exception as e:
        logging.error(f"Error refreshing subscription status: {str(e)}")
        return jsonify({'error': 'Failed to refresh subscription status.'}), 500

# Stripe webhook endpoint
@app.route('/stripe-webhook', methods=['POST'])
def stripe_webhook():
    payload = request.get_data(as_text=True)
    sig_header = request.headers.get('Stripe-Signature')
    endpoint_secret = os.getenv('STRIPE_WEBHOOK_SECRET')

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
        logging.info(f"Received event: {event['type']}")

        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            customer_id = session['customer']

            user_docs = db.collection('users').where('stripeCustomerId', '==', customer_id).get()
            for doc in user_docs:
                uid = doc.id
                retrieve_and_update_subscription(uid, customer_id)

        return jsonify(success=True)
    except stripe.error.SignatureVerificationError as e:
        logging.error(f"Signature verification error: {str(e)}")
        return jsonify(error=str(e)), 400
    except Exception as e:
        logging.error(f"Webhook error: {str(e)}")
        return jsonify(error=str(e)), 500

# Handle failed payment event from Stripe
def handle_failed_payment(subscription_id):
    if subscription_id is None:
        logging.error("Subscription ID is missing from the payment failed event.")
        return

    try:
        user_docs = db.collection('users').where('subscriptionId', '==', subscription_id).get()

        if not user_docs:
            logging.info(f"No user found for subscription: {subscription_id}")
            return

        for doc in user_docs:
            user_ref = db.collection('users').document(doc.id)
            user_ref.set({'role': 'free'}, merge=True)
            logging.info(f"Updated user {doc.id} to free plan due to payment failure.")

    except Exception as e:
        logging.error(f"Error handling failed payment for subscription {subscription_id}: {str(e)}")

# Function to retrieve subscription status and update Firestore
def retrieve_and_update_subscription(uid, customer_id):
    try:
        # Retrieve the customer's subscription from Stripe
        subscriptions = stripe.Subscription.list(customer=customer_id)

        if subscriptions and subscriptions['data']:
            subscription = subscriptions['data'][0]
            status = subscription['status']  # Can be 'active', 'canceled', 'incomplete', etc.

            # Update the Firestore role based on subscription status
            user_ref = db.collection('users').document(uid)
            if status in ['active', 'trialing']:
                user_ref.set({'role': 'paid'}, merge=True)
                logging.info(f"Updated user {uid} to paid plan.")
            else:
                user_ref.set({'role': 'free'}, merge=True)
                logging.info(f"Updated user {uid} to free plan due to subscription status: {status}")
        else:
            logging.warning(f"No active subscription found for customer {customer_id}.")
            user_ref.set({'role': 'free'}, merge=True)

    except Exception as e:
        logging.error(f"Error retrieving subscription for customer {customer_id}: {str(e)}")


# Handle subscription cancellation
def handle_subscription_cancel(subscription_id):
    try:
        user_docs = db.collection('users').where('subscriptionId', '==', subscription_id).get()

        if not user_docs:
            logging.info(f"No user found for subscription: {subscription_id}")
            return

        for doc in user_docs:
            user_ref = db.collection('users').document(doc.id)
            user_ref.set({'role': 'free', 'subscriptionId': None}, merge=True)
            logging.info(f"Subscription {subscription_id} canceled. Updated user {doc.id} to free plan.")

    except Exception as e:
        logging.error(f"Error handling subscription cancel for {subscription_id}: {str(e)}")

# Handle subscription update (e.g., reactivation)
def handle_subscription_update(subscription):
    try:
        subscription_id = subscription['id']
        status = subscription['status']
        user_docs = db.collection('users').where('subscriptionId', '==', subscription_id).get()

        if not user_docs:
            logging.info(f"No user found for subscription: {subscription_id}")
            return

        for doc in user_docs:
            user_ref = db.collection('users').document(doc.id)
            if status in ['active', 'trialing']:
                user_ref.set({'role': 'paid'}, merge=True)
                logging.info(f"Updated user {doc.id} to paid plan.")
            else:
                user_ref.set({'role': 'free'}, merge=True)
                logging.info(f"Updated user {doc.id} to free plan due to subscription status: {status}")

    except Exception as e:
        logging.error(f"Error handling subscription update for subscription {subscription_id}: {str(e)}")

# Handle checkout.session.completed event
def handle_checkout_session_completed(session):
    try:
        subscription_id = session.get('subscription')
        customer_email = session.get('customer_email')

        if not subscription_id or not customer_email:
            logging.error("Missing subscription ID or customer email in session.")
            return

        # Retrieve the user by email
        user_docs = db.collection('users').where('email', '==', customer_email).get()

        if not user_docs:
            logging.error(f"No user found with email: {customer_email}")
            return

        for doc in user_docs:
            user_ref = db.collection('users').document(doc.id)
            user_ref.set({
                'role': 'paid',
                'subscriptionId': subscription_id
            }, merge=True)
            logging.info(f"Updated user {doc.id} with subscription ID and set role to paid.")

    except Exception as e:
        logging.error(f"Error handling checkout.session.completed: {str(e)}")

if __name__ == '__main__':
    app.run(port=5001, debug=True)
