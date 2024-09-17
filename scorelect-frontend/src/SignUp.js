// src/SignUp.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { firestore } from './firebase';
import './AuthForm.css';
import backgroundImage from './assests/background/galwaybg.jpeg'; // Corrected 'assests' to 'assets'
import logo from './assests/logo/scorelectlogo.jpeg'; // Corrected 'assests' to 'assets'

const SignUp = () => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState(''); // Added fullName state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // Added confirmPassword state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const auth = getAuth();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Password confirmation check
    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save user data to Firestore
      await setDoc(doc(firestore, 'users', user.uid), {
        email: user.email,
        fullName: fullName,
        role: 'free',
      });

      setMessage('Successfully signed up!');

      // Optionally, redirect the user to the upgrade page
      // navigate('/upgrade');

      // Or, if you want to redirect to the main page
      navigate('/');

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
