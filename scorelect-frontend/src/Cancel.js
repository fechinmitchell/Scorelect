import React from 'react';
import { useNavigate } from 'react-router-dom';

const Cancel = () => {
  const navigate = useNavigate();

  return (
    <div>
      <h2>Payment Canceled</h2>
      <button onClick={() => navigate('/upgrade')}>Try Again</button>
    </div>
  );
};

export default Cancel;
