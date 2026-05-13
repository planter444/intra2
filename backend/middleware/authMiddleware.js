const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userModel = require('../models/userModel');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (typeof req.query.token === 'string' ? req.query.token : null);

    if (!token) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    const payload = jwt.verify(token, env.jwtSecret);
    const user = await userModel.findById(payload.sub);

    if (!user || user.isDeleted || !user.isActive) {
      return res.status(401).json({ message: 'Your account is inactive or no longer available.' });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticate
};
