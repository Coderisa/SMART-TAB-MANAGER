// src/components/SessionList.jsx
import { useState, useEffect } from 'react';
import './SessionList.css';

const SessionList = () => {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const { sessions } = await chrome.storage.local.get('sessions');
    setSessions(sessions || []);
  };

  const saveCurrentSession = async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const session = {
      id: Date.now().toString(),
      name: `Session ${new Date().toLocaleString()}`,
      tabs: tabs.map(t => ({ url: t.url, title: t.title, pinned: t.pinned })),
      created: new Date().toISOString()
    };
    const { sessions = [] } = await chrome.storage.local.get('sessions');
    sessions.push(session);
    await chrome.storage.local.set({ sessions });
    loadSessions();
  };

  const restoreSession = async (session) => {
    for (const tab of session.tabs) {
      await chrome.tabs.create({ url: tab.url, pinned: tab.pinned || false });
    }
  };

  const deleteSession = async (sessionId) => {
    const { sessions } = await chrome.storage.local.get('sessions');
    const updated = sessions.filter(s => s.id !== sessionId);
    await chrome.storage.local.set({ sessions: updated });
    loadSessions();
  };

  return (
    <div className="session-list">
      <button onClick={saveCurrentSession} className="primary-btn">
        Save Current Session
      </button>
      <div className="sessions">
        {sessions.length === 0 ? (
          <p>No saved sessions.</p>
        ) : (
          sessions.map(session => (
            <div key={session.id} className="session-item">
              <div>
                <strong>{session.name}</strong>
                <p>{session.tabs.length} tabs • {new Date(session.created).toLocaleDateString()}</p>
              </div>
              <div>
                <button onClick={() => restoreSession(session)}>Restore</button>
                <button onClick={() => deleteSession(session.id)}>Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SessionList;