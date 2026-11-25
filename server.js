const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// IN-MEMORY STORE
// ============================================
const locations = {}; // { token: { lat, lon, address, active, created, expires } }

// ============================================
// HELPERS
// ============================================
function generateToken() {
  return Math.random().toString(36).substring(2, 11); // 9 random base36 chars
}

function isExpired(tokenData) {
  return Date.now() > tokenData.expires;
}

function cleanupExpired() {
  const now = Date.now();
  for (const token of Object.keys(locations)) {
    if (now > locations[token].expires) {
      locations[token].active = false;
    }
  }
}

// Auto-cleanup every hour
setInterval(cleanupExpired, 60 * 60 * 1000);

// ============================================
// MIDDLEWARE & STATIC FILES
// ============================================
app.use(express.json());
app.use(express.static(__dirname)); // Serve share.html and static files
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ============================================
// API ENDPOINTS
// ============================================

// Base API route info
app.get('/api', (req, res) => {
  res.json({
    status: 'Gifter API active',
    endpoints: {
      share: 'POST /api/share/:token',
      location: 'GET /api/location/:token',
      stop: 'POST /api/stop/:token'
    }
  });
});

// Health check - returns JSON info
app.get('/health', (req, res) => {
  const activeCount = Object.values(locations).filter(l => l.active && !isExpired(l)).length;
  res.json({
    status: 'Gifter backend running',
    activeTokens: activeCount,
    timestamp: new Date().toISOString()
  });
});

// Serve index.html at root and /api
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// POST /api/share/:token - Receive location from friend
app.post('/api/share/:token?', (req, res) => {
  const token = req.params.token || generateToken();
  const { lat, lon, address } = req.body;

  if (lat === undefined || lon === undefined) {
    return res.status(400).json({ error: 'lat and lon required' });
  }

  const now = Date.now();
  const expires = now + 24 * 60 * 60 * 1000; // 24 hours

  // If token exists and is active, update it; otherwise create new
  const existing = locations[token];
  if (existing && existing.active && !isExpired(existing)) {
    locations[token] = {
      ...existing,
      lat,
      lon,
      address: address || existing.address,
      received: now
    };
  } else {
    locations[token] = {
      token,
      lat,
      lon,
      address: address || '',
      active: true,
      created: now,
      expires,
      received: now
    };
  }

  res.json({ status: 'ok', token });
});

// GET /api/location/:token - Sender polls for friend's location
app.get('/api/location/:token', (req, res) => {
  const { token } = req.params;
  const data = locations[token];

  if (!data) {
    return res.status(404).json({ error: 'Token not found or expired' });
  }

  if (isExpired(data)) {
    data.active = false;
    return res.status(410).json({ error: 'Sharing ended' });
  }

  if (!data.active) {
    return res.status(410).json({ error: 'Sharing ended' });
  }

  res.json({
    token: data.token,
    address: data.address,
    lat: data.lat,
    lon: data.lon,
    expires: new Date(data.expires).toISOString(),
    received: new Date(data.received).toISOString()
  });
});

// POST /api/stop/:token - Manual revocation
app.post('/api/stop/:token', (req, res) => {
  const { token } = req.params;
  const data = locations[token];

  if (!data) {
    return res.status(404).json({ error: 'Token not found or expired' });
  }

  data.active = false;
  res.json({ status: 'stopped' });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`Gifter backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
  console.log(`API base: http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  process.exit(0);
});