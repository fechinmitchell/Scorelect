// src/SportsDataHub.js

import React, { useEffect, useState } from 'react';
import './SportsDataHub.css';
import Swal from 'sweetalert2';
import PropTypes from 'prop-types';

/**
 * SportsDataHub Component
 * 
 * This component allows users to browse, search, and purchase/download published datasets.
 * Users can search by name or filter by sport categories like Soccer, GAA, etc.
 * Provides an option to view a sample of the dataset before purchasing.
 */
const SportsDataHub = () => {
  const [datasets, setDatasets] = useState([]);
  const [filteredDatasets, setFilteredDatasets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSport, setSelectedSport] = useState('All');
  const [loading, setLoading] = useState(true);
  const apiUrl = process.env.REACT_APP_API_URL;

  /**
   * Fetches published datasets from the backend.
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
      setLoading(false);
    } catch (error) {
      console.error('Error fetching published datasets:', error);
      Swal.fire('Error', 'Failed to load datasets.', 'error');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublishedDatasets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Filters datasets based on search term and selected sport.
   */
  const filterDatasets = () => {
    let filtered = datasets;

    if (selectedSport !== 'All') {
      filtered = filtered.filter(dataset => dataset.category === selectedSport);
    }

    if (searchTerm.trim() !== '') {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(dataset =>
        dataset.publishName.toLowerCase().includes(lowerSearch) ||
        dataset.description.toLowerCase().includes(lowerSearch)
      );
    }

    setFilteredDatasets(filtered);
  };

  useEffect(() => {
    filterDatasets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedSport, datasets]);

  /**
   * Handles purchasing a dataset.
   * This is a placeholder; implement payment gateway integration here.
   */
  const handlePurchase = async (dataset) => {
    // Placeholder: Implement payment integration (e.g., Stripe)
    Swal.fire('Purchase', `Purchased dataset "${dataset.publishName}" successfully!`, 'success');
  };

  /**
   * Handles downloading a dataset.
   */
  const handleDownload = async (dataset) => {
    try {
      const response = await fetch(`${apiUrl}/download-published-dataset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Include authentication headers if required
        },
        body: JSON.stringify({ datasetId: dataset.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to download dataset.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataset.publishName}_data.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      Swal.fire('Downloaded!', `Dataset "${dataset.publishName}" has been downloaded.`, 'success');
    } catch (error) {
      console.error('Error downloading dataset:', error);
      Swal.fire('Error', 'Failed to download dataset.', 'error');
    }
  };

  /**
   * Handles viewing a sample of the dataset.
   */
  const handleViewSample = async (dataset) => {
    try {
      const response = await fetch(`${apiUrl}/sample-dataset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ datasetId: dataset.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dataset sample.');
      }

      const data = await response.json();
      Swal.fire({
        title: `Sample of "${dataset.publishName}"`,
        html: `<pre>${JSON.stringify(data.sample, null, 2)}</pre>`,
        width: '60%',
        heightAuto: true,
      });
    } catch (error) {
      console.error('Error fetching dataset sample:', error);
      Swal.fire('Error', 'Failed to fetch dataset sample.', 'error');
    }
  };

  return (
    <div className="sports-datahub-container">
      <h2>Sports Data Hub</h2>
      <div className="search-filter-container">
        <input
          type="text"
          placeholder="Search by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          value={selectedSport}
          onChange={(e) => setSelectedSport(e.target.value)}
        >
          <option value="All">All Sports</option>
          <option value="Soccer">Soccer</option>
          <option value="GAA">GAA</option>
          <option value="Basketball">Basketball</option>
          <option value="AmericanFootball">American Football</option>
        </select>
      </div>
      {loading ? (
        <p>Loading datasets...</p>
      ) : (
        <div className="datasets-grid">
          {filteredDatasets.length > 0 ? (
            filteredDatasets.map((dataset) => (
              <div key={dataset.id} className="dataset-card">
                <img src={dataset.imageUrl} alt={dataset.publishName} className="dataset-image" />
                <h3>{dataset.publishName}</h3>
                <p>{dataset.description}</p>
                <p><strong>Sport:</strong> {dataset.category}</p>
                <p>
                  <strong>Price:</strong> {dataset.isFree ? 'Free' : `$${dataset.price.toFixed(2)}`}
                </p>
                <div className="dataset-actions">
                  <button onClick={() => handleViewSample(dataset)}>View Sample</button>
                  {dataset.isFree ? (
                    <button onClick={() => handleDownload(dataset)}>Download</button>
                  ) : (
                    <button onClick={() => handlePurchase(dataset)}>Purchase</button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p>No datasets found.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SportsDataHub;
