const mongoose = require('mongoose');

let isConnecting = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (isConnecting) {
    return isConnecting;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/market_shop';

  isConnecting = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 10000,
    })
    .then((conn) => {
      isConnecting = null;
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    })
    .catch((err) => {
      isConnecting = null;
      console.error(`MongoDB Connection Error: ${err.message}`);
      throw err;
    });

  return isConnecting;
};

module.exports = connectDB;

