// src/SportsDataHub.js

import React, { useEffect, useState, useContext } from 'react';
import './SportsDataHub.css';
import Swal from 'sweetalert2';
import { useAuth } from './AuthContext'; // Import useAuth hook
import { SportsDataHubContext } from './components/SportsDataHubContext'; // Import the SportsDataHubContext
import PropTypes from 'prop-types';

const SportsDataHub = () => {
  const { currentUser } = useAuth(); // Use the useAuth hook to access the current user
  const {
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
  } = useContext(SportsDataHubContext); // Consume context

  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

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
    setLoadingOperations((prev) => ({ ...prev, [`download-${dataset.id}`]: true }));

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
    } finally {
      setLoadingOperations((prev) => ({ ...prev, [`download-${dataset.id}`]: false }));
    }
  };

  /**
   * Handles viewing a sample of actions from the dataset.
   */
  const handleViewSample = async (dataset) => {
    setLoadingOperations((prev) => ({ ...prev, [`viewSample-${dataset.id}`]: true }));

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
      const formattedSample = sampleActions
        .map(
          (action, index) =>
            `<li><strong>Action ${index + 1}:</strong> ${JSON.stringify(action)}</li>`
        )
        .join('');

      Swal.fire({
        title: `Sample of "${dataset.name}"`,
        html: `<ul style="text-align: left;">${formattedSample}</ul>`,
        width: '60%',
        heightAuto: true,
      });
    } catch (error) {
      console.error('Error fetching dataset sample:', error);
      Swal.fire('Error', error.message || 'Failed to fetch dataset sample.', 'error');
    } finally {
      setLoadingOperations((prev) => ({ ...prev, [`viewSample-${dataset.id}`]: false }));
    }
  };

  /**
   * Handles deleting a dataset owned by the user.
   */
  const handleDeleteDataset = async (dataset) => {
    // Ensure the user is logged in
    if (!currentUser) {
      Swal.fire('Error', 'You must be logged in to delete datasets.', 'error');
      return;
    }

    const confirmDeletion = await Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete the dataset "${dataset.name}"? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
    });

    if (confirmDeletion.isConfirmed) {
      setLoadingOperations((prev) => ({ ...prev, [`delete-${dataset.id}`]: true }));

      try {
        const response = await fetch(`${apiUrl}/delete-published-dataset`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid: currentUser.uid, datasetId: dataset.id }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to delete dataset.');
        }

        // Optionally, refetch the published datasets
        await fetchPublishedDatasets();
        Swal.fire('Deleted!', `Dataset "${dataset.name}" has been deleted.`, 'success');
      } catch (error) {
        console.error('Error deleting dataset:', error);
        Swal.fire('Error', error.message || 'Failed to delete dataset.', 'error');
      } finally {
        setLoadingOperations((prev) => ({ ...prev, [`delete-${dataset.id}`]: false }));
      }
    }
  };

  if (loading) {
    return (
      <div className="sports-datahub-container">
        <p>Loading datasets...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="sports-datahub-container">
        <p className="error">{fetchError}</p>
      </div>
    );
  }

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
        <select value={selectedSport} onChange={(e) => setSelectedSport(e.target.value)}>
          <option value="All">All Sports</option>
          <option value="Soccer">Soccer</option>
          <option value="GAA">GAA</option>
          <option value="Basketball">Basketball</option>
          <option value="AmericanFootball">American Football</option>
        </select>
      </div>
      <div className="datasets-grid">
        {filteredDatasets.length > 0 ? (
          filteredDatasets.map((dataset) => {
            const isDownloading = loadingOperations[`download-${dataset.id}`];
            const isViewingSample = loadingOperations[`viewSample-${dataset.id}`];
            const isDeleting = loadingOperations[`delete-${dataset.id}`];

            // Determine if the current user is the creator of the dataset
            const isOwner = currentUser
              ? dataset.creator_uid === currentUser.uid
              : false;

            return (
              <div key={dataset.id} className="dataset-card">
                {/* Use preview_snippet as image URL if image is uploaded */}
                {/* {dataset.preview_snippet && dataset.preview_snippet.startsWith('http') ? (
                  <img
                    src={dataset.preview_snippet}
                    alt={dataset.name}
                    className="dataset-image"
                  />
                ) : (
                  <div className="placeholder-image">No Image</div>
                )} */}
                <h3>{dataset.name}</h3>
                <p>{dataset.description}</p>
                <p>
                  <strong>Sport:</strong> {dataset.category}
                </p>
                <p>
                  <strong>Price:</strong>{' '}
                  {dataset.price === 0 ? 'Free' : `$${dataset.price.toFixed(2)}`}
                </p>
                <div className="dataset-actions">
                  <button
                    onClick={() => handleViewSample(dataset)}
                    disabled={isViewingSample || isDownloading || isDeleting}
                    className="action-button"
                    aria-busy={isViewingSample}
                    aria-label={isViewingSample ? 'Loading sample...' : 'View Sample'}
                  >
                    {isViewingSample && <span className="spinner"></span>}
                    <span className={`button-text ${isViewingSample ? 'hidden' : ''}`}>
                      View Sample
                    </span>
                  </button>
                  {dataset.price === 0 ? (
                    <button
                      onClick={() => handleDownload(dataset)}
                      disabled={isDownloading || isViewingSample || isDeleting}
                      className="action-button"
                      aria-busy={isDownloading}
                      aria-label={isDownloading ? 'Downloading...' : 'Download'}
                    >
                      {isDownloading && <span className="spinner"></span>}
                      <span className={`button-text ${isDownloading ? 'hidden' : ''}`}>
                        Download
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePurchase(dataset)}
                      disabled={isDownloading || isViewingSample || isDeleting}
                      className="action-button"
                      aria-label="Purchase"
                    >
                      Purchase
                    </button>
                  )}
                  {isOwner && (
                    <button
                      onClick={() => handleDeleteDataset(dataset)}
                      disabled={isDeleting || isDownloading || isViewingSample}
                      className="action-button delete-button"
                      aria-busy={isDeleting}
                      aria-label={isDeleting ? 'Deleting...' : 'Delete Dataset'}
                    >
                      {isDeleting && <span className="spinner"></span>}
                      <span className={`button-text ${isDeleting ? 'hidden' : ''}`}>
                        Delete
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p>No datasets found.</p>
        )}
      </div>
    </div>
  );
};

// Define PropTypes for better type checking and to ensure required props are passed
SportsDataHub.propTypes = {
  // Define any props if necessary
};

export default SportsDataHub;
