// storage.js

/**
 * Saves user data to localStorage.
 * @param {string} userId - The unique identifier for the user.
 * @param {Object} data - The data object to be saved.
 */
export const saveUserData = (userId, data) => {
    const storageKey = `userData_${userId}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save user data:', error);
    }
  };
  
  /**
   * Retrieves user data from localStorage.
   * @param {string} userId - The unique identifier for the user.
   * @returns {Object} The retrieved data object or a default structure.
   */
  export const getUserData = (userId) => {
    const storageKey = `userData_${userId}`;
    try {
      const data = localStorage.getItem(storageKey);
      return data ? JSON.parse(data) : { events: [], agendaNotes: "" };
    } catch (error) {
      console.error('Failed to retrieve user data:', error);
      return { events: [], agendaNotes: "" };
    }
  };
  
  /**
   * Clears user data from localStorage.
   * @param {string} userId - The unique identifier for the user.
   */
  export const clearUserData = (userId) => {
    const storageKey = `userData_${userId}`;
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to clear user data:', error);
    }
  };
  