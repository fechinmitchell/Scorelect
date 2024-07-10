# backend/app.py
import os
import stripe
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_talisman import Talisman
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000", "https://scorelect.vercel.app", "https://scorelect.com", "https://www.scorelect.com"]}})

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
        'https://*.firebase.com'
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

@app.route('/create-checkout-session', methods=['POST'])
def create_checkout_session():
    try:
        data = request.json
        email = data.get('email')
        uid = data.get('uid')

        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            customer_email=email,
            line_items=[{
                'price': 'price_1PSb9kRsFqpmi3sgRjiYWmAp',  # Replace with your actual price ID
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f'https://scorelect.com/success?session_id={{CHECKOUT_SESSION_ID}}&uid={uid}',
            cancel_url='https://scorelect.com/cancel',
        )

        return jsonify({'id': session.id})
    except Exception as e:
        return jsonify(error=str(e)), 400

@app.route('/cancel-subscription', methods=['POST'])
def cancel_subscription():
    try:
        data = request.json
        subscription_id = data.get('subscriptionId')
        stripe.Subscription.delete(subscription_id)

        # Optionally update the user role in Firestore
        user_doc_ref = db.collection('users').document(data.get('uid'))
        user_doc_ref.set({'role': 'free', 'subscriptionId': None}, merge=True)

        return jsonify({"success": True})
    except Exception as e:
        return jsonify(error=str(e)), 400

@app.route('/get-subscription', methods=['POST'])
def get_subscription():
    try:
        data = request.json
        subscription_id = data.get('subscriptionId')
        subscription = stripe.Subscription.retrieve(subscription_id)

        return jsonify(subscription)
    except Exception as e:
        return jsonify(error=str(e)), 400

@app.route('/save-game', methods=['POST'])
def save_game():
    try:
        data = request.json
        user_id = data.get('uid')
        game_name = data.get('gameName')
        game_data = data.get('gameData')

        game_doc_ref = db.collection('savedGames').document(user_id).collection('games').document(game_name)
        game_doc_ref.set({'gameData': game_data}, merge=True)

        return jsonify({"success": True})
    except Exception as e:
        return jsonify(error=str(e)), 400

@app.route('/retrieve-session', methods=['POST'])
def retrieve_session():
    try:
        data = request.json
        session_id = data.get('session_id')
        session = stripe.checkout.Session.retrieve(session_id)

        return jsonify(session)
    except Exception as e:
        return jsonify(error=str(e)), 400


@app.route('/load-games', methods=['POST'])
def load_games():
    try: 
        data = request.json
        user_id = data.get('uid')

        games_ref = db.collection('savedGames').document(user_id).collection('games')
        games = [doc.to_dict() for doc in games_ref.stream()]

        return jsonify(games)
    except Exception as e:
        return jsonify(error=str(e)), 400

if __name__ == '__main__':
    app.run(port=5001, debug=True)
