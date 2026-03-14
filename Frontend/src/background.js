// src/background.js

let tabActivity = {};
let distractionTimer = {
  active: false,
  startTime: null,
  currentDomain: null,
  tabId: null,
  userId: null
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ tabActivity: {}, distractionStats: {} });
  setupAlarms();
  console.log('Extension installed, alarms set up');
});

function setupAlarms() {
  chrome.alarms.create('syncStats', { periodInMinutes: 60 });
  chrome.alarms.create('cleanupActivity', { periodInMinutes: 24 * 60 });
}

// Track tab activation to pause/resume distraction timer
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  tabActivity[activeInfo.tabId] = Date.now();
  chrome.storage.local.set({ tabActivity });

  // Handle distraction timer on tab switch
  handleTabSwitch(tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log('tabs.onUpdated fired:', { tabId, changeInfo, url: tab?.url });
  if (changeInfo.url) {
    console.log('URL changed to:', changeInfo.url);
    tabActivity[tabId] = Date.now();
    chrome.storage.local.set({ tabActivity });
    checkForDistraction({ ...tab, url: changeInfo.url });
    return;
  }
  if (changeInfo.status === 'complete') {
    console.log('Tab load complete, URL:', tab.url);
    tabActivity[tabId] = Date.now();
    chrome.storage.local.set({ tabActivity });
    checkForDistraction(tab);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabActivity[tabId];
  chrome.storage.local.set({ tabActivity });

  // If the closed tab was the one with active timer, stop it
  if (distractionTimer.tabId === tabId) {
    stopDistractionTimer();
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncStats') {
    syncStatsToBackend();
  } else if (alarm.name === 'cleanupActivity') {
    cleanupOldActivity();
  }
});

// ---------- Distraction Timer ----------

async function handleTabSwitch(tab) {
  if (!tab.url || !tab.url.startsWith('http')) return;

  const url = new URL(tab.url);
  const domain = url.hostname.replace(/^www\./, '');

  const { distractingSites, userId, isFocused } = await chrome.storage.local.get([
    'distractingSites', 'userId', 'isFocused'
  ]);

  if (!userId || !distractingSites || !isFocused) return;

  const isDistracting = distractingSites.some(site => domain.includes(site));

  if (isDistracting) {
    // Start timer if not already running on this domain/tab
    if (!distractionTimer.active || distractionTimer.currentDomain !== domain) {
      startDistractionTimer(tab.id, domain, userId);
    }
  } else {
    // Stop timer if it's running
    stopDistractionTimer();
  }
}

function startDistractionTimer(tabId, domain, userId) {
  if (distractionTimer.active) {
    // Save the elapsed time before switching
    saveDistractionTime();
  }
  distractionTimer = {
    active: true,
    startTime: Date.now(),
    currentDomain: domain,
    tabId: tabId,
    userId: userId
  };
  console.log('Distraction timer started for', domain);
}

function stopDistractionTimer() {
  if (distractionTimer.active) {
    saveDistractionTime();
    distractionTimer.active = false;
    console.log('Distraction timer stopped');
  }
}

async function saveDistractionTime() {
  if (!distractionTimer.active) return;

  const elapsedMinutes = (Date.now() - distractionTimer.startTime) / 60000; // minutes
  const rounded = Math.round(elapsedMinutes * 10) / 10; // round to 0.1 min

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const { distractionStats = {} } = await chrome.storage.local.get('distractionStats');
  if (!distractionStats[today]) {
    distractionStats[today] = {};
  }
  const domain = distractionTimer.currentDomain;
  distractionStats[today][domain] = (distractionStats[today][domain] || 0) + rounded;

  await chrome.storage.local.set({ distractionStats });
  console.log(`Added ${rounded} min to ${domain}`);
}

// ---------- Distraction Blocker (reminder) ----------

async function checkForDistraction(tab) {
  console.log('checkForDistraction called for tab:', tab.url);
  if (!tab.url || !tab.url.startsWith('http')) return;

  try {
    const url = new URL(tab.url);
    const domain = url.hostname.replace(/^www\./, '');

    const { distractingSites, userId, isFocused } = await chrome.storage.local.get([
      'distractingSites', 'userId', 'isFocused'
    ]);

    if (!userId || !distractingSites || !isFocused) return;

    const isDistracting = distractingSites.some(site => domain.includes(site));
    if (isDistracting) {
      // Also start timer if this is the active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.id === tab.id) {
        startDistractionTimer(tab.id, domain, userId);
      }
      // Inject reminder
      injectReminder(tab.id, domain, userId);
    }
  } catch (error) {
    console.error('Error in checkForDistraction:', error);
  }
}

// Inject the reminder as a function (no external file needed)
async function injectReminder(tabId, domain, userId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: reminderFunction,
      args: [domain, userId]
    });
    console.log('Reminder function injected, tab', tabId);
  } catch (err) {
    console.error('Failed to inject reminder function:', err);
  }
}

// This function will be stringified and injected into the page
function reminderFunction(domain, userId) {
  console.log('Reminder function running for', domain);

  // Avoid duplicate overlays
  if (document.getElementById('smart-tab-reminder')) return;

  let reminderShown = false;
  let timer = null;
  const THRESHOLD_SECONDS = 60;

  // Create the initial overlay
  const overlay = document.createElement('div');
  overlay.id = 'smart-tab-reminder';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #1a73e8;
    color: white;
    padding: 12px 20px;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 14px;
  `;
  overlay.innerHTML = `
    <span>⏳ <strong>Focus Mode Active</strong> – You're on <strong>${domain}</strong> (distracting site).</span>
    <div style="display: flex; align-items: center;">
      <button id="reminder-continue" style="margin-right: 8px; padding: 6px 12px; background: white; color: #1a73e8; border: none; border-radius: 4px; cursor: pointer;">Continue anyway</button>
      <button id="reminder-go-back" style="margin-right: 8px; padding: 6px 12px; background: transparent; color: white; border: 1px solid white; border-radius: 4px; cursor: pointer;">Go back</button>
      <button id="reminder-close" style="background: transparent; color: white; border: none; font-size: 18px; cursor: pointer; padding: 0 6px;">✕</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('reminder-continue').addEventListener('click', () => {
    chrome.runtime.sendMessage({
      action: 'distractionAction',
      userId: userId,
      domain: domain,
      actionType: 'continue'
    });
    overlay.remove();
    if (timer) clearInterval(timer);
  });

  document.getElementById('reminder-go-back').addEventListener('click', () => {
    chrome.runtime.sendMessage({
      action: 'distractionAction',
      userId: userId,
      domain: domain,
      actionType: 'goBack'
    });
    window.history.back();
    overlay.remove();
    if (timer) clearInterval(timer);
  });

  document.getElementById('reminder-close').addEventListener('click', () => {
    overlay.remove();
    if (timer) clearInterval(timer);
  });

  // Timer for second reminder
  timer = setInterval(() => {
    if (!reminderShown) {
      reminderShown = true;
      const secondOverlay = document.createElement('div');
      secondOverlay.id = 'smart-tab-second-reminder';
      secondOverlay.style.cssText = `
        position: fixed;
        top: 50px;
        left: 50%;
        transform: translateX(-50%);
        background: #ea4335;
        color: white;
        padding: 16px;
        border-radius: 8px;
        z-index: 10001;
        font-family: sans-serif;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        text-align: center;
      `;
      secondOverlay.innerHTML = `
        <strong>⚠️ You've been on ${domain} for over 1 minute!</strong><br>
        <button id="second-reminder-dismiss" style="margin-top: 8px; padding: 4px 12px; background: white; color: #ea4335; border: none; border-radius: 4px; cursor: pointer;">Got it</button>
      `;
      document.body.appendChild(secondOverlay);
      document.getElementById('second-reminder-dismiss').addEventListener('click', () => {
        secondOverlay.remove();
      });
    }
  }, THRESHOLD_SECONDS * 1000);

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (timer) clearInterval(timer);
  });
}

// Listen for messages from the injected script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);

  if (message.action === 'focusStarted') {
    console.log('Focus started message received, checking current tab');
    checkCurrentTabForDistraction();
  }

  if (message.action === 'distractionAction') {
    const { userId, domain, actionType } = message;
    fetch('http://localhost:3000/api/focus/distraction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        siteDomain: domain,
        overrodeReminder: actionType === 'continue'
      })
    }).catch(err => console.error('Failed to log distraction action', err));
  }
});

async function checkCurrentTabForDistraction() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      console.log('Checking current tab for distraction:', tab.url);
      checkForDistraction(tab);
    }
  } catch (err) {
    console.error('Error checking current tab:', err);
  }
}

// ---------- Fetch distracting sites ----------
async function fetchDistractingSites(userId) {
  try {
    const res = await fetch(`http://localhost:3000/api/focus/goals/${userId}`);
    const data = await res.json();
    if (data.distracting_sites) {
      await chrome.storage.local.set({ distractingSites: data.distracting_sites });
      console.log('Distracting sites updated:', data.distracting_sites);
    }
  } catch (err) {
    console.error('Failed to fetch distracting sites', err);
  }
}

chrome.storage.local.get('userId', ({ userId }) => {
  if (userId) fetchDistractingSites(userId);
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.userId && changes.userId.newValue) {
    fetchDistractingSites(changes.userId.newValue);
  }
});

// ---------- Sync and cleanup ----------
async function syncStatsToBackend() {
  try {
    const { userId } = await chrome.storage.local.get('userId');
    if (!userId) return;

    const tabs = await chrome.tabs.query({});
    const windows = await chrome.windows.getAll();

    await fetch('http://localhost:3000/api/stats/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        timestamp: new Date().toISOString(),
        stats: {
          tabCount: tabs.length,
          windowCount: windows.length,
          activity: tabActivity
        }
      })
    });
    console.log('Stats synced to backend');
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

function cleanupOldActivity() {
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  Object.keys(tabActivity).forEach(tabId => {
    if (tabActivity[tabId] < oneWeekAgo) {
      delete tabActivity[tabId];
    }
  });
  chrome.storage.local.set({ tabActivity });
}