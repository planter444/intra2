const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const hashPassword = async (plainPassword) => bcrypt.hash(plainPassword, 10);

const comparePassword = async (plainPassword, passwordHash) => bcrypt.compare(plainPassword, passwordHash);

const signToken = (user) => jwt.sign(
  {
    sub: user.id,
    role: user.role,
    email: user.email
  },
  env.jwtSecret,
  { expiresIn: env.jwtExpiresIn }
);

const signPasswordResetToken = (user) => jwt.sign(
  {
    sub: user.id,
    email: user.email,
    purpose: 'password_reset'
  },
  env.jwtSecret,
  { expiresIn: env.resetTokenExpiresIn }
);

const verifyPasswordResetToken = (token) => jwt.verify(token, env.jwtSecret);

module.exports = {
  hashPassword,
  comparePassword,
  signToken,
  signPasswordResetToken,
  verifyPasswordResetToken
};
