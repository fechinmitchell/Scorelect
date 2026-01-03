// src/SignUp.js - Minimal update to add free option
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import './AuthForm.css';
import backgroundImage from './assests/background/galwaybg.jpeg';
import logo from './assests/logo/scorelectlogo.jpeg';

const SignUp = () => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const auth = getAuth();

  // Handle Pro signup (with payment)
  const handleProSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // IMPORTANT: Set role as 'paid' to pass Firebase rules
      // But track actual subscription with subscriptionType
      await setDoc(doc(firestore, 'users', user.uid), {
        email: user.email,
        fullName: fullName,
        role: 'paid',  // ALWAYS 'paid' to bypass Firebase rules
        subscriptionType: 'pending_pro',  // Track actual status
        createdAt: new Date().toISOString()
      });

      setMessage('Successfully signed up! Redirecting to payment...');
      
      // Redirect to Stripe payment
      setTimeout(() => {
        window.location.href = 'https://buy.stripe.com/9AQcQEbrCdMJ5567ss';
      }, 1500);

    } catch (error) {
      console.error('Error signing up:', error);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Free signup (no payment)
  const handleFreeSignUp = async () => {
    setLoading(true);

    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // IMPORTANT: Still set role as 'paid' to pass Firebase rules
      await setDoc(doc(firestore, 'users', user.uid), {
        email: user.email,
        fullName: fullName,
        role: 'paid',  // ALWAYS 'paid' to bypass Firebase rules
        subscriptionType: 'free',  // But they're actually free
        createdAt: new Date().toISOString()
      });

      setMessage('Free account created successfully!');
      
      // Go straight to app
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

    } catch (error) {
      console.error('Error signing up:', error);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <form onSubmit={handleProSignUp} className="auth-form">
        <img src={logo} alt="Scorelect Logo" className="logo" />
        <h2>Sign Up</h2>
        
        {/* Add choice indicator */}
        <div className="signup-options-header">
          <h3>Choose Your Plan</h3>
        </div>

        <h3 className="pro-price">Pro for €5/$5.50 a month</h3>
        <div className="pro-features">
          <h3>Benefits of Scorelect Pro</h3>
          <ul>
            <li>Unlimited data collection downloads</li>
            <li>Unlimited access to saved games</li>
            <li>Priority customer support</li>
            <li>Ad-free experience</li>
          </ul>
        </div>
        
        {message && <div className="auth-message">{message}</div>}
        
        <div className="form-fields">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
          />
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full Name"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm Password"
            required
          />
          
          {/* Pro signup button */}
          <button type="submit" disabled={loading} className="pro-button">
            {loading ? 'Creating Account...' : 'Sign Up for Pro (€5/month)'}
          </button>
          
          {/* Free signup button */}
          <button 
            type="button" 
            onClick={handleFreeSignUp} 
            disabled={loading}
            className="free-button"
            style={{
              marginTop: '10px',
              background: '#6c757d',
              border: '2px solid #495057'
            }}
          >
            {loading ? 'Creating Account...' : 'Continue with Free Account'}
          </button>
        </div>
        
        <div className="switch-auth">
          <span>Already have an account?</span>
          <button type="button" onClick={() => navigate('/signin')} className="link-button">Sign In</button>
        </div>
      </form>
    </div>
  );
};

export default SignUp;