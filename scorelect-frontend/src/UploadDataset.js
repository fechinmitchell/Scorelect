// src/components/UploadDataset.js

import React, { useState } from 'react';
import { getAuth } from 'firebase/auth';
import Swal from 'sweetalert2';
import PropTypes from 'prop-types';
import './UploadDataset.css';

/**
 * UploadDataset Component
 * 
 * Allows users to upload a JSON file containing multiple games and associate them with a dataset.
 * 
 * Props:
 * - apiUrl (string): The backend API URL.
 * - onUploadSuccess (function): Callback function to refresh datasets after successful upload.
 */
const UploadDataset = ({ apiUrl, onUploadSuccess }) => {
  const [datasetName, setDatasetName] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const auth = getAuth();
  const user = auth.currentUser;

  /**
   * Handles the file input change.
   * 
   * @param {Event} e - The file input change event.
   */
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/json') {
      setFile(selectedFile);
    } else {
      Swal.fire('Invalid File', 'Please select a valid JSON file.', 'error');
      setFile(null);
    }
  };

  /**
   * Handles the form submission to upload the dataset.
   * 
   * @param {Event} e - The form submission event.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!datasetName.trim()) {
      Swal.fire('Missing Dataset Name', 'Please provide a name for the dataset.', 'warning');
      return;
    }

    if (!file) {
      Swal.fire('No File Selected', 'Please select a JSON file to upload.', 'warning');
      return;
    }

    if (!user) {
      Swal.fire('Not Authenticated', 'Please log in to upload datasets.', 'error');
      return;
    }

    setUploading(true);

    try {
      const token = await user.getIdToken();

      const formData = new FormData();
      formData.append('uid', user.uid);
      formData.append('datasetName', datasetName);
      formData.append('file', file);

      const response = await fetch(`${apiUrl}/upload-dataset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`, // Include authorization if required
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        Swal.fire('Success', 'Dataset uploaded successfully!', 'success');
        setDatasetName('');
        setFile(null);
        onUploadSuccess(); // Refresh the datasets
      } else {
        throw new Error(result.error || 'Failed to upload dataset.');
      }
    } catch (error) {
      console.error('Error uploading dataset:', error);
      Swal.fire('Error', error.message || 'Failed to upload dataset.', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-dataset-container">
      <h3>Upload New Dataset</h3>
      <form onSubmit={handleSubmit} className="upload-dataset-form">
        <div className="form-group">
          <label htmlFor="datasetName">Dataset Name:</label>
          <input
            type="text"
            id="datasetName"
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            placeholder="Enter dataset name"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="file">JSON File:</label>
          <input
            type="file"
            id="file"
            accept=".json"
            onChange={handleFileChange}
            required
          />
        </div>
        <button type="submit" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload Dataset'}
        </button>
      </form>
    </div>
  );
};

// Define PropTypes for better type checking
UploadDataset.propTypes = {
  apiUrl: PropTypes.string.isRequired, // Backend API URL
  onUploadSuccess: PropTypes.func.isRequired, // Callback to refresh datasets
};

export default UploadDataset;
