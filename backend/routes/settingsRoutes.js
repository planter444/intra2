const express = require('express');
const { getSettings, updateSettings, restoreSettings, seedKpiData } = require('../controllers/settingsController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/', authenticate, getSettings);
router.patch('/', authenticate, authorize('admin', 'ceo', 'finance'), updateSettings);
router.post('/restore', authenticate, authorize('admin'), restoreSettings);
router.post('/seed-kpi', authenticate, authorize('admin', 'ceo'), seedKpiData);

module.exports = router;
