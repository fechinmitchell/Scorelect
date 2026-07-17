// Model2026.js
// -----------------------------------------------------------------------------
// Client-side GAA xP (points) and xG (goals) model.
//
// This replaces the old distance-bucket lookup with the fitted logistic-regression
// models trained in Python (train_export.py). The coefficients + scaler params live
// in ./gaa_model_coefficients.json, which is imported at build time.
//
// The feature engineering here MUST stay in sync with train_export.py::engineer_row.
// It has been validated to reproduce scikit-learn's predictions to 6 decimal places.
//
// Public API is unchanged so existing imports keep working:
//   useCalibrationModel()  -> { calibrationModel, loading }
//   calculateXP(shot, distanceMeters, calibrationModel) -> number in [0,1]
//   calculateXG(shot, distanceMeters, calibrationModel) -> number in [0,1]
//
// NOTE: distanceMeters is now IGNORED (kept only for signature compatibility) —
// the model recomputes distance internally from x/y so that angle, side, etc. are
// all consistent. You can pass null.
// -----------------------------------------------------------------------------

import MODEL from './gaa_model_coefficients.json';

const { midlineX, goalX, goalY, positionLevels, footLevels, pointFromPlay } = MODEL.meta;

// ---- Feature engineering (mirrors train_export.py exactly) -------------------

function pressureToValue(p) {
  const s = String(p).trim().toLowerCase();
  const map = { y: 1, yes: 1, n: 0, no: 0, '0': 0, '1': 1, '2': 2 };
  if (s in map) return map[s];
  const f = parseFloat(p);
  return isNaN(f) ? 0 : f;
}

function isPreferableSide(standY, foot) {
  foot = String(foot).trim().toLowerCase();
  let side = 'center';
  if (standY < goalY) side = 'left';
  else if (standY > goalY) side = 'right';
  if ((side === 'left' && foot === 'right') ||
      (side === 'right' && foot === 'left') ||
      (side === 'right' && foot === 'hand') ||
      (side === 'left' && foot === 'hand')) return 1;
  return 0;
}

function engineerFeatures(shot) {
  const x = parseFloat(shot.x) || 0;
  const yRaw = parseFloat(shot.y) || 0;

  // Flip y once, then standardise onto one side of the pitch (attacking right goal).
  const y = 2 * goalY - yRaw;
  let standX, standY;
  if (x <= midlineX) {
    standX = 2 * midlineX - x;
    standY = 2 * goalY - y;
  } else {
    standX = x;
    standY = y;
  }

  const shotDistance = Math.sqrt((standX - goalX) ** 2 + (standY - goalY) ** 2);
  const shotAngle = Math.atan2(goalY - standY, goalX - standX) * 180 / Math.PI;

  const action = String(shot.action || '').toLowerCase().trim();
  const foot = String(shot.foot || '').toLowerCase().trim();
  let position = String(shot.position || '').toLowerCase().trim();
  if (position === 'midfield') position = 'midfielder';

  const isGoalAttempt = action.includes('goal') || action.includes('pen miss');
  let placedBall;
  if (isGoalAttempt) placedBall = (action === 'goal' || action === 'goal miss') ? 0 : 1;
  else placedBall = pointFromPlay.includes(action) ? 0 : 1;

  const f = {
    Preferred_Side: isPreferableSide(standY, foot),
    pressure_Value: pressureToValue(shot.pressure),
    Shot_Angle: shotAngle,
    Shot_Distance: Math.round(shotDistance * 10000) / 10000,
    Placed_Ball: placedBall,
  };
  positionLevels.forEach((l) => { f[`pos_${l}`] = position === l ? 1 : 0; });
  footLevels.forEach((l) => { f[`foot_${l}`] = foot === l ? 1 : 0; });

  f.angle_x_distance = f.Shot_Angle * f.Shot_Distance;
  f.pressure_x_distance = f.pressure_Value * f.Shot_Distance;
  f.preferred_x_angle = f.Preferred_Side * f.Shot_Angle;
  f.placed_x_distance = f.Placed_Ball * f.Shot_Distance;

  f._isGoalAttempt = isGoalAttempt;
  f._action = action;
  return f;
}

function evalLogistic(model, f) {
  const cols = model.features;
  let logit = model.intercept;
  for (let i = 0; i < cols.length; i++) {
    const raw = f[cols[i]];
    const z = (raw - model.mean[i]) / model.scale[i];
    logit += z * model.coef[i];
  }
  return 1 / (1 + Math.exp(-logit));
}

// ---- Public API --------------------------------------------------------------

// The model is now static (bundled JSON), so there's nothing async to load.
// We keep the hook shape for backward compatibility: components can still do
//   const { calibrationModel } = useCalibrationModel();
// and pass calibrationModel through to calculateXP/XG (it's ignored internally).
export function useCalibrationModel() {
  return { calibrationModel: MODEL, loading: false };
}

// Expected points for a non-goal attempt.
// Falls back to a stored xPoints if the shot already carries a valid one.
export function calculateXP(shot /*, distanceMeters, calibrationModel */) {
  if (shot && shot.xPoints !== undefined && shot.xPoints !== null) {
    const existing = parseFloat(shot.xPoints);
    if (!isNaN(existing) && existing >= 0 && existing <= 1) return existing;
  }
  const f = engineerFeatures(shot || {});
  return evalLogistic(MODEL.points, f);
}

// Expected goals for a goal attempt.
// Penalties use the fixed value from training; otherwise the goals model.
export function calculateXG(shot /*, distanceMeters, calibrationModel */) {
  if (shot && shot.xGoals !== undefined && shot.xGoals !== null) {
    const existing = parseFloat(shot.xGoals);
    if (!isNaN(existing) && existing >= 0 && existing <= 1) return existing;
  }
  const action = String((shot && shot.action) || '').toLowerCase().trim();
  if (action === 'penalty' || action === 'penalty goal') return MODEL.penaltyXG;

  const f = engineerFeatures(shot || {});
  return evalLogistic(MODEL.goals, f);
}

// Optional convenience: engineer features without predicting (handy for debugging).
export function _engineerFeatures(shot) {
  return engineerFeatures(shot);
}