// src/components/PublishDataset.js

import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import PropTypes from 'prop-types';
import './PublishDataset.css';
import Swal from 'sweetalert2';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

/**
 * PublishDataset Component
 * 
 * This component renders a modal that allows users to publish a dataset by providing a name, description,
 * category, and price options. It checks for admin privileges and permissions before allowing publishing.
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
  const [previewSnippet, setPreviewSnippet] = useState('');
  const [category, setCategory] = useState('Soccer');
  const [image, setImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Enable pricing options
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState('');
  
  // States for permission checking
  const [canPublish, setCanPublish] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const auth = getAuth();
  const db = getFirestore();

  // Initialize with the dataset name
  useEffect(() => {
    setName(datasetName);
  }, [datasetName]);
  
  // Check publishing permissions on component mount
  useEffect(() => {
    const checkPublishPermissions = async () => {
      setLoadingPermissions(true);
      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error('User not authenticated');
        }

        // Get dataset settings
        const datasetSettingsRef = doc(db, 'adminSettings', 'datasetConfig');
        const datasetSettingsSnap = await getDoc(datasetSettingsRef);
        
        if (datasetSettingsSnap.exists()) {
          const data = datasetSettingsSnap.data();
          const { permissions, adminUsers } = data;
          
          // Check if user is admin
          const userIsAdmin = adminUsers?.includes(user.email) || false;
          setIsAdmin(userIsAdmin);
          
          // Determine if user can publish based on settings and user type
          let hasPermission = false;
          
          if (userIsAdmin) {
            // Admins can always publish
            hasPermission = true;
          } else {
            // Check against publish access level
            switch (permissions?.datasetPublishing) {
              case 0: // All users
                hasPermission = true;
                break;
              case 1: // Free users or higher
                hasPermission = userType !== '';
                break;
              case 2: // Premium users only
                hasPermission = userType === 'premium';
                break;
              case 3: // Admin only
              default:
                hasPermission = false;
                break;
            }
          }
          
          setCanPublish(hasPermission);
        } else {
          // Default to admin-only if no settings exist
          setCanPublish(false);
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
        setCanPublish(false);
      } finally {
        setLoadingPermissions(false);
      }
    };
    
    checkPublishPermissions();
  }, [auth, db, userType]);

  /**
   * Handles the form submission to publish the dataset.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if user has permission to publish
    if (!canPublish) {
      Swal.fire('Error', 'You do not have permission to publish datasets. Please contact an administrator.', 'error');
      return;
    }

    // Validation
    if (!name.trim() || !description.trim()) {
      Swal.fire('Error', 'Please fill in all required fields.', 'error');
      return;
    }

    // Price validation
    if (!isFree) {
      if (isNaN(price) || Number(price) <= 0) {
        Swal.fire('Error', 'Please enter a valid price.', 'error');
        return;
      }
      
      // Only premium users and admins can set a price
      if (!isAdmin && userType !== 'premium') {
        Swal.fire('Error', 'Only premium users or admins can set a price.', 'error');
        return;
      }
    }

    setSubmitting(true);

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('creator_uid', auth.currentUser.uid);
      formData.append('datasetName', datasetName);
      formData.append('name', name);
      formData.append('description', description);
      formData.append('preview_snippet', previewSnippet);
      formData.append('category', category);
      formData.append('isFree', isFree);
      
      // Add price if not free
      if (!isFree) {
        formData.append('price', price);
      }
      
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

      // Reset the form fields
      setName('');
      setDescription('');
      setPreviewSnippet('');
      setCategory('Soccer');
      setImage(null);
      setIsFree(true);
      setPrice('');
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

  // Show loading state while checking permissions
  if (loadingPermissions) {
    return (
      <Modal
        isOpen={isOpen}
        onRequestClose={onClose}
        contentLabel="Checking Permissions"
        ariaHideApp={false}
        className="publish-modal"
        overlayClassName="publish-overlay"
      >
        <h2>Checking Publishing Permissions</h2>
        <p>Please wait while we verify your access privileges...</p>
      </Modal>
    );
  }

  // Show permission denied message if user can't publish
  if (!canPublish) {
    return (
      <Modal
        isOpen={isOpen}
        onRequestClose={onClose}
        contentLabel="Permission Denied"
        ariaHideApp={false}
        className="publish-modal"
        overlayClassName="publish-overlay"
      >
        <h2>Permission Denied</h2>
        <p>You do not have permission to publish datasets to the Sports Data Hub.</p>
        <p>Please contact an administrator if you need access.</p>
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </Modal>
    );
  }

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
          </select>
        </div>
        
        {/* Pricing options */}
        <div className="form-group pricing-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={!isFree}
              onChange={() => setIsFree(!isFree)}
            />
            {' '}Set a Price (Premium users and admins only)
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
            <span className="price-note">
              {!isAdmin && userType !== 'premium' 
              ? "Only premium users can set a price. Upgrade to premium to enable paid datasets." 
              : "Enter a price for your dataset. This is the amount users will pay to download it."}
            </span>
          </div>
        )}
        
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