// src/components/FocusDashboard.jsx
import { useState, useEffect } from 'react';
import './FocusDashboard.css';

const FocusDashboard = () => {
  const [userId, setUserId] = useState(null);
  const [goals, setGoals] = useState(null);
  const [distractionStats, setDistractionStats] = useState({});
  const [todayTotal, setTodayTotal] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [editing, setEditing] = useState(false);
  const [distractingSitesInput, setDistractingSitesInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserId();
  }, []);

  useEffect(() => {
    if (userId) {
      loadGoals();
      loadDistractionStats();
      loadFocusState();
    }
  }, [userId]);

  const loadUserId = async () => {
    const { userId } = await chrome.storage.local.get('userId');
    setUserId(userId);
  };

  const loadFocusState = async () => {
    const { isFocused } = await chrome.storage.local.get('isFocused');
    setIsFocused(!!isFocused);
  };

  const loadGoals = async () => {
    try {
      const res = await fetch(`http://localhost:3000/api/focus/goals/${userId}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setGoals(data);
      setDistractingSitesInput(data.distracting_sites?.join('\n') || '');
    } catch (err) {
      console.error('Failed to load goals', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDistractionStats = async () => {
    const { distractionStats = {} } = await chrome.storage.local.get('distractionStats');
    setDistractionStats(distractionStats);
    const today = new Date().toISOString().split('T')[0];
    const todayStats = distractionStats[today] || {};
    const total = Object.values(todayStats).reduce((sum, val) => sum + val, 0);
    setTodayTotal(Math.round(total * 10) / 10);
  };

  const saveGoals = async () => {
    const sites = distractingSitesInput.split('\n').map(s => s.trim()).filter(s => s);
    try {
      const res = await fetch(`http://localhost:3000/api/focus/goals/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daily_target_minutes: goals.daily_target_minutes,
          distracting_sites: sites
        })
      });
      if (res.ok) {
        setEditing(false);
        await loadGoals();
        await chrome.storage.local.set({ distractingSites: sites });
      }
    } catch (err) {
      console.error('Failed to save goals', err);
    }
  };

  const startFocus = async () => {
    await chrome.storage.local.set({ isFocused: true });
    setIsFocused(true);
    chrome.runtime.sendMessage({ action: 'focusStarted' });
  };

  const endFocus = async () => {
    await chrome.storage.local.set({ isFocused: false });
    setIsFocused(false);
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!goals) return <div className="error">No goals data.</div>;

  const dailyTarget = goals.daily_target_minutes ?? 30;
  const progressPercent = Math.min(100, Math.round((todayTotal / dailyTarget) * 100));

  return (
    <div className="focus-dashboard">
      <div className="focus-header">
        <h2>Distraction Tracker</h2>
        <button onClick={() => setEditing(!editing)} className="edit-btn">
          {editing ? 'Cancel' : 'Edit Goals'}
        </button>
      </div>

      {editing ? (
        <div className="edit-goals">
          <label>
            Daily Wasted Limit (minutes):
            <input
              type="number"
              value={dailyTarget}
              onChange={(e) => setGoals({...goals, daily_target_minutes: e.target.value})}
            />
          </label>
          <label>
            Distracting Sites (one per line):
            <textarea
              rows="4"
              value={distractingSitesInput}
              onChange={(e) => setDistractingSitesInput(e.target.value)}
              placeholder="youtube.com&#10;facebook.com&#10;twitter.com"
            />
          </label>
          <button onClick={saveGoals} className="save-btn">Save Goals</button>
        </div>
      ) : (
        <div className="focus-info">
          <p><strong>Daily Limit:</strong> {dailyTarget} minutes</p>
          <p><strong>Today's Wasted:</strong> {todayTotal} / {dailyTarget} min</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <div className="focus-actions">
            {!isFocused ? (
              <button onClick={startFocus} className="start-focus">Start Tracking</button>
            ) : (
              <button onClick={endFocus} className="end-focus">Stop Tracking</button>
            )}
          </div>
        </div>
      )}

      <div className="distraction-breakdown">
        <h3>📊 Today's Breakdown</h3>
        {Object.entries(distractionStats[new Date().toISOString().split('T')[0]] || {}).length === 0 ? (
          <p>No distractions recorded today.</p>
        ) : (
          Object.entries(distractionStats[new Date().toISOString().split('T')[0]]).map(([site, minutes]) => (
            <div key={site} className="breakdown-item">
              <span>{site}</span>
              <span>{minutes} min</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FocusDashboard;