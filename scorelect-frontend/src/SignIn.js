import React, { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import { useNavigate } from 'react-router-dom';
import './AuthForm.css';
import backgroundImage from './assests/background/galwaybg.jpeg';
import logo from './assests/logo/scorelectlogo.jpeg';

const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const navigate = useNavigate();
  const auth = getAuth();

  // Function to refresh subscription status
  const refreshSubscriptionStatus = async (uid, stripeCustomerId) => {
    try {
      const response = await fetch('https://your-backend-url.com/refresh-subscription-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid, stripeCustomerId }),
      });

      const data = await response.json();
      if (response.ok) {
        console.log('Subscription status updated successfully:', data);
      } else {
        console.error('Error updating subscription status:', data.error);
      }
    } catch (error) {
      console.error('Error calling refresh subscription status API:', error);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      const user = auth.currentUser;
      if (user) {
        // Check if user document exists and has email
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists() || !userDoc.data().email) {
          // Update Firestore user document with email
          await setDoc(userDocRef, { email: user.email }, { merge: true });
        }

        // Check if user has a Stripe customer ID and refresh subscription status
        const userData = userDoc.data();
        if (userData && userData.stripeCustomerId) {
          await refreshSubscriptionStatus(user.uid, userData.stripeCustomerId);
        }

        setMessage('Successfully signed in!');
        navigate('/');
      }
    } catch (error) {
      console.error('Error signing in:', error);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage('Password reset email sent!');
    } catch (error) {
      console.error('Error sending password reset email:', error);
      setResetMessage(error.message);
    }
  };

  return (
    <div className="auth-container" style={{ backgroundImage: `url(${backgroundImage})` }}>
      {showResetForm ? (
        <form onSubmit={handlePasswordReset} className="auth-form">
          <img src={logo} alt="Scorelect Logo" className="logo" />
          <h2>Reset Password</h2>
          {resetMessage && <div className="auth-message">{resetMessage}</div>}
          <input
            type="email"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="Email"
            required
          />
          <button type="submit">Send Reset Email</button>
          <button type="button" onClick={() => setShowResetForm(false)} className="switch-auth">
            Back to Sign In
          </button>
        </form>
      ) : (
        <form onSubmit={handleSignIn} className="auth-form">
          <img src={logo} alt="Scorelect Logo" className="logo" />
          <h2>Sign In</h2>
          {message && <div className="auth-message">{message}</div>}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
          <div className="switch-auth">
            <span>Don't have an account?</span>
            <button type="button" onClick={() => navigate('/signup')} className="link-button">
              Sign Up
            </button>
          </div>
          <div className="switch-auth">
            <button type="button" onClick={() => setShowResetForm(true)} className="link-button">
              Forgot Password?
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default SignIn;
