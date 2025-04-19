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

// Export the helper for other manual calls
export { fetchWithFallback };
