// src/components/ErrorBoundary.js

import React from 'react';
import PropTypes from 'prop-types';
import './ErrorBoundary.css'; // Ensure this file exists with desired styles

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError(error) {
    // Update state to display fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to an error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // Optionally, send the error to an external service here
  }

  handleRetry() {
    this.setState({ hasError: false });
    // Optionally, you can refresh the page or reset certain states
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return (
        <div className="error-boundary">
          <h2>Something went wrong.</h2>
          <p>We're working to fix the issue. Please try again later.</p>
          <button onClick={this.handleRetry}>Retry</button>
        </div>
      );
    }

    return this.props.children; 
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ErrorBoundary;
