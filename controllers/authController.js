const Admin = require('../models/Admin');
const connectDB = require('../config/db');
const { signToken, verifyToken, hashPassword, verifyPassword } = require('../utils/authUtils');

// In-memory rate limiter for brute-force protection (keyed by IP)
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
};

const isRateLimited = (ip) => {
  const record = loginAttempts.get(ip);
  if (!record) return false;
  if (Date.now() - record.lastAttempt > LOCKOUT_DURATION_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
};

const recordFailedAttempt = (ip) => {
  const record = loginAttempts.get(ip) || { count: 0, lastAttempt: Date.now() };
  record.count += 1;
  record.lastAttempt = Date.now();
  loginAttempts.set(ip, record);
  return record.count;
};

const resetAttempts = (ip) => {
  loginAttempts.delete(ip);
};

// Ensure default admin exists in database
async function getOrInitAdmin(targetUsername) {
  const defaultUser = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const defaultPass = (process.env.ADMIN_PASSWORD || 'admin@beauty2026').trim();

  let admin = await Admin.findOne({ username: targetUsername });
  if (!admin && targetUsername === defaultUser) {
    // Check if any admin exists
    const anyAdmin = await Admin.countDocuments();
    if (anyAdmin === 0) {
      const { salt, hash } = hashPassword(defaultPass);
      admin = await Admin.create({
        username: defaultUser,
        passwordHash: hash,
        salt,
        role: 'admin',
      });
      console.log(`[AUTH] Initialized default admin account: "${defaultUser}"`);
    }
  }
  return admin;
}

// @desc    Admin Login
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  const clientIp = getClientIp(req);

  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      success: false,
      message: 'অতিরিক্ত ভুল চেষ্টা করা হয়েছে। নিরাপত্তার স্বার্থে ১৫ মিনিট পর পুনরায় চেষ্টা করুন।',
    });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'ইউজারনেম এবং পাসওয়ার্ড প্রদান করা আবশ্যক।',
    });
  }

  const cleanUser = String(username).trim().toLowerCase();
  const cleanPass = String(password).trim();

  try {
    try {
      await connectDB();
    } catch (err) {
      console.warn('DB Connection error during login:', err.message);
    }

    let admin = null;
    try {
      admin = await getOrInitAdmin(cleanUser);
    } catch (err) {
      console.warn('Admin fetch error:', err.message);
    }

    let isValid = false;

    if (admin && admin.passwordHash && admin.salt) {
      isValid = verifyPassword(cleanPass, admin.passwordHash, admin.salt);
    } else {
      // Fallback against configured environment or default credentials if DB is cold
      const envUser = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
      const envPass = (process.env.ADMIN_PASSWORD || 'admin@beauty2026').trim();
      if (cleanUser === envUser && cleanPass === envPass) {
        isValid = true;
      }
    }

    if (!isValid) {
      const currentAttempts = recordFailedAttempt(clientIp);
      const remaining = Math.max(0, MAX_ATTEMPTS - currentAttempts);
      return res.status(401).json({
        success: false,
        message:
          remaining > 0
            ? `ভুল ইউজারনেম বা পাসওয়ার্ড। বাকি প্রচেষ্টা: ${remaining} বার।`
            : 'অতিরিক্ত ভুল চেষ্টা করা হয়েছে। নিরাপত্তার স্বার্থে ১৫ মিনিট পর পুনরায় চেষ্টা করুন।',
      });
    }

    // Success: Reset rate limit
    resetAttempts(clientIp);

    // Update last login timestamp if admin doc exists
    if (admin && admin._id) {
      admin.lastLogin = new Date();
      await admin.save().catch(() => {});
    }

    const token = signToken({
      username: cleanUser,
      role: admin?.role || 'admin',
    });

    return res.status(200).json({
      success: true,
      message: 'লগইন সফল হয়েছে।',
      token,
      user: {
        username: cleanUser,
        role: admin?.role || 'admin',
      },
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({
      success: false,
      message: 'সার্ভারে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।',
    });
  }
};

// @desc    Verify Admin Session Token
// @route   GET /api/auth/verify
exports.verify = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      valid: false,
      message: 'অথেনটিকেশন টোকেন প্রদান করা হয়নি।',
    });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      success: false,
      valid: false,
      message: 'টোকেনের মেয়াদ শেষ বা অবৈধ। দয়া করে পুনরায় লগইন করুন।',
    });
  }

  return res.status(200).json({
    success: true,
    valid: true,
    user: {
      username: payload.username,
      role: payload.role || 'admin',
    },
  });
};

// @desc    Change Admin Password
// @route   POST /api/auth/change-password
exports.changePassword = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'অনুমতি নেই।',
    });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload || !payload.username) {
    return res.status(401).json({
      success: false,
      message: 'সেশনের মেয়াদ শেষ হয়ে গেছে।',
    });
  }

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'বর্তমান পাসওয়ার্ড এবং নতুন পাসওয়ার্ড উভয়ই প্রদান করুন।',
    });
  }

  if (String(newPassword).trim().length < 6) {
    return res.status(400).json({
      success: false,
      message: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।',
    });
  }

  try {
    await connectDB();
    const admin = await getOrInitAdmin(payload.username);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'অ্যাডমিন অ্যাকাউন্ট পাওয়া যায়নি।',
      });
    }

    const isMatch = verifyPassword(String(currentPassword).trim(), admin.passwordHash, admin.salt);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'বর্তমান পাসওয়ার্ড সঠিক নয়।',
      });
    }

    const { salt, hash } = hashPassword(String(newPassword).trim());
    admin.passwordHash = hash;
    admin.salt = salt;
    await admin.save();

    return res.status(200).json({
      success: true,
      message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে।',
    });
  } catch (error) {
    console.error('Change Password Error:', error);
    return res.status(500).json({
      success: false,
      message: 'পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে।',
    });
  }
};

