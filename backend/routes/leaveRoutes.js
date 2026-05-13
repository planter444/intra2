const express = require('express');
const {
  listLeaveTypes,
  getBalances,
  listRequests,
  getLeaveOverview,
  getRequest,
  createRequest,
  updateRequest,
  cancelRequest,
  downloadSupportingDocument,
  decideRequest,
  deleteRequestPermanently
} = require('../controllers/leaveController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(authenticate);
router.get('/types', listLeaveTypes);
router.get('/balances', getBalances);
router.get('/requests', listRequests);
router.get('/overview', authorize('employee', 'supervisor', 'admin', 'ceo', 'finance'), getLeaveOverview);
router.get('/requests/:id', getRequest);
router.get('/requests/:id/supporting-document', downloadSupportingDocument);
router.post('/requests', authorize('employee', 'supervisor', 'admin', 'finance'), upload.single('supportingDocument'), createRequest);
router.put('/requests/:id', authorize('employee', 'supervisor', 'admin', 'finance'), upload.single('supportingDocument'), updateRequest);
router.patch('/requests/:id/cancel', authorize('employee', 'supervisor', 'admin', 'finance'), cancelRequest);
router.patch('/requests/:id/decision', authorize('employee', 'supervisor', 'admin', 'ceo'), decideRequest);
router.delete('/requests/:id', authorize('admin', 'ceo'), deleteRequestPermanently);

module.exports = router;
