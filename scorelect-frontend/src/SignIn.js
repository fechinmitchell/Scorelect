// src/SignIn.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore';
import { firestore } from './firebase';
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
 
  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setMessage('Successfully signed in!');
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(firestore, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role === 'paid') {
          navigate('/profile');
        } else {
          navigate('/pitch');
        }
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
            <button type="button" onClick={() => navigate('/signup')} className="link-button">Sign Up</button>
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
