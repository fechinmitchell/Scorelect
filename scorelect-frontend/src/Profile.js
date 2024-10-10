import React, { useEffect, useState } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { firestore } from './firebase';
import { doc, getDoc } from 'firebase/firestore'; // Removed setDoc
import { useNavigate } from 'react-router-dom';
import './Profile.css';
import { FaUserCircle } from 'react-icons/fa'; // Import a user avatar icon

const Profile = ({ onLogout }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // State for user role
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (currentUser) {
      setUser(currentUser);
      // Fetch user role from Firestore
      fetchUserRole(currentUser.uid);
    } else {
      console.log('User not authenticated, redirecting to sign-in page');
      // If user is not authenticated, redirect to sign-in page
      navigate('/signin');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const fetchUserRole = async (uid) => {
    setLoading(true);
    setError(null);
    console.log('Fetching user role for UID:', uid);
    try {
      const userDocRef = doc(firestore, 'users', uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('User data retrieved from Firestore:', userData);
        setUserRole(userData.role); // Set the user role (paid/free)
      } else {
        console.log('User document not found');
        setError('User data not found.');
        setUserRole(null);
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
      setError(error.message);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = () => {
    const subject = encodeURIComponent("Cancel Subscription Request");
    const body = encodeURIComponent(`Hello,\n\nI would like to cancel my subscription. My email is ${user.email}.\n\nThank you.`);
    const recipient = "scorelectapp@gmail.com";

    // Open the user's default email client with pre-filled subject and body
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  };

  const handleRenewSubscription = () => {
    // Redirect the user to the Stripe payment link with uid as query param
    window.location.href = `https://buy.stripe.com/9AQcQEbrCdMJ5567ss`;
  };

  const handleLogout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      if (onLogout) onLogout();
      navigate('/signin');
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Error signing out: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="profile-container">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <h2>Profile</h2>
      {error && <div className="error-message">{error}</div>}
      {user && (
        <>
          <div className="user-info">
            <FaUserCircle className="avatar-icon" />
            <p><strong>Email:</strong> {user.email}</p>
          </div>
          <button onClick={handleLogout} className="logout-button">Logout</button>

          {userRole === 'paid' ? (
            <>
              <h3>Subscription Details</h3>
              <p>You are currently subscribed. Thank you for your support.</p>
              <button className="cancel-button" onClick={handleCancelSubscription}>Cancel Subscription</button>
            </>
          ) : (
            <>
              <p>You currently have no active subscription. Please subscribe to access premium features.</p>
              <button className="renew-button" onClick={handleRenewSubscription}>Subscribe</button>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Profile;
