# Smart Tab Manager – Chrome Extension with Distraction Blocker

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)

A full‑stack Chrome extension that helps you organise your tabs and gently discourages distraction. It includes:

- **Tab Manager**: auto‑group tabs by domain, close inactive tabs, save/restore sessions.
- **Distraction Blocker**: during a focus session, visiting distracting sites (e.g., YouTube) shows a gentle reminder; time spent on distracting sites is tracked daily.
- **Focus Statistics**: view your daily wasted time, longest streak, and earned badges.
- **Local First**: all data is stored in your browser by default; optional cloud sync can be enabled by running your own backend.

---

## 🎥 Demo Video

[Click here to watch a short demo](https://drive.google.com/file/d/1HYYMVry0qyrv2xi5bZ8Mm8qvIHK0CpOV/view?usp=sharing) (2–3 minutes) showing the extension in action.

---

## 🛠️ Tech Stack

- **Frontend**: React, Chrome Extensions API (Manifest V3), Vite, CRXJS
- **Backend**: Node.js, Express, PostgreSQL, `pg`
- **Database**: PostgreSQL (schema provided in `Backend/database.sql`)

---

## 📁 Repository Structure

SMART-TAB-MANAGER/
├── Backend/ # Node.js + Express server
│ ├── server.js # main API
│ ├── database.sql # PostgreSQL schema (tables)
│ ├── .env.example # environment variables template
│ └── package.json
├── Frontend/ # React Chrome extension
│ ├── public/
│ ├── src/
│ ├── manifest.json
│ ├── package.json
│ └── vite.config.js
└── README.md



---

## 🔧 Installation & Setup (for local development)

### Prerequisites

- Node.js (v16 or later)
- PostgreSQL (installed locally or a cloud instance like [Neon](https://neon.tech))
- Chrome browser

### 1. Clone the Repository


git clone https://github.com/Coderisa/SMART-TAB-MANAGER.git
cd SMART-TAB-MANAGER
2. Set Up the Backend
bash
cd Backend
npm install
Database Setup
The database schema is provided in Backend/database.sql. You need to create a PostgreSQL database and run this script.

Option A – Local PostgreSQL

Install PostgreSQL and create a database (e.g., smart_tab_manager).
Run the schema file to create all tables:
bash
psql -U your_user -d smart_tab_manager -f database.sql
Option B – Cloud (Neon)

Create a free PostgreSQL instance on Neon.
Copy the connection string (e.g., postgresql://user:password@host/dbname).
You can use this string in the environment variable DATABASE_URL (see next step).
Environment Variables
Copy .env.example to .env and fill in your database credentials:

env
# For local PostgreSQL with individual credentials
DB_USER=your_user
DB_HOST=localhost
DB_NAME=smart_tab_manager
DB_PASSWORD=your_password
DB_PORT=5432

# OR if you prefer a single DATABASE_URL (uncomment and comment the above)
# DATABASE_URL=postgresql://user:password@host:port/dbname
The backend is configured to work with either method.

Start the Backend Server

npm run dev   # runs with nodemon for development
# or
npm start     # runs with node (production)
The server will start on http://localhost:3000. You should see Backend running on port 3000.

3. Set Up the Frontend (Chrome Extension)
Open a new terminal and navigate to the Frontend folder:

bash
cd ../Frontend
npm install   # or yarn
Update the Backend URL
In the frontend code, the extension makes fetch calls to the backend. By default, it points to http://localhost:3000. If you changed the port or want to use a remote backend, update the URLs in files like background.js, FocusDashboard.jsx, StatsDashboard.jsx etc.

For local development, leave them as http://localhost:3000.

Build the Extension

npm run build   # or yarn build
This creates a dist folder with the production‑ready extension.

Load the Extension in Chrome
Open Chrome and go to chrome://extensions/.

Enable Developer mode (toggle in the top‑right corner).

Click Load unpacked and select the Frontend/dist folder.

The Smart Tab Manager icon will appear in the toolbar. Click it to open the popup.

🎯 How to Use the Extension
Open Tabs tab – see all open tabs, auto‑group them by domain, or close inactive tabs.

Groups tab – view and ungroup existing tab groups.

Sessions tab – save the current set of tabs as a session, restore or delete saved sessions.

Stats tab – view local statistics and optionally sync them to your backend (if running).

Focus tab – set your daily wasted‑time limit and list distracting sites. Start a focus session; the timer will only run when you're on distracting sites. After ending the session, your daily wasted time and achievements update.

🗄️ Database Schema
The file Backend/database.sql contains all the CREATE TABLE statements and the leaderboard view. Running it on any PostgreSQL instance will create the exact database structure used by this project. The tables include:

users

user_goals

focus_sessions

distraction_log

rewards

usage_stats

sessions

The schema is self‑contained – no external data is required. Anyone cloning the repo can run it to set up their own database.

❓ Frequently Asked Questions
Q: How do others get the PostgreSQL code?
A: It's included right in the repository as Backend/database.sql. Anyone who clones the project can run that script on their own PostgreSQL instance to create all the necessary tables.

Q: Can I use the extension without running a backend?
A: Yes! The extension works fully offline. Tab management, session saving, and even the distraction timer (which stores data in Chrome's local storage) do not require a backend. The cloud sync feature is optional.

Q: Why isn't there a live deployed version?
A: The backend can be deployed to platforms like Render, but for this project we focus on local development. A demo video is provided to show the working features. If you'd like to deploy your own copy, follow the instructions above – it's easy to set up locally.

Q: How do I reset my data?
A: For the extension, you can clear Chrome storage via chrome://extensions/ → click "Details" on the extension → "Extension options" (if any) or use the "Clear storage" button in the developer tools. For the database, you can drop and recreate tables using the database.sql script.

📄 License
MIT

🙌 Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

This README covers everything: the video link, local setup, database access, and answers the key question about PostgreSQL. Just replace `your-video-link-here` with your actual video URL.
