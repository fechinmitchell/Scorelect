// src/Signup.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
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

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      setLoading(false);
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setMessage('Successfully signed up!');
      window.location.href = 'https://buy.stripe.com/9AQcQEbrCdMJ5567ss';
    } catch (error) {
      console.error('Error signing up:', error);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <form onSubmit={handleSignUp} className="auth-form">
        <img src={logo} alt="Scorelect Logo" className="logo" />
        <h2>Sign Up</h2>
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
          <button type="submit" disabled={loading}>
            {loading ? 'Signing Up...' : 'Sign Up'}
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
