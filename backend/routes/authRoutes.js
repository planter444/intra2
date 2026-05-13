const express = require('express');
const { forgotPassword, login, me, resetPassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/forgot-password', forgotPassword);
router.post('/login', login);
router.post('/reset-password', resetPassword);
router.get('/me', authenticate, me);

module.exports = router;
