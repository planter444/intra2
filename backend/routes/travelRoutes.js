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
  getPendingTravelRequestCount
} = require('../controllers/travelController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(authenticate);

// Travel request routes
router.get('/requests', listTravelRequests);
router.get('/requests/:id', getTravelRequest);
router.post('/requests', authorize('employee', 'supervisor', 'admin', 'finance'), upload.single('supportingDocument'), createTravelRequest);
router.put('/requests/:id', authorize('employee', 'supervisor', 'admin', 'finance'), updateTravelRequest);
router.patch('/requests/:id/cancel', authorize('employee', 'supervisor', 'admin', 'finance'), cancelTravelRequest);
router.patch('/requests/:id/decision', authorize('supervisor', 'admin', 'ceo', 'finance'), decideTravelRequest);
router.delete('/requests/:id', authorize('admin'), deleteTravelRequestPermanently);

// Travel receipt routes
router.get('/receipts', listTravelReceipts);
router.get('/receipts/:id', getTravelReceipt);
router.get('/receipts/:id/download', downloadTravelReceipt);
router.post('/receipts', authorize('employee', 'supervisor', 'admin', 'finance'), upload.single('receipt'), uploadTravelReceipt);
router.patch('/receipts/:id/status', authorize('finance', 'ceo', 'admin', 'supervisor'), updateTravelReceiptStatus);
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

module.exports = router;
