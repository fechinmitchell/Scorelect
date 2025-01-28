// src/utils/shotUtils.js

/**
 * Translates a shot to one side based on team orientation.
 * @param {Object} shot - The shot data.
 * @param {number} halfLineX - The x-coordinate of the half line.
 * @param {number} goalX - The x-coordinate of the goal.
 * @param {number} goalY - The y-coordinate of the goal.
 * @returns {Object} - Translated shot data with distance.
 */
export function translateShotToOneSide(shot, halfLineX, goalX, goalY) {
  const targetGoal = shot.x <= halfLineX ? { x: 0, y: goalY } : { x: goalX, y: goalY };
  const dx = (shot.x || 0) - targetGoal.x;
  const dy = (shot.y || 0) - targetGoal.y;
  const distMeters = Math.sqrt(dx * dx + dy * dy);
  return { ...shot, distMeters };
}

/**
 * Categorizes a shot based on its action description.
 * @param {string} actionStr - The action description.
 * @returns {string} - The category of the shot.
 */
export function getShotCategory(actionStr) {
  const a = (actionStr || '').toLowerCase().trim();

  // 1) Special-case penalty goal
  if (a === 'penalty goal') {
    return 'penaltyGoal';
  }
  if (a === 'pen miss') {
    return 'penaltyMiss'; // if you want to treat a missed penalty differently
  }

  // Then your normal logic...
  const knownSetPlayActions = [
    'free', 'missed free', 'fortyfive', 'offensive mark', 'penalty goal',
    'pen miss', 'free short', 'free wide', 'fortyfive short', 'fortyfive wide',
    'fortyfive post', 'free post', 'offensive mark short', 'offensive mark wide', 'mark wide'
  ];

  function isSetPlayScore(a) {
    if (a.includes('wide') || a.includes('short') || a.includes('miss') || a.includes('post')) return false;
    return true;
  }

  if (knownSetPlayActions.some(sp => a === sp)) {
    return isSetPlayScore(a) ? 'setplay-score' : 'setplay-miss';
  }
  if (a === 'goal') return 'goal';
  
  const knownMisses = ['wide','goal miss','miss','block','blocked','post','short','pen miss'];
  if (knownMisses.some(m => a === m)) return 'miss';
  if (a === 'point') return 'point';

  return 'other';
}
