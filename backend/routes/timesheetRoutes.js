const express = require('express');
const router = express.Router();
const {
  createTimesheet,
  getTimesheet,
  updateTimesheet,
  submitTimesheet,
  approveTimesheet,
  rejectTimesheet,
  listTimesheets,
  deleteTimesheet
} = require('../controllers/timesheetController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.post('/', createTimesheet);
router.get('/', listTimesheets);
router.get('/:id', getTimesheet);
router.put('/:id', updateTimesheet);
router.post('/:id/submit', submitTimesheet);
router.post('/:id/approve', approveTimesheet);
router.post('/:id/reject', rejectTimesheet);
router.delete('/:id', deleteTimesheet);

module.exports = router;
