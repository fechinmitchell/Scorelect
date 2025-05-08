import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import Swal from 'sweetalert2';
import './SportsDataHub.css';
import { useAuth } from './AuthContext';
import { SportsDataHubContext } from './components/SportsDataHubContext';
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, Elements, useStripe, useElements } from '@stripe/react-stripe-js';
import { 
  FaSearch, 
  FaFilter, 
  FaSortAmountDown, 
  FaRedo, 
  FaShoppingCart, 
  FaEye, 
  FaTrash, 
  FaCrown, 
  FaDownload,
  FaTags,
  FaExclamationCircle,
} from 'react-icons/fa';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import PropTypes from 'prop-types';

// Initialize Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

// Empty State Component
const EmptyState = ({ icon, title, message, action }) => (
  <div className="empty-state">
    <div className="empty-state-icon">{icon}</div>
    <h3 className="empty-state-title">{title}</h3>
    <p className="empty-state-message">{message}</p>
    {action && <div className="empty-state-action">{action}</div>}
  </div>
);

EmptyState.propTypes = {
  icon: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  action: PropTypes.node
};

// Loading Component
const Loading = ({ message = 'Loading...' }) => (
  <div className="loading-container">
    <div className="loading-spinner"></div>
    <p>{message}</p>
  </div>
);

Loading.propTypes = {
  message: PropTypes.string
};

// Purchase Modal Component
const PurchaseModal = ({ dataset, onClose, onPurchase }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const token = await currentUser.getIdToken();
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';
      
      const cardElement = elements.getElement(CardElement);
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      const response = await fetch(`${apiUrl}/purchase-dataset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id,
          datasetId: dataset.id,
          amount: dataset.price * 100,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Payment failed');
      }
      
      onPurchase(dataset.id);
      
      Swal.fire({
        title: 'Purchase Successful!',
        text: `You now have access to "${dataset.name}".`,
        icon: 'success',
        timer: 3000,
        showConfirmButton: false
      });
      
      onClose();
    } catch (err) {
      console.error('Purchase error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="purchase-modal-overlay" onClick={onClose}>
      <div className="purchase-modal" onClick={e => e.stopPropagation()}>
        <div className="purchase-modal-header">
          <h2>Purchase Dataset</h2>
        </div>
        
        <div className="purchase-modal-content">
          <div className="purchase-dataset-details">
            <div className="purchase-dataset-name">{dataset.name}</div>
            <div className="purchase-dataset-price">${parseFloat(dataset.price).toFixed(2)}</div>
            <p>{dataset.description}</p>
          </div>
          
          <form onSubmit={handleSubmit} className="purchase-form">
            <div className="form-group">
              <label htmlFor="card-element">Credit or debit card</label>
              <div className="card-element-container">
                <CardElement
                  id="card-element"
                  options={{
                    style: {
                      base: {
                        fontSize: '16px',
                        color: '#424770',
                        '::placeholder': {
                          color: '#aab7c4',
                        },
                      },
                      invalid: {
                        color: '#9e2146',
                      },
                    },
                  }}
                />
              </div>
            </div>
            
            {error && <div className="payment-error">{error}</div>}
            
            <div className="purchase-modal-footer">
              <button 
                type="button" 
                className="cancel-button" 
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              
              <button 
                type="submit" 
                className="purchase-button-large" 
                disabled={!stripe || loading}
              >
                {loading ? <span className="spinner"></span> : 'Complete Purchase'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

PurchaseModal.propTypes = {
  dataset: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onPurchase: PropTypes.func.isRequired
};

const SportsDataHub = () => {
  const { currentUser } = useAuth();
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
    userHasAccess,
  } = useContext(SportsDataHubContext);

  const auth = getAuth();
  const navigate = useNavigate();
  
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [ownedDatasets, setOwnedDatasets] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  useEffect(() => {
    const checkUserStatus = async () => {
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          const adminResponse = await fetch(`${apiUrl}/check-admin-status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ uid: currentUser.uid })
          });
          
          if (adminResponse.ok) {
            const adminData = await adminResponse.json();
            setIsAdmin(adminData.isAdmin);
          }
          
          const purchasesResponse = await fetch(`${apiUrl}/my-purchased-datasets`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ uid: currentUser.uid })
          });
          
          if (purchasesResponse.ok) {
            const purchasesData = await purchasesResponse.json();
            setOwnedDatasets(purchasesData.datasetIds || []);
          }
        } catch (error) {
          console.error('Error checking user status:', error);
        }
      }
    };
    
    checkUserStatus();
  }, [currentUser, apiUrl]);

  const handlePurchase = async (dataset) => {
    if (!currentUser) {
      Swal.fire({
        title: 'Sign In Required',
        text: 'You need to sign in to purchase datasets.',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Sign In',
        confirmButtonColor: '#3a86ff',
        cancelButtonText: 'Cancel'
      }).then((result) => {
        if (result.isConfirmed) {
          navigate('/login', { state: { returnUrl: '/hub' } });
        }
      });
      return;
    }
    
    setSelectedDataset(dataset);
    setShowPurchaseModal(true);
  };

  const handlePurchaseComplete = (datasetId) => {
    setOwnedDatasets([...ownedDatasets, datasetId]);
    
    Swal.fire({
      title: 'Purchase Successful!',
      html: `
        <div style="text-align: left; margin-bottom: 20px;">
          <p>You now have access to analyze "${selectedDataset.name}" data.</p>
          <p>Choose how you'd like to analyze your new dataset:</p>
        </div>
      `,
      icon: 'success',
      background: '#222',
      color: '#fff',
      showCancelButton: true,
      confirmButtonText: 'Analyze Now',
      confirmButtonColor: '#3a86ff',
      cancelButtonText: 'Later',
      cancelButtonColor: '#6c757d',
      showDenyButton: true,
      denyButtonText: 'View in Hub',
      denyButtonColor: '#6030A0',
    }).then((result) => {
      if (result.isConfirmed) {
        handleAnalyze(selectedDataset);
      }
    });
  };

  const handleAnalyze = async (datasetMeta) => {
    if (!currentUser) { /* …sign-in prompt… */ return; }
  
    setLoadingOperations(prev => ({ ...prev, [`analyze-${datasetMeta.id}`]: true }));
  
    try {
      const token = await currentUser.getIdToken();
      const res   = await fetch(`${apiUrl}/download-published-dataset`, {
        method : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization : `Bearer ${token}`,
        },
        body: JSON.stringify({ datasetId: datasetMeta.id }),
      });
  
      if (!res.ok) throw new Error('Could not fetch dataset JSON');
      const fullDataset = await res.json();          // <<< now we have games[]
  
      // (optional) normalise or migrate if your schema changed
      const formatted = {
        ...fullDataset,
        games: (fullDataset.games || []).map(g => ({    // ensure every tag has needed fields
          ...g,
          gameData: (g.gameData || []).map(tag => ({
            ...tag,
            position: typeof tag.position === 'string'
              ? tag.position
              : (tag.position?.type || 'forward'),
          }))
        }))
      };
  
      navigate('/analysis/gaa-dashboard', {
        state: { file: formatted, sport: formatted.category || 'GAA' },
      });
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message || 'Dataset load failed', 'error');
    } finally {
      setLoadingOperations(prev => ({ ...prev, [`analyze-${datasetMeta.id}`]: false }));
    }
  };
  

  const handleDownload = async (dataset) => {
    if (!currentUser) {
      Swal.fire({
        title: 'Sign In Required',
        text: 'You need to sign in to download datasets.',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Sign In',
        confirmButtonColor: '#3a86ff',
        cancelButtonText: 'Cancel'
      }).then((result) => {
        if (result.isConfirmed) {
          navigate('/login', { state: { returnUrl: '/hub' } });
        }
      });
      return;
    }
    
    setLoadingOperations((prev) => ({ ...prev, [`download-${dataset.id}`]: true }));

    try {
      const token = await currentUser.getIdToken();
      
      const needsPurchase = dataset.price > 0 && !ownedDatasets.includes(dataset.id);
      
      if (needsPurchase) {
        Swal.fire({
          title: 'Purchase Required',
          html: `<div class="purchase-alert">
                  <p>This dataset requires purchase before downloading.</p>
                  <div class="purchase-price">${dataset.price.toFixed(2)}</div>
                 </div>`,
          icon: 'info',
          showCancelButton: true,
          confirmButtonText: 'Purchase Now',
          confirmButtonColor: '#3a86ff',
          cancelButtonText: 'Cancel'
        }).then((result) => {
          if (result.isConfirmed) {
            handlePurchase(dataset);
          }
        });
        setLoadingOperations((prev) => ({ ...prev, [`download-${dataset.id}`]: false }));
        return;
      }
      
      const response = await fetch(`${apiUrl}/download-published-dataset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      
      await fetch(`${apiUrl}/increment-downloads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ datasetId: dataset.id }),
      });
      
      Swal.fire({
        title: 'Downloaded!',
        text: `Dataset "${dataset.name}" has been downloaded.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Error downloading dataset:', error);
      Swal.fire('Error', error.message || 'Failed to download dataset.', 'error');
    } finally {
      setLoadingOperations((prev) => ({ ...prev, [`download-${dataset.id}`]: false }));
    }
  };

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

      const formattedSample = sampleActions
        .map(
          (action, index) =>
            `<div class="sample-item">
              <div class="sample-header">
                <span class="sample-number">#${index + 1}</span>
                ${action.playerName ? `<span class="player-name">${action.playerName}</span>` : ''}
                ${action.action ? `<span class="action-type">${action.action}</span>` : ''}
              </div>
              <div class="sample-details">
                ${action.x && action.y ? `<span class="coordinates">Position: (${Math.round(action.x)}, ${Math.round(action.y)})</span>` : ''}
                ${action.pressure ? `<span class="pressure">Pressure: ${action.pressure}</span>` : ''}
              </div>
            </div>`
        )
        .join('');

      Swal.fire({
        title: `Sample of "${dataset.name}"`,
        html: `
          <div class="sample-container">
            <div class="sample-intro">Here's a sample of the data contained in this dataset:</div>
            <div class="sample-list">${formattedSample}</div>
            <div class="sample-footer">
              <div class="sample-info">
                <i class="fa fa-info-circle"></i>
                This dataset contains ${dataset.gameCount || 'multiple'} games with detailed action data.
              </div>
            </div>
          </div>
        `,
        width: '80%',
        heightAuto: true,
        showConfirmButton: true,
        confirmButtonText: 'Close',
        confirmButtonColor: '#3a86ff',
      });
    } catch (error) {
      console.error('Error fetching dataset sample:', error);
      Swal.fire('Error', error.message || 'Failed to fetch dataset sample.', 'error');
    } finally {
      setLoadingOperations((prev) => ({ ...prev, [`viewSample-${dataset.id}`]: false }));
    }
  };

  const handleDeleteDataset = async (dataset) => {
    if (!currentUser) {
      Swal.fire('Error', 'You must be logged in to delete datasets.', 'error');
      return;
    }

    const confirmDeletion = await Swal.fire({
      title: 'Are you sure?',
      html: `<div class="delete-confirmation">
              <p>Do you want to delete the dataset <strong>"${dataset.name}"</strong>?</p>
              <p class="delete-warning">This action cannot be undone.</p>
             </div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      confirmButtonColor: '#f94144',
      cancelButtonText: 'Cancel',
      cancelButtonColor: '#6c757d',
    });

    if (confirmDeletion.isConfirmed) {
      setLoadingOperations((prev) => ({ ...prev, [`delete-${dataset.id}`]: true }));

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`${apiUrl}/delete-published-dataset`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ uid: currentUser.uid, datasetId: dataset.id }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to delete dataset.');
        }

        await fetchPublishedDatasets();
        Swal.fire({
          title: 'Deleted!',
          text: `Dataset "${dataset.name}" has been deleted.`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } catch (error) {
        console.error('Error deleting dataset:', error);
        Swal.fire('Error', error.message || 'Failed to delete dataset.', 'error');
      } finally {
        setLoadingOperations((prev) => ({ ...prev, [`delete-${dataset.id}`]: false }));
      }
    }
  };
  
  const handleSort = (sortOption) => {
    setSortBy(sortOption);
  };
  
  const handleRefresh = () => {
    fetchPublishedDatasets();
    Swal.fire({
      title: 'Refreshed!',
      text: 'Dataset list has been updated.',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false
    });
  };

  if (!userHasAccess && !loading) {
    return (
      <div className="sports-datahub-container">
        <div className="access-restricted">
          <FaExclamationCircle className="restricted-icon" />
          <h2>Access Restricted</h2>
          <p>You don't have permission to access the Sports Data Hub.</p>
          {currentUser ? (
            <p>Please upgrade your account or contact an administrator for access.</p>
          ) : (
            <button 
              className="login-button"
              onClick={() => navigate('/login', { state: { returnUrl: '/hub' } })}
            >
              Sign In to Access
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="sports-datahub-container">
        <Loading message="Loading datasets..." />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="sports-datahub-container">
        <div className="error-container">
          <FaExclamationCircle className="error-icon" />
          <h3>Error Loading Datasets</h3>
          <p>{fetchError}</p>
          <button 
            className="retry-button"
            onClick={fetchPublishedDatasets}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const sortedDatasets = [...filteredDatasets].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
        const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
        return dateB - dateA;
      case 'popular':
        return (b.downloads || 0) - (a.downloads || 0);
      case 'price-low':
        return (a.price || 0) - (b.price || 0);
      case 'price-high':
        return (b.price || 0) - (a.price || 0);
      default:
        return 0;
    }
  });

  return (
    <div className="sports-datahub-container">
      <div className="datahub-header">
        <h1>Sports Data Hub</h1>
        <p className="datahub-subtitle">
          Discover and download high-quality sports datasets for analysis and research
        </p>
      </div>
  
      <div className="search-controls">
        <div className={`search-box ${isSearchFocused ? 'focused' : ''}`}>
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search datasets by name, sport or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            aria-label="Search datasets"
          />
        </div>
  
        <div className="filter-controls">
          <div className="filter-dropdown">
            <label htmlFor="sport-filter">
              <FaFilter className="filter-icon" />
              <span className="sr-only">Filter by sport</span>
            </label>
            <select
              id="sport-filter"
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
  
          <div className="sort-dropdown">
            <label htmlFor="sort-options">
              <FaSortAmountDown className="sort-icon" />
              <span className="sr-only">Sort datasets</span>
            </label>
            <select
              id="sort-options"
              value={sortBy}
              onChange={(e) => handleSort(e.target.value)}
            >
              <option value="recent">Most Recent</option>
              <option value="popular">Most Popular</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
  
          <button
            className="refresh-button"
            onClick={handleRefresh}
            aria-label="Refresh datasets"
            title="Refresh datasets"
          >
            <FaRedo className="refresh-icon" />
          </button>
  
          <div className="view-toggle">
            <button
              className={`view-button ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
              title="Grid view"
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              className={`view-button ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
              title="List view"
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <rect x="3" y="4" width="18" height="2" rx="1" />
                <rect x="3" y="11" width="18" height="2" rx="1" />
                <rect x="3" y="18" width="18" height="2" rx="1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
  
      <div className={`datasets-container ${viewMode}`}>
        {sortedDatasets.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="datasets-grid">
              {sortedDatasets.map((dataset) => {
                const isViewingSample = loadingOperations[`viewSample-${dataset.id}`];
                const isDeleting = loadingOperations[`delete-${dataset.id}`];
                const isPurchasing = loadingOperations[`purchase-${dataset.id}`];
                const isAnalyzing = loadingOperations[`analyze-${dataset.id}`];
  
                const isOwner = currentUser ? dataset.creator_uid === currentUser.uid : false;
                const isAlreadyOwned = ownedDatasets.includes(dataset.id);
                const needsPurchase = dataset.price > 0 && !isAlreadyOwned;
  
                return (
                  <div key={dataset.id} className="dataset-card">
                    <div className="dataset-card-header">
                      <h3 title={dataset.name}>{dataset.name}</h3>
                      {dataset.price > 0 && (
                        <span className="premium-badge" title="Premium dataset">
                          <FaCrown className="premium-icon" />
                          Premium
                        </span>
                      )}
                    </div>
  
                    <div className="dataset-card-content">
                      <p className="dataset-description" title={dataset.description}>
                        {dataset.description}
                      </p>
  
                      <div className="dataset-meta">
                        <span className="dataset-category" title={`Category: ${dataset.category}`}>
                          <FaTags className="category-icon" />
                          {dataset.category}
                        </span>
  
                        <span className="dataset-price" title={dataset.price > 0 ? `Price: ${parseFloat(dataset.price).toFixed(2)}` : 'Free dataset'}>
                          {dataset.price > 0 ? (
                            <>${parseFloat(dataset.price).toFixed(2)}</>
                          ) : (
                            <>Free</>
                          )}
                        </span>
                      </div>
  
                      {dataset.downloads > 0 && (
                        <span
                          className="dataset-downloads"
                          title={`${dataset.downloads} downloads`}
                        >
                          <FaDownload className="downloads-icon" />
                          {dataset.downloads}
                        </span>
                      )}
                    </div>
  
                    <div className="dataset-card-actions">
                      <button
                        className="action-button sample-button"
                        onClick={() => handleViewSample(dataset)}
                        disabled={isViewingSample}
                        title="View sample"
                        aria-label="View sample"
                      >
                        {isViewingSample ? <span className="spinner" /> : (
                          <>
                            <FaEye />
                            <span>Sample</span>
                          </>
                        )}
                      </button>

                      {needsPurchase ? (
                        <button
                          className="action-button purchase-button"
                          onClick={() => handlePurchase(dataset)}
                          disabled={isPurchasing}
                          title="Purchase dataset"
                          aria-label="Purchase dataset"
                        >
                          {isPurchasing ? <span className="spinner" /> : (
                            <>
                              <FaShoppingCart />
                              <span>Buy</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          className="action-button download-button"
                          onClick={() => handleDownload(dataset)}
                          disabled={loadingOperations[`download-${dataset.id}`]}
                          title="Download dataset"
                          aria-label="Download dataset"
                        >
                          {loadingOperations[`download-${dataset.id}`] ? (
                            <span className="spinner" />
                          ) : (
                            <>
                              <FaDownload />
                              <span>Download</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        className="action-button analyze-button"
                        onClick={() => handleAnalyze(dataset)}
                        disabled={isAnalyzing}
                        title="Analyze dataset"
                        aria-label="Analyze dataset"
                      >
                        {isAnalyzing ? <span className="spinner" /> : (
                          <>
                            <AnalyticsIcon />
                            <span>Analyze</span>
                          </>
                        )}
                      </button>

                      {(isOwner || isAdmin) && (
                        <button
                          className="action-button delete-button"
                          onClick={() => handleDeleteDataset(dataset)}
                          disabled={isDeleting}
                          title="Delete dataset"
                          aria-label="Delete dataset"
                        >
                          {isDeleting ? <span className="spinner" /> : (
                            <>
                              <FaTrash />
                              <span>Delete</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="datasets-list">
              {sortedDatasets.map((dataset) => {
                const isViewingSample = loadingOperations[`viewSample-${dataset.id}`];
                const isDeleting = loadingOperations[`delete-${dataset.id}`];
                const isAnalyzing = loadingOperations[`analyze-${dataset.id}`];
  
                const isOwner = currentUser ? dataset.creator_uid === currentUser.uid : false;
                const isAlreadyOwned = ownedDatasets.includes(dataset.id);
                const needsPurchase = dataset.price > 0 && !isAlreadyOwned;
  
                return (
                  <div key={dataset.id} className="dataset-row">
                    <div className="dataset-row-main" onClick={() => handleViewSample(dataset)}>
                      <h4>{dataset.name}</h4>
                      <span className="dataset-category">{dataset.category}</span>
                      <span className="dataset-price">
                        {dataset.price > 0 ? `$${parseFloat(dataset.price).toFixed(2)}` : 'Free'}
                      </span>
                      {dataset.downloads > 0 && (
                        <span className="dataset-downloads">
                          <FaDownload className="downloads-icon" />
                          {dataset.downloads}
                        </span>
                      )}
                    </div>
  
                    <div className="dataset-row-actions">
                      <button
                        className="action-button sample-button"
                        onClick={() => handleViewSample(dataset)}
                        disabled={isViewingSample}
                        title="View sample"
                        aria-label="View sample"
                      >
                        {isViewingSample ? <span className="spinner" /> : <FaEye />}
                      </button>
  
                      {needsPurchase ? (
                        <button
                          className="action-button purchase-button"
                          onClick={() => handlePurchase(dataset)}
                          disabled={loadingOperations[`purchase-${dataset.id}`]}
                          title="Purchase dataset"
                          aria-label="Purchase dataset"
                        >
                          {loadingOperations[`purchase-${dataset.id}`] ? (
                            <span className="spinner" />
                          ) : (
                            <FaShoppingCart />
                          )}
                        </button>
                      ) : (
                        <button
                          className="action-button download-button"
                          onClick={() => handleDownload(dataset)}
                          disabled={loadingOperations[`download-${dataset.id}`]}
                          title="Download dataset"
                          aria-label="Download dataset"
                        >
                          {loadingOperations[`download-${dataset.id}`] ? (
                            <span className="spinner" />
                          ) : (
                            <FaDownload />
                          )}
                        </button>
                      )}
  
                      <button
                        className="action-button analyze-button"
                        onClick={() => handleAnalyze(dataset)}
                        disabled={isAnalyzing}
                        title="Analyze dataset"
                        aria-label="Analyze dataset"
                      >
                        {isAnalyzing ? <span className="spinner" /> : <AnalyticsIcon />}
                      </button>
  
                      {(isOwner || isAdmin) && (
                        <button
                          className="action-button delete-button"
                          onClick={() => handleDeleteDataset(dataset)}
                          disabled={isDeleting}
                          title="Delete dataset"
                          aria-label="Delete dataset"
                        >
                          {isDeleting ? <span className="spinner" /> : <FaTrash />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : null}
  
        {sortedDatasets.length === 0 && (
          <EmptyState
            icon={<FaSearch />}
            title="No datasets found"
            message="Try adjusting your search terms or filters."
          />
        )}
  
        {showPurchaseModal && selectedDataset && (
          <Elements stripe={stripePromise}>
            <PurchaseModal
              dataset={selectedDataset}
              onClose={() => setShowPurchaseModal(false)}
              onPurchase={handlePurchaseComplete}
            />
          </Elements>
        )}
      </div>
    </div>
  );
};

export default SportsDataHub;