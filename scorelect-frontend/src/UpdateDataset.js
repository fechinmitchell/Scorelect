import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import PropTypes from 'prop-types';
import './PublishDataset.css';
import Swal from 'sweetalert2';
import { getAuth } from 'firebase/auth';

const UpdateDataset = ({ isOpen, onClose, datasetName, onUpdateSuccess, apiUrl, userType }) => {
  const [name, setName] = useState(datasetName);
  const [description, setDescription] = useState('');
  const [previewSnippet, setPreviewSnippet] = useState('');
  const [category, setCategory] = useState('Soccer');
  const [submitting, setSubmitting] = useState(false);

  const auth = getAuth();

  // Fetch existing dataset details when the modal opens
  useEffect(() => {
    if (isOpen) {
      fetchDatasetDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchDatasetDetails = async () => {
    try {
      const response = await fetch(`${apiUrl}/get-dataset-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`,
        },
        body: JSON.stringify({
          datasetName,
          uid: auth.currentUser.uid, // Include uid here
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch dataset details.');
      }

      const data = await response.json();
      setDescription(data.description || '');
      setPreviewSnippet(data.preview_snippet || '');
      setCategory(data.category || 'Soccer');
    } catch (error) {
      console.error('Error fetching dataset details:', error);
      Swal.fire('Error', error.message || 'Failed to fetch dataset details.', 'error');
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!name.trim() || !description.trim()) {
      Swal.fire('Error', 'Please fill in all required fields.', 'error');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/update-dataset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`,
        },
        body: JSON.stringify({
          datasetName,
          name,
          description,
          preview_snippet: previewSnippet,
          category,
          uid: auth.currentUser.uid,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update dataset.');
      }

      Swal.fire('Success', 'Dataset updated successfully!', 'success');
      onUpdateSuccess();
    } catch (error) {
      console.error('Error updating dataset:', error);
      Swal.fire('Error', error.message || 'Failed to update dataset.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Update Dataset"
      ariaHideApp={false}
      className="publish-modal"
      overlayClassName="publish-overlay"
    >
      <h2>Update Dataset: {datasetName}</h2>
      <form onSubmit={handleSubmit} className="publish-form">
        <div className="form-group">
          <label htmlFor="update-name">Name:</label>
          <input
            type="text"
            id="update-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter a name for your dataset"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="update-description">Description:</label>
          <textarea
            id="update-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter a description for your dataset"
            required
          ></textarea>
        </div>
        <div className="form-group">
          <label htmlFor="update-category">Category:</label>
          <select
            id="update-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            <option value="Soccer">Soccer</option>
            <option value="GAA">GAA</option>
            <option value="Basketball">Basketball</option>
            <option value="AmericanFootball">American Football</option>
            {/* Add more categories as needed */}
          </select>
        </div>
        <div className="form-actions">
          <button type="submit" disabled={submitting}>
            {submitting ? 'Updating...' : 'Update'}
          </button>
          <button type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
};

UpdateDataset.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  datasetName: PropTypes.string.isRequired,
  onUpdateSuccess: PropTypes.func.isRequired,
  apiUrl: PropTypes.string.isRequired,
  userType: PropTypes.string.isRequired,
};

export default UpdateDataset;
