// server.js
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Determine if we're in production (Render sets NODE_ENV to 'production')
const isProduction = process.env.NODE_ENV === 'production';

// PostgreSQL connection pool – supports both DATABASE_URL (Render) and individual params (local)
const pool = new Pool(
  isProduction
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false // Required for Render's PostgreSQL
        }
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
      }
);

// ---------- Helper function to generate insights ----------
async function generateInsights(userId) {
  try {
    const peakHourQuery = `
      SELECT EXTRACT(HOUR FROM timestamp) as hour, COUNT(*) as activity
      FROM usage_stats
      WHERE user_id = $1 AND timestamp > NOW() - INTERVAL '30 days'
      GROUP BY hour
      ORDER BY activity DESC
      LIMIT 1
    `;
    const peakHour = await pool.query(peakHourQuery, [userId]);

    const activeDayQuery = `
      SELECT TO_CHAR(timestamp, 'Day') as day, COUNT(*) as activity
      FROM usage_stats
      WHERE user_id = $1 AND timestamp > NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY activity DESC
      LIMIT 1
    `;
    const activeDay = await pool.query(activeDayQuery, [userId]);

    const insights = {
      peakTime: peakHour.rows[0]?.hour + ':00' || 'N/A',
      mostActiveDay: activeDay.rows[0]?.day || 'N/A',
      topDomain: 'N/A',
      avgSessionDuration: 'N/A'
    };
    return insights;
  } catch (error) {
    console.error('Error generating insights:', error);
    return {
      peakTime: 'N/A',
      mostActiveDay: 'N/A',
      topDomain: 'N/A',
      avgSessionDuration: 'N/A'
    };
  }
}

// ---------- Existing endpoints (unchanged) ----------
app.post('/api/stats', async (req, res) => {
  const { userId, timestamp, stats } = req.body;
  try {
    const query = `
      INSERT INTO usage_stats 
      (user_id, timestamp, tab_count, window_count, grouped_tabs, pinned_tabs, activity_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING stat_id
    `;
    const values = [
      userId,
      timestamp,
      stats.tabCount || stats.totalTabs,
      stats.windowCount,
      stats.tabDetails?.filter(t => t.groupId).length || 0,
      stats.tabDetails?.filter(t => t.pinned).length || 0,
      JSON.stringify(stats.tabDetails || stats.activity)
    ];
    await pool.query(query, values);
    const insights = await generateInsights(userId);
    res.json({ success: true, insights });
  } catch (error) {
    console.error('Error saving stats:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/stats/batch', async (req, res) => {
  const { userId, timestamp, stats } = req.body;
  try {
    await pool.query(
      `INSERT INTO usage_stats (user_id, timestamp, tab_count, window_count, activity_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, timestamp, stats.tabCount, stats.windowCount, JSON.stringify(stats.activity)]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error in batch sync:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/stats/:userId/insights', async (req, res) => {
  const { userId } = req.params;
  try {
    const insights = await generateInsights(userId);
    res.json(insights);
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/sessions', async (req, res) => {
  const { userId, session } = req.body;
  try {
    await pool.query(
      `INSERT INTO sessions (user_id, session_name, tabs, total_tabs)
       VALUES ($1, $2, $3, $4)`,
      [userId, session.name, JSON.stringify(session.tabs), session.tabs.length]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving session:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// ---------- Focus endpoints ----------

app.get('/api/focus/goals/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    await pool.query(
      `INSERT INTO users (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    let result = await pool.query('SELECT * FROM user_goals WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) {
      result = await pool.query(
        `INSERT INTO user_goals (user_id, daily_target_minutes, distracting_sites)
         VALUES ($1, 120, ARRAY[]::TEXT[]) RETURNING *`,
        [userId]
      );
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in /api/focus/goals:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/focus/goals/:userId', async (req, res) => {
  const { userId } = req.params;
  const { daily_target_minutes, distracting_sites } = req.body;
  try {
    const result = await pool.query(
      `UPDATE user_goals
       SET daily_target_minutes = $2, distracting_sites = $3, updated_at = NOW()
       WHERE user_id = $1 RETURNING *`,
      [userId, daily_target_minutes, distracting_sites]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/focus/session/start', async (req, res) => {
  const { userId } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO focus_sessions (user_id, start_time) VALUES ($1, NOW()) RETURNING session_id',
      [userId]
    );
    res.json({ sessionId: result.rows[0].session_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/focus/session/end', async (req, res) => {
  const { sessionId } = req.body;
  try {
    const result = await pool.query(
      `UPDATE focus_sessions
       SET end_time = NOW(),
           duration_minutes = EXTRACT(EPOCH FROM (NOW() - start_time))/60,
           points_earned = FLOOR(EXTRACT(EPOCH FROM (NOW() - start_time))/60)
       WHERE session_id = $1 RETURNING *`,
      [sessionId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/focus/distraction', async (req, res) => {
  const { userId, siteDomain, overrodeReminder } = req.body;
  try {
    await pool.query(
      'INSERT INTO distraction_log (user_id, site_domain, overrode_reminder) VALUES ($1, $2, $3)',
      [userId, siteDomain, overrodeReminder]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/focus/leaderboard', async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  try {
    const result = await pool.query(
      `SELECT user_id, total_points, focus_days, active_today
       FROM leaderboard
       ORDER BY total_points DESC
       LIMIT $1`,
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/focus/progress/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const today = await pool.query(
      `SELECT COALESCE(SUM(duration_minutes), 0) as today_minutes
       FROM focus_sessions
       WHERE user_id = $1 AND DATE(start_time) = CURRENT_DATE`,
      [userId]
    );

    const streak = await pool.query(
      `WITH days AS (
          SELECT DISTINCT DATE(start_time) as day
          FROM focus_sessions
          WHERE user_id = $1
          ORDER BY day DESC
       )
       SELECT COUNT(*) as streak
       FROM days
       WHERE day > CURRENT_DATE - (SELECT COUNT(*) FROM days)::INTEGER`,
      [userId]
    );

    res.json({
      todayMinutes: today.rows[0].today_minutes,
      streak: streak.rows[0]?.streak || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/focus/personal-stats/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const totalPoints = await pool.query(
      `SELECT COALESCE(SUM(points_earned), 0) as total_points
       FROM focus_sessions
       WHERE user_id = $1`,
      [userId]
    );

    const streakResult = await pool.query(
      `WITH daily AS (
          SELECT DISTINCT DATE(start_time) as day
          FROM focus_sessions
          WHERE user_id = $1
      ),
      streaks AS (
          SELECT day, 
                 day - (ROW_NUMBER() OVER (ORDER BY day))::INTEGER as group_id
          FROM daily
      )
      SELECT COUNT(*) as streak_length
      FROM streaks
      GROUP BY group_id
      ORDER BY streak_length DESC
      LIMIT 1`,
      [userId]
    );
    const longestStreak = streakResult.rows.length > 0 ? streakResult.rows[0].streak_length : 0;

    const totalHours = await pool.query(
      `SELECT COALESCE(SUM(duration_minutes), 0) / 60.0 as total_hours
       FROM focus_sessions
       WHERE user_id = $1`,
      [userId]
    );

    res.json({
      totalPoints: totalPoints.rows[0].total_points,
      longestStreak: longestStreak,
      totalHours: Math.round(totalHours.rows[0].total_hours * 10) / 10
    });
  } catch (err) {
    console.error('Error in personal stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- Start server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});