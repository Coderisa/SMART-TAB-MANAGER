// src/components/StatsDashboard.jsx
import { useState, useEffect } from 'react';
import './StatsDashboard.css';

const StatsDashboard = () => {
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    loadLocalStats();
    getUserId();
  }, []);

  const getUserId = async () => {
    const { userId } = await chrome.storage.local.get('userId');
    if (!userId) {
      const newUserId = 'user_' + Math.random().toString(36).substr(2, 9);
      await chrome.storage.local.set({ userId: newUserId });
      setUserId(newUserId);
    } else {
      setUserId(userId);
    }
  };

  const loadLocalStats = async () => {
    const tabs = await chrome.tabs.query({});
    const windows = await chrome.windows.getAll();

    setStats({
      totalTabs: tabs.length,
      totalWindows: windows.length,
      pinnedTabs: tabs.filter(t => t.pinned).length,
      groupedTabs: tabs.filter(t => t.groupId).length,
      lastUpdated: new Date().toLocaleString()
    });
  };

  const syncToBackend = async () => {
    setSyncing(true);
    try {
      const tabs = await chrome.tabs.query({});
      const { tabActivity } = await chrome.storage.local.get('tabActivity');

      const response = await fetch('http://localhost:3000/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          timestamp: new Date().toISOString(),
          stats: {
            tabCount: tabs.length,
            windowCount: (await chrome.windows.getAll()).length,
            tabDetails: tabs.map(t => ({
              url: t.url,
              title: t.title,
              pinned: t.pinned,
              groupId: t.groupId,
              lastAccessed: tabActivity?.[t.id] || Date.now()
            }))
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights);
        alert('Stats synced successfully!');
      }
    } catch (error) {
      console.error('Error syncing to backend:', error);
      alert('Error syncing. Make sure backend is running.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="stats-dashboard">
      <div className="stats-header">
        <h2>Usage Statistics</h2>
        <button onClick={syncToBackend} disabled={syncing} className="sync-btn">
          {syncing ? 'Syncing...' : 'Sync to Cloud'}
        </button>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalTabs}</div>
            <div className="stat-label">Total Tabs</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalWindows}</div>
            <div className="stat-label">Windows</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.pinnedTabs}</div>
            <div className="stat-label">Pinned</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.groupedTabs}</div>
            <div className="stat-label">Grouped</div>
          </div>
        </div>
      )}

      {insights && (
        <div className="insights-section">
          <h3>📊 Cloud Insights</h3>
          <div className="insights-content">
            <p>⏰ Peak browsing time: {insights.peakTime}</p>
            <p>📈 Most active day: {insights.mostActiveDay}</p>
            <p>🔥 Top domain: {insights.topDomain}</p>
            <p>⏱️ Avg session: {insights.avgSessionDuration}</p>
          </div>
        </div>
      )}

      <div className="local-note">
        <small>Data stored locally. Sync for cross-device insights.</small>
      </div>
    </div>
  );
};

export default StatsDashboard;