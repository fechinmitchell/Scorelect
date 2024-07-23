// src/Upgrade.js
import React, { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import './Upgrade.css';
import './AuthForm.css';

const Upgrade = ({ setUserRole }) => {
  const [loading, setLoading] = useState(false);
  const auth = getAuth();

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (user) {
        // Update Firestore user role to 'paid'
        await setDoc(doc(firestore, 'users', user.uid), { role: 'paid' }, { merge: true });
        setUserRole('paid');
        
        // Redirect to Stripe payment page
        window.location.href = 'https://buy.stripe.com/9AQcQEbrCdMJ5567ss';
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

