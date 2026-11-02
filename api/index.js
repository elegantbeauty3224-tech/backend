const app = require('../app');
const connectDB = require('../config/db');

// In serverless Vercel environment, ensure DB connection is warm
let isConnected = false;

module.exports = async (req, res) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (origin !== '*') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Preflight fast-path: Return 200 immediately for OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!isConnected) {
    try {
      await connectDB();
      isConnected = true;
    } catch (err) {
      console.warn('Vercel Serverless DB Init:', err.message);
    }
  }
  return app(req, res);
};

