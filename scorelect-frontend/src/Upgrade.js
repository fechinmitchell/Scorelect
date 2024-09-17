// src/Upgrade.js
import React, { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { loadStripe } from '@stripe/stripe-js';
import './Upgrade.css';
import './AuthForm.css';

const stripePromise = loadStripe('your-publishable-key'); // Replace with your Stripe publishable key

const Upgrade = ({ setUserRole }) => {
  const [loading, setLoading] = useState(false);
  const auth = getAuth();

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (user) {
        // Send email and uid to backend to create checkout session
        const response = await fetch(`${process.env.REACT_APP_API_URL}/create-checkout-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: user.email,
            uid: user.uid,
          }),
        });

        const session = await response.json();
        if (session.error) {
          console.error(session.error);
          setLoading(false);
          return;
        }

        // Redirect to Stripe Checkout
        const stripe = await stripePromise;
        await stripe.redirectToCheckout({ sessionId: session.id });
      }
    } catch (error) {
      console.error('Error upgrading:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upgrade-container">
      <h2>Upgrade to Scorelect Pro for €5/$5.50 a month</h2>
      <p>Unlock premium features and enhance your experience.</p>
      <div className="pro-features">
        <h3>Benefits of Scorelect Pro</h3>
        <ul>
          <li>Unlimited data collection downloads</li>
          <li>Unlimited access to saved games</li>
          <li>Priority customer support</li>
          <li>Ad-free experience</li>
        </ul>
      </div>
      <button onClick={handleUpgrade} className="upgrade-button" disabled={loading}>
        {loading ? 'Processing...' : 'Upgrade Now'}
      </button>
    </div>
  );
};

export default Upgrade;
