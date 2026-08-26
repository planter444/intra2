const express = require('express');
const { authenticateToken, requireRoles } = require('../middleware/authMiddleware');
const {
  getTravelReportFilters,
  getTravelReportData,
  exportTravelReportPdf
} = require('../controllers/travelReportController');

const router = express.Router();

// Get travel report filters
router.get('/filters', authenticateToken, requireRoles(['admin', 'ceo']), getTravelReportFilters);

// Get travel report data
router.get('/data', authenticateToken, requireRoles(['admin', 'ceo']), getTravelReportData);

// Export travel report as PDF
router.get('/export/pdf', authenticateToken, requireRoles(['admin', 'ceo']), exportTravelReportPdf);

module.exports = router;
