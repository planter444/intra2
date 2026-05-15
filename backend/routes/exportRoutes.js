const express = require('express');
const { exportData } = require('../controllers/exportController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticate);
router.get('/:dataset', authorize('admin'), exportData);

module.exports = router;
