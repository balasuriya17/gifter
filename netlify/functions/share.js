// Netlify Function: share.js
// Handles POST /api/share/:token and GET /api/location/:token

// In-memory store (note: resets on cold starts in serverless)
const locations = {};

function generateToken() {
  return Math.random().toString(36).substring(2, 11); // 9 random base36 chars
}

function isExpired(tokenData) {
  return Date.now() > tokenData.expires;
}

function setCorsHeaders(response) {
  response.headers = response.headers || {};
  response.headers['Access-Control-Allow-Origin'] = '*';
  response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
  response.headers['Access-Control-Allow-Headers'] = 'Content-Type';
  return response;
}

exports.handler = async function(event, context) {
  const path = event.path.replace('/.netlify/functions/share', '');
  const method = event.httpMethod;
  const token = path.split('/').filter(Boolean).pop() || null;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return setCorsHeaders({ statusCode: 200, body: '' });
  }

  // POST /api/share/:token? - Receive location from friend
  if (method === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { lat, lon, address } = body;

      if (lat === undefined || lon === undefined) {
        return setCorsHeaders({
          statusCode: 400,
          body: JSON.stringify({ error: 'lat and lon required' })
        });
      }

      const targetToken = token || generateToken();
      const now = Date.now();
      const expires = now + 24 * 60 * 60 * 1000; // 24 hours

      const existing = locations[targetToken];
      if (existing && existing.active && !isExpired(existing)) {
        locations[targetToken] = {
          ...existing,
          lat,
          lon,
          address: address || existing.address,
          received: now
        };
      } else {
        locations[targetToken] = {
          token: targetToken,
          lat,
          lon,
          address: address || '',
          active: true,
          created: now,
          expires,
          received: now
        };
      }

      return setCorsHeaders({
        statusCode: 200,
        body: JSON.stringify({ status: 'ok', token: targetToken })
      });
    } catch (err) {
      return setCorsHeaders({
        statusCode: 500,
        body: JSON.stringify({ error: 'Invalid request' })
      });
    }
  }

  // GET /api/location/:token - Sender polls for friend's location
  if (method === 'GET' && token) {
    const data = locations[token];

    if (!data) {
      return setCorsHeaders({
        statusCode: 404,
        body: JSON.stringify({ error: 'Token not found or expired' })
      });
    }

    if (isExpired(data)) {
      data.active = false;
      return setCorsHeaders({
        statusCode: 410,
        body: JSON.stringify({ error: 'Sharing ended' })
      });
    }

    if (!data.active) {
      return setCorsHeaders({
        statusCode: 410,
        body: JSON.stringify({ error: 'Sharing ended' })
      });
    }

    return setCorsHeaders({
      statusCode: 200,
      body: JSON.stringify({
        token: data.token,
        address: data.address,
        lat: data.lat,
        lon: data.lon,
        expires: new Date(data.expires).toISOString(),
        received: new Date(data.received).toISOString()
      })
    });
  }

  return setCorsHeaders({
    statusCode: 404,
    body: JSON.stringify({ error: 'Not found' })
  });
};