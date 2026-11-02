const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    salt: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: 'admin',
    },
    lastLogin: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
