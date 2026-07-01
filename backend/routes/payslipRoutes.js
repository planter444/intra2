const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { generatePayslip } = require('../controllers/payslipController');

const router = express.Router();

router.get('/generate/:id', authenticate, authorize('admin', 'ceo', 'finance'), generatePayslip);

module.exports = router;
