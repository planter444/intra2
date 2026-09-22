const express = require('express');
const {
  listTravelRequests,
  getTravelRequest,
  createTravelRequest,
  updateTravelRequest,
  cancelTravelRequest,
  decideTravelRequest,
  deleteTravelRequestPermanently,
  listTravelReceipts,
  getTravelReceipt,
  uploadTravelReceipt,
  updateTravelReceiptStatus,
  deleteTravelReceipt,
  downloadTravelReceipt,
  getTravelNotificationSettings,
  updateTravelNotificationSettings,
  getTravelRoutingSettings,
  updateTravelRoutingSettings,
  getAllEmployeeRouting,
  getApproverForEmployee,
  addEmployeeRouting,
  removeEmployeeRouting,
  getPendingTravelRequestCount,
  markTravelRequestAsViewed,
  updateTravelRequestSettled
} = require('../controllers/travelController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(authenticate);

// Travel request routes
router.get('/requests', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  listTravelRequests(req, res, next);
});
router.get('/requests/:id', getTravelRequest);
router.post('/requests', authorize('employee', 'supervisor', 'admin', 'finance', 'administrator_and_membership_officer'), upload.single('supportingDocument'), createTravelRequest);
router.put('/requests/:id', authorize('employee', 'supervisor', 'admin', 'finance', 'administrator_and_membership_officer'), updateTravelRequest);
router.patch('/requests/:id/cancel', authorize('employee', 'supervisor', 'admin', 'finance', 'administrator_and_membership_officer'), cancelTravelRequest);
router.patch('/requests/:id/decision', authorize('supervisor', 'admin', 'ceo', 'finance', 'administrator_and_membership_officer'), decideTravelRequest);
router.delete('/requests/:id', authorize('admin'), deleteTravelRequestPermanently);

// Travel receipt routes
router.get('/receipts', listTravelReceipts);
router.get('/receipts/:id', getTravelReceipt);
router.get('/receipts/:id/download', downloadTravelReceipt);
router.post('/receipts', authorize('employee', 'supervisor', 'admin', 'finance', 'administrator_and_membership_officer'), upload.single('receipt'), uploadTravelReceipt);
router.patch('/receipts/:id/status', authorize('finance', 'ceo', 'admin', 'supervisor', 'administrator_and_membership_officer'), updateTravelReceiptStatus);
router.delete('/receipts/:id', authorize('admin'), deleteTravelReceipt);

// Travel notification settings routes (admin only)
router.get('/notification-settings', getTravelNotificationSettings);
router.put('/notification-settings', authorize('admin'), updateTravelNotificationSettings);

// Travel routing settings routes (admin only)
router.get('/routing-settings', getTravelRoutingSettings);
router.put('/routing-settings', authorize('admin'), updateTravelRoutingSettings);

// Employee routing routes
router.get('/employee-routing', authorize('admin'), getAllEmployeeRouting);
router.get('/employee-routing/employee/:employeeId', getApproverForEmployee);
router.post('/employee-routing', authorize('admin'), addEmployeeRouting);
router.delete('/employee-routing/:id', authorize('admin'), removeEmployeeRouting);

// Pending count route
router.get('/pending-count', getPendingTravelRequestCount);

// Mark travel request as viewed
router.post('/requests/:id/viewed', markTravelRequestAsViewed);

// Update travel request settled status
router.patch('/requests/:id/settled', updateTravelRequestSettled);

module.exports = router;
