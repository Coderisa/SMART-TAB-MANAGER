import { useState, useEffect } from 'react';
import TabList from './components/TabList';
import GroupList from './components/GroupList';
import SessionList from './components/SessionList';
import StatsDashboard from './components/StatsDashboard';
import FocusDashboard from './components/FocusDashboard';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('open');
  const [tabs, setTabs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'open') loadTabs();
  }, [activeTab]);

  const loadTabs = async () => {
    setLoading(true);
    try {
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      setTabs(allTabs);
    } catch (error) {
      console.error('Error loading tabs:', error);
    } finally {
      setLoading(false);
    }
  };

  const closePopup = () => {
    window.close();
  };

  return (
    <div className="container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <h1>Smart Tab Manager</h1>
          <button onClick={closePopup} className="close-btn">✕</button>
        </div>
        <div className="tabs-nav">
          <button
            className={activeTab === 'open' ? 'active' : ''}
            onClick={() => setActiveTab('open')}
          >
            Open Tabs ({tabs.length})
          </button>
          <button
            className={activeTab === 'groups' ? 'active' : ''}
            onClick={() => setActiveTab('groups')}
          >
            Groups
          </button>
          <button
            className={activeTab === 'sessions' ? 'active' : ''}
            onClick={() => setActiveTab('sessions')}
          >
            Sessions
          </button>
          <button
            className={activeTab === 'stats' ? 'active' : ''}
            onClick={() => setActiveTab('stats')}
          >
            Stats
          </button>
          <button
            className={activeTab === 'focus' ? 'active' : ''}
            onClick={() => setActiveTab('focus')}
          >
            Focus
          </button>
        </div>
      </header>

      <main className="content">
        {loading && <div className="loader">Loading...</div>}

        {activeTab === 'open' && (
          <TabList tabs={tabs} onTabsUpdate={loadTabs} />
        )}

        {activeTab === 'groups' && <GroupList />}

        {activeTab === 'sessions' && <SessionList />}

        {activeTab === 'stats' && <StatsDashboard />}

        {activeTab === 'focus' && <FocusDashboard />}
      </main>
    </div>
  );
}

export default App;