// src/api.js

// First try localhost, then fallback to your Render URL
const PRIMARY  = process.env.REACT_APP_API_LOCAL;
const FALLBACK = process.env.REACT_APP_API_URL;

// Generic fetch helper: primary → fallback
async function fetchWithFallback(path, opts) {
  const makeUrl = base =>
    base.replace(/\/$/, '') +
    (path.startsWith('/') ? path : '/' + path);

  // 1) Try primary (localhost)
  try {
    const res = await fetch(makeUrl(PRIMARY), opts);
    if (!res.ok) throw new Error(`Local API returned ${res.status}`);
    return res;
  } catch (e) {
    console.warn(`Local API failed (${PRIMARY}):`, e.message);
    // 2) Try fallback (Render)
    const res2 = await fetch(makeUrl(FALLBACK), opts);
    if (!res2.ok) throw new Error(`Render API returned ${res2.status}`);
    return res2;
  }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function loadGames(uid) {
  const res = await fetchWithFallback('/load-games', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ uid }),
  });
  return res.json();
}

export async function deleteGame(uid, gameId) {
  const res = await fetchWithFallback('/delete-game', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ uid, gameId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete game.');
  return data;
}

export async function deleteDataset(uid, datasetName) {
  const res = await fetchWithFallback('/delete-dataset', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ uid, datasetName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete dataset.');
  return data;
}

export async function downloadDataset(uid, datasetName) {
  const res = await fetchWithFallback('/download-dataset', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ uid, datasetName }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to download dataset.');
  }
  return res.blob();
}

// New functions for admin permissions and dataset management

/**
 * Check if a user has admin status
 * @param {string} uid - User ID
 * @param {string} email - User email
 * @returns {Promise<boolean>} Whether the user is an admin
 */
export async function checkAdminStatus(uid, email) {
  const res = await fetchWithFallback('/check-admin-status', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ uid, email }),
  });
  const data = await res.json();
  return data.isAdmin || false;
}

/**
 * Publish a dataset with permission checking
 * @param {FormData} formData - Form data including dataset info
 * @param {string} idToken - Firebase auth token
 * @returns {Promise<Object>} Response data
 */
export async function publishDataset(formData, idToken) {
  const res = await fetchWithFallback('/publish-dataset', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`
      // Note: Don't set Content-Type for FormData, browser will set it with boundary
    },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to publish dataset.');
  return data;
}

/**
 * Get all published datasets (with permission checking)
 * @param {string} idToken - Firebase auth token (optional)
 * @returns {Promise<Object>} Datasets and metadata
 */
export async function getPublishedDatasets(idToken) {
  const headers = { ...JSON_HEADERS };
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }
  
  const res = await fetchWithFallback('/published-datasets', {
    method: 'GET',
    headers: headers,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch published datasets.');
  return data;
}

/**
 * Save admin settings for dataset permissions
 * @param {string} uid - User ID
 * @param {Object} settings - Settings object
 * @param {string} idToken - Firebase auth token
 * @returns {Promise<Object>} Response data
 */
export async function saveAdminSettings(uid, settings, idToken) {
  const res = await fetchWithFallback('/save-admin-settings', {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ 
      uid, 
      settings 
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save admin settings.');
  return data;
}

/**
 * Get dataset publishing permissions for a user
 * @param {string} uid - User ID
 * @param {string} userType - User subscription type
 * @param {string} idToken - Firebase auth token
 * @returns {Promise<Object>} Permission data
 */
export async function getDatasetPermissions(uid, userType, idToken) {
  const res = await fetchWithFallback('/dataset-permissions', {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ uid, userType }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get dataset permissions.');
  return data;
}

/**
 * Get the list of admin users
 * @param {string} uid - User ID
 * @param {string} idToken - Firebase auth token
 * @returns {Promise<Array<string>>} List of admin email addresses
 */
export async function getAdminUsers(uid, idToken) {
  const res = await fetchWithFallback('/admin-users', {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ uid }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get admin users list.');
  return data.adminUsers || [];
}

/**
 * Add a new admin user
 * @param {string} uid - User ID of current admin
 * @param {string} newAdminEmail - Email of user to add as admin
 * @param {string} idToken - Firebase auth token
 * @returns {Promise<Object>} Response data
 */
export async function addAdminUser(uid, newAdminEmail, idToken) {
  const res = await fetchWithFallback('/add-admin-user', {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ uid, newAdminEmail }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add admin user.');
  return data;
}

/**
 * Remove an admin user
 * @param {string} uid - User ID of current admin
 * @param {string} adminEmail - Email of admin to remove
 * @param {string} idToken - Firebase auth token
 * @returns {Promise<Object>} Response data
 */
export async function removeAdminUser(uid, adminEmail, idToken) {
  const res = await fetchWithFallback('/remove-admin-user', {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ uid, adminEmail }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to remove admin user.');
  return data;
}

// Export the helper for other manual calls
export { fetchWithFallback };