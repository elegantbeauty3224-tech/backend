const app = require('../app');
const connectDB = require('../config/db');

// In serverless Vercel environment, ensure DB connection is warm
let isConnected = false;

const ALLOWED_ORIGINS = [
  'https://admin-one-nu-31.vercel.app',
  'https://admin-one-nu-31.vercel.app/',
  'https://www.elegant-beauty.xyz',
  'https://elegant-beauty.xyz',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
];

const checkOrigin = (origin) => {
  if (!origin) return 'https://admin-one-nu-31.vercel.app';
  const clean = origin.replace(/\/+$/, '');
  if (clean === 'https://admin-one-nu-31.vercel.app') return clean;
  if (ALLOWED_ORIGINS.some((o) => o.replace(/\/+$/, '') === clean)) return clean;
  if (/^https:\/\/([a-z0-9-]+)\.vercel\.app$/i.test(clean)) return clean;
  return clean;
};

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigin = checkOrigin(origin);

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

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
