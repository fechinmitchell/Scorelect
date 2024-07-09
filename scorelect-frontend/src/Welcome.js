import React from 'react';
import { Link } from 'react-router-dom';

const Welcome = () => {
  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>Welcome to Scorelect</h1>
      <div style={{ marginTop: '20px' }}>
        <Link to="/login">
          <button>Login</button>
        </Link>
        <Link to="/signup" style={{ marginLeft: '10px' }}>
          <button>Sign Up</button>
        </Link>
      </div>
    </div>
  );
};

export default Welcome;
 