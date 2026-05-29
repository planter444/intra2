const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const { generatePayslip } = require('../controllers/payslipController');

const router = express.Router();

router.get('/generate/:id', authenticateToken, authorizeRoles(['admin', 'ceo', 'finance']), generatePayslip);

module.exports = router;
