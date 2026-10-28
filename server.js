const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB()
  .then(() => {
    console.log('MongoDB connection initialized successfully.');
  })
  .catch((err) => {
    console.warn('MongoDB connection note:', err.message);
  });

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Elegant Beauty API Server is running!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📊 Products API: http://localhost:${PORT}/api/products`);
  console.log(`📦 Orders API: http://localhost:${PORT}/api/orders`);
  console.log(`🚚 Courier API: http://localhost:${PORT}/api/courier`);
  console.log(`📈 Analytics API: http://localhost:${PORT}/api/analytics/dashboard`);
  console.log(`=========================================`);
});

