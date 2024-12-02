// ParentComponent.js
import React, { useState, useEffect } from 'react';
import Schedule from './Schedule';

const ParentComponent = () => {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState('free'); // Default to 'free'

  useEffect(() => {
    // Mock user authentication and type fetching
    // Replace this with your actual authentication and user type logic
    const fetchUser = async () => {
      // Simulate an API call
      const mockUser = await new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              id: 'user123',
              type: 'premium', // Change to 'free' to test
            }),
          1000
        )
      );
      setUser(mockUser);
      setUserType(mockUser.type);
    };
    fetchUser();
  }, []);

  if (!user) {
    return <p>Loading user data...</p>;
  }

  return (
    <div>
      <Schedule userId={user.id} userType={userType} />
    </div>
  );
};

export default ParentComponent;
