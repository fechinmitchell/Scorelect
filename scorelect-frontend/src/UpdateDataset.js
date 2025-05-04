// src/components/UpdateDataset.js

import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import PropTypes from 'prop-types';
import './PublishDataset.css'; // Reuse the same CSS
import Swal from 'sweetalert2';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

/**
 * UpdateDataset Component
 * 
 * This component renders a modal that allows users to update a published dataset.
 * It now supports updating price settings as well.
 */
const UpdateDataset = ({ isOpen, onClose, datasetName, onUpdateSuccess, apiUrl, userType }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [originalPrice, setOriginalPrice] = useState(0);
  
  // Price options
  const [isFree, setIsFree] = useState(true);
  const [price, setPrice] = useState('');
  
  // Permission checks
  const [canUpdate, setCanUpdate] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const auth = getAuth();
  const db = getFirestore();

  // Fetch the dataset details on mount
  useEffect(() => {
    const fetchDatasetDetails = async () => {
      setLoading(true);
      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error('User not authenticated');
        }

        // Check admin status
        const adminConfigRef = doc(db, 'adminSettings', 'datasetConfig');
        const adminConfigSnap = await getDoc(adminConfigRef);
        
        if (adminConfigSnap.exists()) {
          const adminUsers = adminConfigSnap.data().adminUsers || [];
          const userIsAdmin = adminUsers.includes(user.email);
          setIsAdmin(userIsAdmin);
        }

        // Get the dataset document from Firestore
        const datasetsRef = db.collection('datasets');
        const query = datasetsRef.where('name', '==', datasetName).where('creator_uid', '==', user.uid).limit(1);
        const querySnapshot = await query.get();
        
        if (querySnapshot.empty) {
          throw new Error(`Dataset "${datasetName}" not found.`);
        }

        const datasetDoc = querySnapshot.docs[0];
        const dataset = datasetDoc.data();
        
        // Set form values from dataset
        setName(dataset.name || '');
        setDescription(dataset.description || '');
        setCategory(dataset.category || 'Soccer');
        
        // Set price values
        const datasetPrice = dataset.price || 0;
        setOriginalPrice(datasetPrice);
        setIsFree(datasetPrice === 0);
        setPrice(datasetPrice > 0 ? datasetPrice.toString() : '');
        
        // Determine if user can update
        setCanUpdate(true); // Creator can always update their own dataset
      } catch (error) {
        console.error('Error fetching dataset details:', error);
        Swal.fire('Error', error.message || 'Failed to fetch dataset details.', 'error');
        onClose(); // Close the modal on error
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchDatasetDetails();
    }
  }, [isOpen, datasetName, auth, db, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!name.trim() || !description.trim() || !category) {
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
    
    // Check if changing from paid to free
    if (originalPrice > 0 && isFree) {
      const confirmation = await Swal.fire({
        title: 'Change to Free?',
        text: 'Are you sure you want to change this dataset from paid to free? Existing buyers will still have access.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, make it free',
        cancelButtonText: 'Cancel'
      });
      
      if (!confirmation.isConfirmed) {
        return;
      }
    }
    
    // Check if changing price of paid dataset
    if (originalPrice > 0 && !isFree && Number(price) !== originalPrice) {
      const confirmation = await Swal.fire({
        title: 'Change Price?',
        text: `Are you sure you want to change the price from $${originalPrice.toFixed(2)} to $${Number(price).toFixed(2)}? This will only affect new purchases.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, update price',
        cancelButtonText: 'Cancel'
      });
      
      if (!confirmation.isConfirmed) {
        return;
      }
    }

    setSubmitting(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Prepare update data
      const updateData = {
        name,
        description,
        category,
        price: isFree ? 0 : Number(price),
        is_free: isFree,
        updated_at: new Date().toISOString()
      };

      // Make the update request
      const response = await fetch(`${apiUrl}/update-dataset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          uid: user.uid,
          datasetName: datasetName,
          ...updateData
        })
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

  // Show loading state
  if (loading) {
    return (
      <Modal
        isOpen={isOpen}
        onRequestClose={onClose}
        contentLabel="Loading Dataset"
        ariaHideApp={false}
        className="publish-modal"
        overlayClassName="publish-overlay"
      >
        <h2>Loading Dataset Details</h2>
        <p>Please wait...</p>
      </Modal>
    );
  }

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
          </select>
        </div>
        
        {/* Pricing options */}
        <div className="form-group pricing-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={!isFree}
              onChange={() => setIsFree(!isFree)}
              disabled={!isAdmin && userType !== 'premium'}
            />
            {' '}Set a Price (Premium users and admins only)
          </label>
        </div>
        
        {!isFree && (
          <div className="form-group">
            <label htmlFor="update-price">Price ($):</label>
            <input
              type="number"
              id="update-price"
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
            {submitting ? 'Updating...' : 'Update Dataset'}
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