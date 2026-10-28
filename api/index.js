const app = require('../app');
const connectDB = require('../config/db');

// In serverless Vercel environment, ensure DB connection is warm
let isConnected = false;

module.exports = async (req, res) => {
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

