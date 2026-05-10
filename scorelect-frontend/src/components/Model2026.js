import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { firestore } from '../firebase';// adjust path as needed

const CALIBRATION_DATASET = 'GAA All Shots Formatted';
const CALIBRATION_USER_ID = 'w9ZkqaYVM3dKSqqjWHLDVyh5sVg2';
const MIDLINE_X = 72.5;
const GOAL_Y = 44;
const GOAL_X_RIGHT = 145;

export function useCalibrationModel() {
  const [calibrationModel, setCalibrationModel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function buildCalibrationModel() {
      try {
        const gamesCollectionRef = collection(firestore, `savedGames/${CALIBRATION_USER_ID}/games`);
        const snapshot = await getDocs(gamesCollectionRef);

        let calibrationShots = [];
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.datasetName === CALIBRATION_DATASET) {
            const gameData = data.gameData || [];
            const gameDataArray = Array.isArray(gameData) ? gameData : Object.values(gameData);
            calibrationShots = calibrationShots.concat(gameDataArray);
          }
        });

        if (calibrationShots.length === 0) {
          setCalibrationModel(null);
          setLoading(false);
          return;
        }

        const buckets = {};
        calibrationShots.forEach(shot => {
          const x = parseFloat(shot.x) || 0;
          const y = parseFloat(shot.y) || 0;
          const targetGoal = x <= MIDLINE_X ? { x: 0, y: GOAL_Y } : { x: GOAL_X_RIGHT, y: GOAL_Y };
          const dx = x - targetGoal.x;
          const dy = y - targetGoal.y;
          const distanceMeters = Math.sqrt(dx * dx + dy * dy);

          const bucket = Math.floor(distanceMeters / 5) * 5;
          if (!buckets[bucket]) {
            buckets[bucket] = {
              setPlay: { attempts: 0, scores: 0 },
              play: { attempts: 0, scores: 0 },
              goal: { attempts: 0, scores: 0 }
            };
          }

          const actionLower = (shot.action || '').toLowerCase();
          const typeLower = (shot.type || '').toLowerCase();
          const isSetPlay = ['free', 'fortyfive', '45', 'mark', 'offensive mark', 'penalty'].includes(actionLower);
          const isGoalAttempt = actionLower === 'goal' || typeLower === 'goal' || typeLower === 'saved';
          const isPointScored = actionLower === 'point' || (isSetPlay && typeLower === 'score');
          const isGoalScored = actionLower === 'goal';

          if (isGoalAttempt) {
            buckets[bucket].goal.attempts += 1;
            if (isGoalScored) buckets[bucket].goal.scores += 1;
          } else if (isSetPlay) {
            buckets[bucket].setPlay.attempts += 1;
            if (isPointScored) buckets[bucket].setPlay.scores += 1;
          } else {
            buckets[bucket].play.attempts += 1;
            if (isPointScored) buckets[bucket].play.scores += 1;
          }
        });

        const model = { buckets: {}, shotCount: calibrationShots.length };
        Object.keys(buckets).forEach(b => {
          const data = buckets[b];
          model.buckets[b] = {
            setPlayRate: data.setPlay.attempts > 0 ? data.setPlay.scores / data.setPlay.attempts : null,
            playRate: data.play.attempts > 0 ? data.play.scores / data.play.attempts : null,
            goalRate: data.goal.attempts > 0 ? data.goal.scores / data.goal.attempts : null
          };
        });

        setCalibrationModel(model);
      } catch (err) {
        console.error('Error building calibration model:', err);
        setCalibrationModel(null);
      } finally {
        setLoading(false);
      }
    }
    buildCalibrationModel();
  }, []);

  return { calibrationModel, loading };
}

// Lookup functions exported for use in any component
export function calculateXP(shot, distanceMeters, calibrationModel) {
  if (shot.xPoints !== undefined && shot.xPoints !== null) {
    const existing = parseFloat(shot.xPoints);
    if (!isNaN(existing) && existing >= 0 && existing <= 1) return existing;
  }

  const bucket = Math.floor(distanceMeters / 5) * 5;
  const actionLower = (shot.action || '').toLowerCase();
  const isSetPlay = ['free', 'fortyfive', '45', 'mark', 'offensive mark', 'penalty'].includes(actionLower);

  if (calibrationModel && calibrationModel.buckets) {
    if (calibrationModel.buckets[bucket]) {
      const rate = isSetPlay
        ? calibrationModel.buckets[bucket].setPlayRate
        : calibrationModel.buckets[bucket].playRate;
      if (rate !== null) return rate;
    }
    const bucketKeys = Object.keys(calibrationModel.buckets).map(Number).sort((a, b) => a - b);
    if (bucketKeys.length > 0) {
      const nearest = bucketKeys.reduce((prev, curr) =>
        Math.abs(curr - bucket) < Math.abs(prev - bucket) ? curr : prev, bucketKeys[0]);
      const rate = isSetPlay
        ? calibrationModel.buckets[nearest]?.setPlayRate
        : calibrationModel.buckets[nearest]?.playRate;
      if (rate !== null && rate !== undefined) return rate;
    }
  }

  return isSetPlay ? 0.5 : 0.3;
}

export function calculateXG(shot, distanceMeters, calibrationModel) {
  if (shot.xGoals !== undefined && shot.xGoals !== null) {
    const existing = parseFloat(shot.xGoals);
    if (!isNaN(existing) && existing >= 0 && existing <= 1) return existing;
  }

  const bucket = Math.floor(distanceMeters / 5) * 5;
  const actionLower = (shot.action || '').toLowerCase();
  if (actionLower === 'penalty' || actionLower === 'penalty goal') return 0.82;

  if (calibrationModel && calibrationModel.buckets) {
    if (calibrationModel.buckets[bucket]?.goalRate !== null &&
        calibrationModel.buckets[bucket]?.goalRate !== undefined) {
      return calibrationModel.buckets[bucket].goalRate;
    }
    const bucketKeys = Object.keys(calibrationModel.buckets).map(Number).sort((a, b) => a - b);
    if (bucketKeys.length > 0) {
      const nearest = bucketKeys.reduce((prev, curr) =>
        Math.abs(curr - bucket) < Math.abs(prev - bucket) ? curr : prev, bucketKeys[0]);
      const rate = calibrationModel.buckets[nearest]?.goalRate;
      if (rate !== null && rate !== undefined) return rate;
    }
  }

  return 0.15;
}