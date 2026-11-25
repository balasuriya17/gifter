// Netlify Function: stop.js
// Handles POST /api/stop/:token - Manual revocation

// Use the same in-memory store (note: separate process, but OK for demo)
// In production, use Redis/MongoDB/SQLite
const locations = {};

function setCorsHeaders(response) {
  response.headers = response.headers || {};
  response.headers['Access-Control-Allow-Origin'] = '*';
  response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
  response.headers['Access-Control-Allow-Headers'] = 'Content-Type';
  return response;
}

exports.handler = async function(event, context) {
  const method = event.httpMethod;
  const path = event.path.replace('/.netlify/functions/stop', '');
  const token = path.split('/').filter(Boolean).pop();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return setCorsHeaders({ statusCode: 200, body: '' });
  }

  // POST /api/stop/:token
  if (method === 'POST' && token) {
    const data = locations[token];

    if (!data) {
      return setCorsHeaders({
        statusCode: 404,
        body: JSON.stringify({ error: 'Token not found or expired' })
      });
    }

    data.active = false;

    return setCorsHeaders({
      statusCode: 200,
      body: JSON.stringify({ status: 'stopped' })
    });
  }

  return setCorsHeaders({
    statusCode: 404,
    body: JSON.stringify({ error: 'Not found' })
  });
};