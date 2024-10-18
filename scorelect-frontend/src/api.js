// src/api.js

const apiUrl = process.env.REACT_APP_API_URL;

export const loadGames = async (uid) => {
  const response = await fetch(`${apiUrl}/load-games`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uid }),
  });
  if (!response.ok) {
    throw new Error('Failed to load games.');
  }
  return response.json();
};

export const deleteGame = async (uid, gameId) => {
  const response = await fetch(`${apiUrl}/delete-game`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uid, gameId }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to delete game.');
  }
  return response.json();
};

export const deleteDataset = async (uid, datasetName) => {
  const response = await fetch(`${apiUrl}/delete-dataset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uid, datasetName }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to delete dataset.');
  }
  return response.json();
};

export const downloadDataset = async (uid, datasetName) => {
  const response = await fetch(`${apiUrl}/download-dataset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uid, datasetName }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to download dataset.');
  }
  return response.blob();
};
