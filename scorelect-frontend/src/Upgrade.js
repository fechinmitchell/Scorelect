// src/Upgrade.js
import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import { useNavigate } from 'react-router-dom';
import './Upgrade.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const CheckoutForm = ({ setUserRole }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const auth = getAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: elements.getElement(CardElement),
      billing_details: {
        email: email,
      },
    });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const response = await fetch(`${process.env.REACT_APP_API_URL}/create-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        payment_method: paymentMethod.id,
        uid: auth.currentUser.uid,
      }),
    });

    const subscription = await response.json();

    if (subscription.error) {
      console.error(subscription.error);
      setLoading(false);
      return;
    }

    // Update user role in Firestore to 'paid'
    await setDoc(doc(firestore, 'users', auth.currentUser.uid), { role: 'paid' }, { merge: true });

    // Navigate to a success page or redirect after payment
    navigate('/pitchgraphic');
  };

  return (
    <div className="upgrade-container">
      <h2>Upgrade to Scorelect Pro for €5/$5.50 a month</h2>
      <p>Unlock premium features and enhance your experience.</p>
      <div className="upgrade-benefits">
        <h3>Benefits:</h3>
        <ul>
          <li>Unlimited data collection downloads</li>
          <li>Unlimited access to saved games</li>
          <li>Priority customer support</li>
          <li>Ad-free experience</li>
        </ul>
      </div>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="input-field"
        />
        <CardElement className="card-element" />
        <button type="submit" className="upgrade-button" disabled={!stripe || loading}>
          {loading ? 'Processing...' : 'Subscribe'}
        </button>
      </form>
    </div>
  );
};

const Upgrade = ({ setUserRole }) => (
  <Elements stripe={stripePromise}>
    <CheckoutForm setUserRole={setUserRole} />
  </Elements>
);

export default Upgrade;
