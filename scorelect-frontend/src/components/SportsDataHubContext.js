// src/components/SportsDataHubContext.js

import React, { createContext, useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

/**
 * SportsDataHubContext
 *
 * This context provides the datasets data, loading states, and error information to its consumers.
 * It now includes permission checking to control who can view datasets.
 */
export const SportsDataHubContext = createContext();

/**
 * SportsDataHubProvider Component
 *
 * This component fetches and provides the published datasets to its children via context.
 * It checks user permissions before allowing access to view datasets.
 *
 * Props:
 * - children (React.Node): The child components that will consume the datasets data.
 */
export const SportsDataHubProvider = ({ children }) => {
  const [datasets, setDatasets] = useState([]);
  const [filteredDatasets, setFilteredDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSport, setSelectedSport] = useState('All');
  const [loadingOperations, setLoadingOperations] = useState({});
  const [userHasAccess, setUserHasAccess] = useState(false);
  
  const auth = getAuth();
  const db = getFirestore();

  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  /**
   * Checks if the user has permission to view datasets based on admin settings.
   * @param {string} userType - The user's subscription type ('', 'free', 'premium')
   * @returns {Promise<boolean>} Whether the user has access
   */
  const checkUserAccess = async (userType) => {
    try {
      const user = auth.currentUser;
      
      // Get dataset settings
      const datasetSettingsRef = doc(db, 'adminSettings', 'datasetConfig');
      const datasetSettingsSnap = await getDoc(datasetSettingsRef);
      
      if (!datasetSettingsSnap.exists()) {
        // If no settings exist, default to allowing all users
        return true;
      }
      
      const data = datasetSettingsSnap.data();
      const { permissions, adminUsers } = data;
      
      // Check if user is admin
      if (user && adminUsers?.includes(user.email)) {
        return true;
      }
      
      // Check access level
      const viewAccess = permissions?.datasetViewing || 0; // Default to all users
      
      switch (viewAccess) {
        case 0: // All users
          return true;
        case 1: // Free users or higher
          return userType !== '';
        case 2: // Premium users only
          return userType === 'premium';
        default:
          return true; // Default to allowing access
      }
    } catch (error) {
      console.error('Error checking dataset access:', error);
      return false;
    }
  };
  
  /**
   * Fetches all published datasets from the backend.
   * Now includes permission checking before displaying datasets.
   */
  const fetchPublishedDatasets = async () => {
    setLoading(true);
    setFetchError(null);
    
    try {
      const user = auth.currentUser;
      let userType = '';
      
      if (user) {
        // Get user profile to determine user type
        const userProfileRef = doc(db, 'users', user.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        
        if (userProfileSnap.exists()) {
          userType = userProfileSnap.data().userType || '';
        }
      }
      
      // Check if user has access
      const hasAccess = await checkUserAccess(userType);
      setUserHasAccess(hasAccess);
      
      if (!hasAccess) {
        setDatasets([]);
        setFilteredDatasets([]);
        setFetchError('You do not have access to view the Sports Data Hub. Please upgrade your account or contact an administrator.');
        setLoading(false);
        return;
      }
      
      // Continue with fetching datasets since user has access
      const response = await fetch(`${apiUrl}/published-datasets`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch published datasets.');
      }

      const data = await response.json();
      setDatasets(data.datasets);
      filterDatasets(data.datasets, searchTerm, selectedSport);
      setFetchError(null);
    } catch (error) {
      console.error('Error fetching published datasets:', error);
      setFetchError(error.message || 'Failed to fetch datasets.');
      Swal.fire('Error', 'Failed to load datasets.', 'error');
      setDatasets([]);
      setFilteredDatasets([]);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Filters datasets based on search term and selected sport.
   * @param {Array} datasetsToFilter - The datasets to filter
   * @param {string} term - Search term
   * @param {string} sport - Selected sport category
   */
  const filterDatasets = (datasetsToFilter, term, sport) => {
    let filtered = datasetsToFilter;

    if (sport !== 'All') {
      filtered = filtered.filter((dataset) => dataset.category === sport);
    }

    if (term.trim() !== '') {
      const lowerSearch = term.toLowerCase();
      filtered = filtered.filter(
        (dataset) =>
          dataset.name.toLowerCase().includes(lowerSearch) ||
          dataset.description.toLowerCase().includes(lowerSearch)
      );
    }

    setFilteredDatasets(filtered);
  };

  // Fetch datasets on initial load and when auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(() => {
      fetchPublishedDatasets();
    });
    
    return () => unsubscribe();
  }, []);

  // Update filtered datasets when search term or selected sport changes
  useEffect(() => {
    filterDatasets(datasets, searchTerm, selectedSport);
  }, [searchTerm, selectedSport, datasets]);

  return (
    <SportsDataHubContext.Provider
      value={{
        datasets,
        filteredDatasets,
        loading,
        fetchError,
        searchTerm,
        setSearchTerm,
        selectedSport,
        setSelectedSport,
        loadingOperations,
        setLoadingOperations,
        fetchPublishedDatasets,
        userHasAccess,
      }}
    >
      {children}
    </SportsDataHubContext.Provider>
  );
};