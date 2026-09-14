import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { firestore } from '../firebase';
import Swal from 'sweetalert2';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useCalibrationModel, calculateXP, calculateXG, _engineerFeatures } from './Model2026';
import './TeamDetails.css';

const ARC_CUTOFF = 20;

const twoPointValue = (action, distMeters, fromEndline) => {
  const act = String(action || '').toLowerCase().trim();
  if (act === 'goal' || act === 'penalty goal') return 3;
  if (/miss|wide|short|blocked|post/.test(act)) return 0;
  const scoring = ['point', 'free', 'offensive mark', '45', 'fortyfive'];
  if (!scoring.some(a => act.includes(a))) return 0;
  if (act.includes('45') || act.includes('fortyfive')) return 1;
  return (distMeters >= 40 && fromEndline >= ARC_CUTOFF) ? 2 : 1;
};

function formatFixture(raw = '') {
  return String(raw)
    .split('_')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' v ');
}

function getMatchTeams(gameName = '') {
  const parts = String(gameName).split('_');
  return parts.length >= 2 ? `${parts[0]}_${parts[1]}` : gameName;
}

// Every metric the chart can plot
const METRICS = [
  { key: 'xPoints',     label: 'xP',           colour: '#00b7ff' },
  { key: 'points',      label: 'Points',       colour: '#ffffff' },
  { key: 'xGoals',      label: 'xG',           colour: '#ffd900' },
  { key: 'goals',       label: 'Goals',        colour: '#00ff6e' },
  { key: 'twoPointers', label: 'Two-Pointers', colour: '#ff6600' },
  { key: 'misses',      label: 'Misses',       colour: '#FF4136' },
  { key: 'totalShots',  label: 'Total Shots',  colour: '#9254de' },
  { key: 'xScore',      label: 'xScore',       colour: '#00ffee' },
  { key: 'totalScore',  label: 'Total Score',  colour: '#71705c' },
];

export default function TeamTrends() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { calibrationModel } = useCalibrationModel();

  const [allShots, setAllShots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(state?.teamName || '');
  const [activeMetrics, setActiveMetrics] = useState(['points', 'xPoints', 'goals']);

  const passedUserId = state?.userId || null;
  const passedGameIds = state?.gameIds || null;

  // Fetch — same source as TeamDetails
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        let userId = passedUserId;
        if (!userId) {
          const cfgSnap = await getDoc(doc(firestore, 'config/publicDataset'));
          userId = cfgSnap.exists()
            ? (cfgSnap.data().userId || 'w9ZkqaYVM3dKSqqjWHLDVyh5sVg2')
            : 'w9ZkqaYVM3dKSqqjWHLDVyh5sVg2';
        }

        let gameIds = passedGameIds;
        if (!gameIds || gameIds.length === 0) {
          const gamesSnap = await getDocs(collection(firestore, `savedGames/${userId}/games`));
          gameIds = gamesSnap.docs.map(d => d.id);
        }

        const list = [];
        for (const gameId of gameIds) {
          const gSnap = await getDoc(doc(firestore, `savedGames/${userId}/games/${gameId}`));
          if (!gSnap.exists()) continue;
          const data = gSnap.data();
          const gd = data.gameData || [];
          const arr = Array.isArray(gd) ? gd : Object.values(gd);
          arr.forEach(item => list.push({
            ...item,
            gameName: data.gameName || gameId,
            matchDate: data.matchDate || null,
            gameId,
          }));
        }

        setAllShots(list);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [passedUserId, passedGameIds]);

  const teams = useMemo(() => {
    const set = new Set();
    allShots.forEach(s => s.team && set.add(s.team));
    return Array.from(set).sort();
  }, [allShots]);

  useEffect(() => {
    if (!selectedTeam && teams.length) setSelectedTeam(teams[0]);
  }, [teams, selectedTeam]);

  // One row per match, ordered by date
  const chartData = useMemo(() => {
    if (!selectedTeam) return [];

    const byMatch = {};

    allShots
      .filter(s => (s.team || '').toLowerCase() === selectedTeam.toLowerCase())
      .forEach(s => {
        const key = `${getMatchTeams(s.gameName || '')}__${s.matchDate || ''}`;
        if (!byMatch[key]) {
          byMatch[key] = {
            matchDate: s.matchDate || null,
            label: s.matchDate
              ? new Date(s.matchDate).toLocaleDateString('en-IE', { day: '2-digit', month: 'short' })
              : getMatchTeams(s.gameName || 'Unknown'),
            opponent: getMatchTeams(s.gameName || ''),
            goals: 0, xGoals: 0, points: 0, xPoints: 0,
            twoPointers: 0, totalShots: 0, misses: 0,
          };
        }
        const r = byMatch[key];
        const act = (s.action || '').toString().toLowerCase().trim();

        const feats = _engineerFeatures(s);
        const dist = feats.Shot_Distance;
        const fromEndline = typeof s.x === 'number' ? Math.min(s.x, 145 - s.x) : 999;

        r.totalShots++;

        const isGoalAttempt = act.includes('goal');
        if (isGoalAttempt) {
          r.xGoals += calculateXG(s, null, calibrationModel) || 0;
        } else {
          const mult = (dist >= 40 && fromEndline >= ARC_CUTOFF &&
                        !act.includes('45') && !act.includes('fortyfive')) ? 2 : 1;
          r.xPoints += (calculateXP(s, null, calibrationModel) || 0) * mult;
        }

        const value = twoPointValue(act, dist, fromEndline);
        if (value === 3) r.goals++;
        else if (value === 2) { r.twoPointers++; r.points += 2; }
        else if (value === 1) r.points += 1;
        else r.misses++;
      });

    return Object.values(byMatch)
      .map(r => ({
        ...r,
        xGoals: Number(r.xGoals.toFixed(2)),
        xPoints: Number(r.xPoints.toFixed(2)),
        xScore: Number((r.xPoints + r.xGoals * 3).toFixed(2)),
        totalScore: r.goals * 3 + r.points,
      }))
      .sort((a, b) => {
        if (!a.matchDate) return 1;
        if (!b.matchDate) return -1;
        return new Date(a.matchDate) - new Date(b.matchDate);
      });
  }, [allShots, selectedTeam, calibrationModel]);

  const toggleMetric = (key) => {
    setActiveMetrics(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  if (loading) return (
    <div className="PageContainer">
      <div className="team-details-loading">
        <div className="team-details-spinner"></div>
        <p>Loading trend data...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="PageContainer">
      <div className="team-details-error">{error}</div>
    </div>
  );

  return (
    <div className="PageContainer">
      <h2 className="Title">{selectedTeam || 'Team'} — Trends by Match</h2>

      <div className="Section">
        <div className="FiltersContainer">
          <div>
            <label className="FilterLabel" htmlFor="teamSel">Team:</label>
            <select
              id="teamSel"
              className="Select"
              value={selectedTeam}
              onChange={e => setSelectedTeam(e.target.value)}
            >
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <button className="StyledButton" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label className="FilterLabel">Click on the Metrics to filter:</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
            {METRICS.map(m => {
              const on = activeMetrics.includes(m.key);
              return (
                <button
                  key={m.key}
                  onClick={() => toggleMetric(m.key)}
                  style={{
                    padding: '8px 14px',
                    minHeight: '40px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    color: on ? '#0F0A1B' : '#e0e0e0',
                    background: on ? m.colour : '#3a3a3a',
                    border: `2px solid ${m.colour}`,
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="Section">
        {chartData.length === 0 ? (
          <div className="team-details-error">No matches found for this team.</div>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="label" stroke="#b0b0b0" />
              <YAxis stroke="#b0b0b0" />
            <Tooltip
                contentStyle={{
                  background: '#2e2e2e',
                  border: '1px solid #9254de',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                labelFormatter={(label, payload) => {
                  const row = payload?.[0]?.payload;
                  const fixture = row?.opponent ? formatFixture(row.opponent) : '';
                  return fixture ? `${fixture} — ${label}` : label;
                }}
              />
              <Legend />
              {METRICS.filter(m => activeMetrics.includes(m.key)).map(m => (
                <Line
                  key={m.key}
                  type="monotone"
                  dataKey={m.key}
                  name={m.label}
                  stroke={m.colour}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}