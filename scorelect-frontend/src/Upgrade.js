// src/Upgrade.js
import React, { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import './Upgrade.css';

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
      <div className="upgrade-benefits">
        <h3>Benefits:</h3>
        <ul>
          <li>Unlimited sessions</li>
          <li>Access to advanced analytics</li>
          <li>Priority support</li>
        </ul>
      </div>
      <button onClick={handleUpgrade} className="upgrade-button" disabled={loading}>
        {loading ? 'Processing...' : 'Upgrade Now'}
      </button>
    </div>
  );
};

export default Upgrade;

