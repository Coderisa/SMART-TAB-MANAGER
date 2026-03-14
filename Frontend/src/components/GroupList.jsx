// src/components/GroupList.jsx
import { useState, useEffect } from 'react';
import './GroupList.css';

const GroupList = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const groupList = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      // For each group, also fetch its tabs to get tab IDs for ungrouping
      const groupsWithTabs = await Promise.all(
        groupList.map(async (group) => {
          const tabs = await chrome.tabs.query({ groupId: group.id });
          return { ...group, tabs };
        })
      );
      setGroups(groupsWithTabs);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const ungroupGroup = async (groupId, tabIds) => {
    try {
      await chrome.tabs.ungroup(tabIds);
      await loadGroups(); // Refresh the list
    } catch (error) {
      console.error('Error ungrouping:', error);
    }
  };

  const ungroupAll = async () => {
    try {
      const allTabIds = groups.flatMap(g => g.tabs.map(t => t.id));
      if (allTabIds.length > 0) {
        await chrome.tabs.ungroup(allTabIds);
        await loadGroups();
      }
    } catch (error) {
      console.error('Error ungrouping all:', error);
    }
  };

  if (loading) return <div className="loading">Loading groups...</div>;

  return (
    <div className="group-list">
      <div className="group-actions">
        <h3>Tab Groups</h3>
        {groups.length > 0 && (
          <button onClick={ungroupAll} className="ungroup-all-btn">
            Ungroup All
          </button>
        )}
      </div>
      {groups.length === 0 ? (
        <p>No groups created yet.</p>
      ) : (
        groups.map(group => (
          <div key={group.id} className="group-item">
            <div className="group-header">
              <span className={`group-color-indicator ${group.color}`}></span>
              <span className="group-title">{group.title || 'Unnamed Group'}</span>
              <span className="group-count">({group.tabs.length} tabs)</span>
              <button
                onClick={() => ungroupGroup(group.id, group.tabs.map(t => t.id))}
                className="ungroup-btn"
                title="Ungroup this group"
              >
                Ungroup
              </button>
            </div>
            <div className="group-tabs">
              {group.tabs.map(tab => (
                <div key={tab.id} className="group-tab-item">
                  <img src={tab.favIconUrl || 'icons/default-favicon.png'} alt="" className="tab-favicon" />
                  <span className="tab-title">{tab.title || 'Untitled'}</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default GroupList;