const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config(); // Fallback to root directory .env if present

const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const configRoutes = require('./routes/configRoutes');
const courierRoutes = require('./routes/courierRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();

// Security: Hide backend signature
app.disable('x-powered-by');

const ALLOWED_ORIGINS = [
  'https://admin-one-nu-31.vercel.app',
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

// 1. HIGHEST PRIORITY: CORS & Preflight handling for Vercel, Admin, and Frontend
app.use((req, res, next) => {
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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Cache-Control',
      'Pragma',
    ],
  })
);

// 2. Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Increase body parser limit for base64 image uploads to ImgBB
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// NoSQL Injection Prevention: Sanitize keys starting with '$' or containing '.'
function sanitizeNoSql(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeNoSql(obj[key]);
    }
  }
}

app.use((req, res, next) => {
  if (req.body) sanitizeNoSql(req.body);
  if (req.query) sanitizeNoSql(req.query);
  if (req.params) sanitizeNoSql(req.params);
  next();
});

// Serve locally uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check and root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Elegant Beauty E-Commerce API',
    endpoints: {
      products: '/api/products',
      orders: '/api/orders',
      analytics: '/api/analytics/dashboard',
      upload: '/api/upload/imgbb'
    },
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Mount Routes
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/config', configRoutes);
app.use('/api/courier', courierRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/webhook', webhookRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Not Found - ${req.originalUrl}`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('API Error:', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

module.exports = app;
