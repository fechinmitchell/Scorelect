// src/StripeSetup.js
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const StripeSetup = ({ children }) => {
  return <Elements stripe={stripePromise}>{children}</Elements>;
};

export default StripeSetup;
 