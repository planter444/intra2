const express = require('express');
const { listLogs } = require('../controllers/auditController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/', authenticate, authorize('admin'), listLogs);

module.exports = router;
