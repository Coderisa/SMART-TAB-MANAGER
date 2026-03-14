// src/components/TabList.jsx
import { useState } from 'react';
import './TabList.css';

const TabList = ({ tabs, onTabsUpdate }) => {
  const [grouping, setGrouping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const groupByDomain = async () => {
    setGrouping(true);
    try {
      const domainGroups = {};

      tabs.forEach(tab => {
        try {
          const url = new URL(tab.url);
          const domain = url.hostname;
          if (!domainGroups[domain]) domainGroups[domain] = [];
          domainGroups[domain].push(tab.id);
        } catch (e) {
          // Ignore invalid URLs
        }
      });

      for (const [domain, tabIds] of Object.entries(domainGroups)) {
        if (tabIds.length > 1) {
          const groupId = await chrome.tabs.group({ tabIds });
          await chrome.tabGroups.update(groupId, {
            title: domain,
            color: getRandomColor()
          });
        }
      }

      onTabsUpdate();
    } catch (error) {
      console.error('Error grouping tabs:', error);
    } finally {
      setGrouping(false);
    }
  };

  const closeInactiveTabs = async () => {
    const { tabActivity } = await chrome.storage.local.get('tabActivity');
    const now = Date.now();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

    const inactiveTabs = tabs.filter(tab => {
      const lastActive = tabActivity?.[tab.id] || now;
      return !tab.pinned && (now - lastActive) > inactiveThreshold;
    });

    for (const tab of inactiveTabs) {
      await chrome.tabs.remove(tab.id);
    }

    onTabsUpdate();
  };

  const getRandomColor = () => {
    const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // Filter tabs based on search query
  const filteredTabs = tabs.filter(tab =>
    tab.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tab.url?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="tab-list">
      <div className="tab-actions">
        <button
          onClick={groupByDomain}
          disabled={grouping}
          className="primary-btn"
        >
          {grouping ? 'Grouping...' : 'Auto-Group Tabs'}
        </button>
        <button onClick={closeInactiveTabs} className="secondary-btn">
          Close Inactive (30m)
        </button>
      </div>

      {/* Search input */}
      <input
        type="text"
        placeholder="🔍 Search tabs by title or URL..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="tab-search"
      />

      <div className="tabs-container">
        {filteredTabs.length === 0 ? (
          <p className="no-tabs">No tabs match your search.</p>
        ) : (
          filteredTabs.map(tab => (
            <TabItem key={tab.id} tab={tab} onClose={onTabsUpdate} />
          ))
        )}
      </div>
    </div>
  );
};

const TabItem = ({ tab, onClose }) => {
  const handleClose = async (e) => {
    e.stopPropagation();
    await chrome.tabs.remove(tab.id);
    onClose();
  };

  const handleActivate = async () => {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  };

  return (
    <div className="tab-item" onClick={handleActivate}>
      <img
        src={tab.favIconUrl || 'icons/default-favicon.png'}
        alt=""
        className="tab-favicon"
        onError={(e) => (e.target.src = 'icons/default-favicon.png')}
      />
      <div className="tab-info">
        <div className="tab-title">{tab.title || 'Untitled'}</div>
        <div className="tab-url">{new URL(tab.url).hostname}</div>
      </div>
      <button className="tab-close" onClick={handleClose}>
        ✕
      </button>
    </div>
  );
};

export default TabList;