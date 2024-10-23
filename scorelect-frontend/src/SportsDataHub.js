// src/SportsDataHub.js

import React, { useEffect, useState } from 'react';
import './SportsDataHub.css';
import Swal from 'sweetalert2';

/**
 * SportsDataHub Component
 * 
 * This component displays a hub where users can browse, search, filter, download, and view samples of various sports datasets.
 * Users can download entire datasets or view a sample of actions from each dataset.
 */
const SportsDataHub = () => {
  const [datasets, setDatasets] = useState([]);
  const [filteredDatasets, setFilteredDatasets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSport, setSelectedSport] = useState('All');
  const [loading, setLoading] = useState(true);
  const apiUrl = process.env.REACT_APP_API_URL;

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
        dataset.name.toLowerCase().includes(lowerSearch) ||
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
   * Handles the purchase of a dataset.
   * Note: The actual purchase logic should be implemented here.
   */
  const handlePurchase = async (dataset) => {
    Swal.fire('Purchase', `Purchased dataset "${dataset.name}" successfully!`, 'success');
    // Implement actual purchase logic here
  };

  /**
   * Handles downloading the entire dataset as a JSON file.
   */
  const handleDownload = async (dataset) => {
    try {
      const response = await fetch(`${apiUrl}/download-published-dataset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ datasetId: dataset.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download dataset.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataset.name}_data.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      Swal.fire('Downloaded!', `Dataset "${dataset.name}" has been downloaded.`, 'success');
    } catch (error) {
      console.error('Error downloading dataset:', error);
      Swal.fire('Error', error.message || 'Failed to download dataset.', 'error');
    }
  };

  /**
   * Handles viewing a sample of actions from the dataset.
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch dataset sample.');
      }

      const data = await response.json();
      const sampleActions = data.sample;

      if (!sampleActions || sampleActions.length === 0) {
        Swal.fire({
          title: `Sample of "${dataset.name}"`,
          text: 'No sample actions available.',
          icon: 'info',
        });
        return;
      }

      // Format the sample actions for display
      const formattedSample = sampleActions.map((action, index) => (
        `<li><strong>Action ${index + 1}:</strong> ${JSON.stringify(action)}</li>`
      )).join('');

      Swal.fire({
        title: `Sample of "${dataset.name}"`,
        html: `<ul style="text-align: left;">${formattedSample}</ul>`,
        width: '60%',
        heightAuto: true,
      });
    } catch (error) {
      console.error('Error fetching dataset sample:', error);
      Swal.fire('Error', error.message || 'Failed to fetch dataset sample.', 'error');
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
                {/* Use preview_snippet as image URL if image is uploaded */}
                {dataset.preview_snippet && dataset.preview_snippet.startsWith('http') ? (
                  <img src={dataset.preview_snippet} alt={dataset.name} className="dataset-image" />
                ) : (
                  <div className="placeholder-image">No Image</div>
                )}
                <h3>{dataset.name}</h3>
                <p>{dataset.description}</p>
                <p><strong>Sport:</strong> {dataset.category}</p>
                <p>
                  <strong>Price:</strong> {dataset.price === 0 ? 'Free' : `$${dataset.price.toFixed(2)}`}
                </p>
                <div className="dataset-actions">
                  <button onClick={() => handleViewSample(dataset)}>View Sample</button>
                  {dataset.price === 0 ? (
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
