const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
  getTravelReportFilters,
  getTravelReportData,
  exportTravelReportPdf
} = require('../controllers/travelReportController');

const router = express.Router();

router.use(authenticate);

// Travel report routes - restricted to CEO and IT Officer
router.get('/data', authorize('admin', 'ceo'), getTravelReportData);
router.get('/filters', authorize('admin', 'ceo'), getTravelReportFilters);
router.get('/export/pdf', authorize('admin', 'ceo'), exportTravelReportPdf);

module.exports = router;
