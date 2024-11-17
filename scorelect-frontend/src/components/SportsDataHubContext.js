// src/components/SportsDataHubContext.js

import React, { createContext, useState, useEffect } from 'react';
import Swal from 'sweetalert2';

/**
 * SportsDataHubContext
 *
 * This context provides the datasets data, loading states, and error information to its consumers.
 */
export const SportsDataHubContext = createContext();

/**
 * SportsDataHubProvider Component
 *
 * This component fetches and provides the published datasets to its children via context.
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

  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  /**
   * Fetches all published datasets from the backend.
   */
  const fetchPublishedDatasets = async () => {
    try {
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
      setFilteredDatasets(data.datasets);
      setFetchError(null);
    } catch (error) {
      console.error('Error fetching published datasets:', error);
      setFetchError(error.message || 'Failed to fetch datasets.');
      Swal.fire('Error', 'Failed to load datasets.', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Filters datasets based on search term and selected sport.
   */
  const filterDatasets = () => {
    let filtered = datasets;

    if (selectedSport !== 'All') {
      filtered = filtered.filter((dataset) => dataset.category === selectedSport);
    }

    if (searchTerm.trim() !== '') {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (dataset) =>
          dataset.name.toLowerCase().includes(lowerSearch) ||
          dataset.description.toLowerCase().includes(lowerSearch)
      );
    }

    setFilteredDatasets(filtered);
  };

  useEffect(() => {
    fetchPublishedDatasets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filterDatasets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        fetchPublishedDatasets, // Expose fetch function if needed
      }}
    >
      {children}
    </SportsDataHubContext.Provider>
  );
};
