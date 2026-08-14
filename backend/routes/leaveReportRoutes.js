const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { getLeaveReportData, getLeaveReportFilters, exportLeaveReportPdf } = require('../controllers/leaveReportController');

const router = express.Router();

router.use(authenticate);

// Leave report routes - restricted to CEO and IT Officer
router.get('/data', authorize('admin', 'ceo'), getLeaveReportData);
router.get('/filters', authorize('admin', 'ceo'), getLeaveReportFilters);
router.get('/export/pdf', authorize('admin', 'ceo'), exportLeaveReportPdf);

module.exports = router;
