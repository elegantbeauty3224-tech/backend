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

const app = express();

// Security: Hide backend signature
app.disable('x-powered-by');

// Security Headers Middleware (Nosniff, X-Frame-Options, XSS Protection, Referrer Policy)
// NOTE: STRICTLY NO RATE LIMITING AS SPECIFIED BY USER
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Middlewares
app.use(cors({
  origin: '*', // Allows Vercel frontend, local dev, or any domain
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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
