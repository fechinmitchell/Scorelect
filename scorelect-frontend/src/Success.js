// src/Success.js
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import './Success.css'; // Import the CSS file
import { FaCheckCircle } from 'react-icons/fa'; // Import a success icon from React Icons

const Success = ({ setUserRole }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = getAuth();
  const [countdown, setCountdown] = useState(3); // Initialize countdown to 3 seconds

  useEffect(() => {
    const updateUserRole = async () => {
      const query = new URLSearchParams(location.search);
      const sessionId = query.get('session_id');
      const uid = query.get('uid'); // Extracted from the success_url

      if (sessionId && uid) {
        try {
          // Fetch the session from your backend to get the subscription ID
          const response = await fetch(`${process.env.REACT_APP_API_URL}/retrieve-session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ session_id: sessionId }),
          });

          const session = await response.json();
          if (session && session.subscription) {
            const subscriptionId = session.subscription;

            // Update Firestore with the subscription ID and set role to 'paid'
            await setDoc(doc(firestore, 'users', uid), { role: 'paid', subscriptionId }, { merge: true });

            setUserRole('paid');
          }
        } catch (error) {
          console.error('Error updating user role:', error);
        }

        // Start countdown for redirection
        const timer = setInterval(() => {
          setCountdown((prev) => prev - 1);
        }, 1000);

        // Redirect after countdown reaches 0
        const redirectTimer = setTimeout(() => {
          navigate('/', { replace: true });
        }, 6000); // 6 seconds

        // Cleanup timers on unmount
        return () => {
          clearInterval(timer);
          clearTimeout(redirectTimer);
        };
      } else {
        // If session_id or uid is missing, redirect to home
        navigate('/', { replace: true });
      }
    };

    updateUserRole();
  }, [location, navigate, setUserRole]);

  return (
    <div className="success-container">
      <FaCheckCircle className="success-icon" />
      <h2>Payment Successful!</h2>
      <p>Thank you for your purchase. You will be redirected to the home page shortly.</p>
      <div className="spinner"></div> {/* Loading spinner */}
      <div className="countdown">Redirecting in {countdown}...</div>
      <button
        className="redirect-button"
        onClick={() => navigate('/', { replace: true })}
      >
        Go to Home Now
      </button>
    </div>
  );
};

export default Success;
