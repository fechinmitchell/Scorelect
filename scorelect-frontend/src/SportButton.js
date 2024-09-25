// src/components/SportButton.js
import React from 'react';
import styled from 'styled-components';
import PropTypes from 'prop-types';
import { FaFutbol, FaFootballBall, FaVolleyballBall, FaBasketballBall } from 'react-icons/fa';

const Button = styled.button`
  background-color: ${(props) => (props.active ? '#5e2e8f' : '#501387')};
  color: white;
  border: none;
  padding: 15px 25px;
  margin: 10px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  transition: background 0.3s, transform 0.3s;

  &:hover {
    background-color: #663399;
    transform: scale(1.05);
  }

  & > svg {
    margin-right: 10px;
  }
`;

const SportButton = ({ sport, onClick, active }) => {
  const getIcon = (sport) => {
    switch (sport) {
      case 'Soccer':
        return <FaFutbol />;
      case 'GAA':
        return <FaVolleyballBall />;
      case 'AmericanFootball':
        return <FaFootballBall />;
      case 'Basketball':
        return <FaBasketballBall />;
      default:
        return <FaFutbol />;
    }
  };

  return (
    <Button onClick={() => onClick(sport)} active={active} aria-label={`Select ${sport}`}>
      {getIcon(sport)}
      {sport}
    </Button>
  );
};

SportButton.propTypes = {
  sport: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  active: PropTypes.bool, // New prop for active state
};

SportButton.defaultProps = {
  active: false,
};

export default SportButton;
