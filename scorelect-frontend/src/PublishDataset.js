// src/components/PublishDataset.js

import React, { useState } from 'react';
import Modal from 'react-modal';
import PropTypes from 'prop-types';
import './PublishDataset.css';
import Swal from 'sweetalert2';
import { getAuth } from 'firebase/auth'; // Import getAuth

/**
 * PublishDataset Component
 * 
 * This component renders a modal that allows users to publish a dataset by providing a name, description, preview snippet, image, category, and pricing options.
 * Currently, all datasets are published for free. Pricing options are commented out for future implementation.
 * 
 * Props:
 * - isOpen (bool): Determines if the modal is open.
 * - onClose (function): Function to close the modal.
 * - datasetName (string): The name of the dataset being published.
 * - onPublishSuccess (function): Callback function upon successful publication.
 * - apiUrl (string): The base URL for API requests.
 * - userType (string): The type of user (e.g., 'free', 'premium').
 */
const PublishDataset = ({ isOpen, onClose, datasetName, onPublishSuccess, apiUrl, userType }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [previewSnippet, setPreviewSnippet] = useState(''); // Add preview_snippet field
  const [category, setCategory] = useState('Soccer'); // Add category field with default value
  const [image, setImage] = useState(null);
  // const [isFree, setIsFree] = useState(true); // Commented out: All datasets are free
  // const [price, setPrice] = useState(''); // Commented out: Price is not needed
  const [submitting, setSubmitting] = useState(false);

  const auth = getAuth(); // Initialize auth

  /**
   * Handles the form submission to publish the dataset.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!name.trim() || !description.trim()) {
      Swal.fire('Error', 'Please fill in all required fields.', 'error');
      return;
    }

    /*
    // Commented out: Price validation
    if (!isFree && (isNaN(price) || Number(price) <= 0)) {
      Swal.fire('Error', 'Please enter a valid price.', 'error');
      return;
    }

    if (!isFree && userType !== 'premium') {
      Swal.fire('Error', 'Only premium users can set a price.', 'error');
      return;
    }
    */

    /*
    // Commented out: Check if the user is allowed to set a price
    if (!isFree && userType !== 'premium') {
      Swal.fire('Error', 'Only premium users can set a price.', 'error');
      return;
    }
    */

    /*
    // Commented out: Handle price in form data
    if (!isFree) {
      formData.append('price', price);
    }
    */

    setSubmitting(true);

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('creator_uid', auth.currentUser.uid); // Change to 'creator_uid'
      formData.append('datasetName', datasetName);
      formData.append('name', name); // Change to 'name'
      formData.append('description', description);
      formData.append('preview_snippet', previewSnippet); // Add 'preview_snippet'
      formData.append('category', category); // Add 'category'
      // formData.append('isFree', isFree); // Commented out: All datasets are free
      formData.append('isFree', true); // Ensure isFree is always true
      // if (!isFree) {
      //   formData.append('price', price);
      // }
      if (image) {
        formData.append('image', image);
      }

      const response = await fetch(`${apiUrl}/publish-dataset`, {
        method: 'POST',
        headers: {
          // Do not set 'Content-Type'; let the browser handle it
          'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to publish dataset.');
      }

      // Assuming the backend returns a success message
      const result = await response.json();
      console.log('Publish dataset response:', result);

      Swal.fire('Success', 'Dataset published successfully!', 'success');
      onPublishSuccess(); // Notify parent component of success

      // Optionally, reset the form fields
      setName('');
      setDescription('');
      setPreviewSnippet('');
      setCategory('Soccer');
      setImage(null);
      // setIsFree(true); // Commented out: Always free
      // setPrice(''); // Commented out: Price is not needed
    } catch (error) {
      console.error('Error publishing dataset:', error);
      Swal.fire('Error', error.message || 'Failed to publish dataset.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Handles image file selection.
   */
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Publish Dataset"
      ariaHideApp={false} // Prevent accessibility warning
      className="publish-modal"
      overlayClassName="publish-overlay"
    >
      <h2>Publish Dataset: {datasetName}</h2>
      <form onSubmit={handleSubmit} className="publish-form">
        <div className="form-group">
          <label htmlFor="publish-name">Name:</label>
          <input
            type="text"
            id="publish-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter a name for your dataset"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="publish-description">Description:</label>
          <textarea
            id="publish-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter a description for your dataset"
            required
          ></textarea>
        </div>
        {/* <div className="form-group">
          <label htmlFor="preview-snippet">Preview Snippet:</label>
          <textarea
            id="preview-snippet"
            value={previewSnippet}
            onChange={(e) => setPreviewSnippet(e.target.value)}
            placeholder="Enter a preview snippet for your dataset"
            required
          ></textarea>
        </div> */} 
        <div className="form-group">
          <label htmlFor="dataset-category">Category:</label>
          <select
            id="dataset-category"
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
        {/* <div className="form-group">
          <label htmlFor="publish-image">Image:</label>
          <input
            type="file"
            id="publish-image"
            accept="image/*"
            onChange={handleImageChange}
          />
        </div> */}
        {/*
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={!isFree}
              onChange={() => setIsFree(!isFree)}
            />
            {' '}Set a Price
          </label>
        </div>
        {!isFree && (
          <div className="form-group">
            <label htmlFor="publish-price">Price ($):</label>
            <input
              type="number"
              id="publish-price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Enter price"
              min="0.01"
              step="0.01"
              required={!isFree}
            />
          </div>
        )}
        */}
        <div className="form-actions">
          <button type="submit" disabled={submitting}>
            {submitting ? 'Publishing...' : 'Publish'}
          </button>
          <button type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
};

PublishDataset.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  datasetName: PropTypes.string.isRequired,
  onPublishSuccess: PropTypes.func.isRequired,
  apiUrl: PropTypes.string.isRequired,
  userType: PropTypes.string.isRequired,
};

export default PublishDataset;
