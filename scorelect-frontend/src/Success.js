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

      if (sessionId) {
        const user = auth.currentUser;
        if (user) {
          await setDoc(doc(firestore, 'users', user.uid), { role: 'paid' }, { merge: true });
          setUserRole('paid');
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
