const express = require('express');
const { getDashboardSummary } = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/summary', authenticate, getDashboardSummary);

module.exports = router;
