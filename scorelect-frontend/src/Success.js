// src/Success.js
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';

const Success = ({ setUserRole }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();

  useEffect(() => {
    const updateUserRole = async () => {
      const query = new URLSearchParams(location.search);
      const sessionId = query.get('session_id');
      const uid = query.get('uid');

      if (sessionId && uid) {
        const user = auth.currentUser;
        if (user) {
          // Fetch the session from Stripe to get the subscription ID
          const response = await fetch(`${process.env.REACT_APP_API_URL}/get-subscription`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ subscriptionId: sessionId }),
          });

          const subscriptionData = await response.json();
          if (!subscriptionData.error) {
            const subscriptionId = subscriptionData.id;
            await setDoc(doc(firestore, 'users', uid), { role: 'paid', subscriptionId }, { merge: true });
            setUserRole('paid');
          }
        }
        // Redirect to the main home page after successful payment
        window.location.href = 'https://www.scorelect.com/';
      }
    };

    updateUserRole();
  }, [location, auth, navigate, setUserRole]);

  return (
    <div>
      <h2>Payment Successful</h2>
      <p>You will be redirected to the main home page shortly...</p>
    </div>
  );
};

export default Success;
