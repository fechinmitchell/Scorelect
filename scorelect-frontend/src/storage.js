// storage.js - Enhanced with player management and data backup/restore
import { v4 as uuidv4 } from 'uuid';

/**
 * Get or generate a unique user ID
 * @returns {string} User ID
 */
export const getUserId = () => {
  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = uuidv4();
    localStorage.setItem('userId', userId);
  }
  return userId;
};

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

/**
 * Save player data to localStorage
 * @param {string} userId - User ID
 * @param {Array} players - Player data array
 */
export const savePlayers = (userId, players) => {
  try {
    localStorage.setItem(`players_${userId}`, JSON.stringify(players));
  } catch (error) {
    console.error('Failed to save players data:', error);
  }
};

/**
 * Get player data from localStorage
 * @param {string} userId - User ID
 * @returns {Array} Player data array
 */
export const getPlayers = (userId) => {
  try {
    const data = localStorage.getItem(`players_${userId}`);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to retrieve players data:', error);
    return [];
  }
};

/**
 * Backup all user data to a downloadable JSON file
 * @param {string} userId - User ID
 * @returns {Object} The backup data object
 */
export const backupData = (userId) => {
  try {
    const players = getPlayers(userId);
    const scheduleData = getUserData(userId);
    
    const backup = {
      players,
      schedule: scheduleData,
      timestamp: new Date().toISOString(),
      userId
    };
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = `team_manager_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return backup;
  } catch (error) {
    console.error('Failed to backup data:', error);
    return null;
  }
};

/**
 * Restore data from a backup file
 * @param {Object} backupData - Backup data object
 * @param {string} userId - Current user ID
 * @returns {boolean} Success status
 */
export const restoreData = (backupData, userId) => {
  try {
    if (!backupData || !backupData.players || !backupData.schedule) {
      return false;
    }
    
    // Restore players
    savePlayers(userId, backupData.players);
    
    // Restore schedule
    saveUserData(userId, backupData.schedule);
    
    return true;
  } catch (error) {
    console.error('Error restoring data:', error);
    return false;
  }
};

/**
 * Clear all user data including players and schedule
 * @param {string} userId - User ID
 */
export const clearAllData = (userId) => {
  try {
    localStorage.removeItem(`players_${userId}`);
    localStorage.removeItem(`userData_${userId}`);
  } catch (error) {
    console.error('Failed to clear all user data:', error);
  }
};