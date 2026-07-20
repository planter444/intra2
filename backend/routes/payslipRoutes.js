const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
  listTemplates,
  uploadTemplate,
  getTemplateFields,
  activateTemplate,
  deactivateTemplate,
  deleteTemplate,
  updateTemplateMapping,
  downloadTemplateFile,
  getDataKeys,
  getPayrollProfile,
  savePayrollProfile,
  generatePayslips,
  previewPayslip,
  deletePayslip,
  listMyOrAllPayslips,
  downloadPayslipFile
} = require('../controllers/payslipController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = express.Router();

router.get('/templates', authenticate, authorize('admin'), listTemplates);
router.post('/templates', authenticate, authorize('admin'), upload.single('file'), uploadTemplate);
router.get('/templates/:id/fields', authenticate, authorize('admin'), getTemplateFields);
router.get('/templates/:id/file', authenticate, authorize('admin'), downloadTemplateFile);
router.patch('/templates/:id/activate', authenticate, authorize('admin'), activateTemplate);
router.patch('/templates/:id/deactivate', authenticate, authorize('admin'), deactivateTemplate);
router.delete('/templates/:id', authenticate, authorize('admin'), deleteTemplate);
router.patch('/templates/:id/mapping', authenticate, authorize('admin'), updateTemplateMapping);
router.get('/data-keys', authenticate, authorize('admin'), getDataKeys);

router.get('/profile/:userId', authenticate, authorize('admin', 'ceo', 'finance'), getPayrollProfile);
router.put('/profile/:userId', authenticate, authorize('admin', 'ceo', 'finance'), savePayrollProfile);

router.post('/generate', authenticate, authorize('admin', 'ceo', 'finance'), generatePayslips);
router.post('/preview', authenticate, authorize('admin', 'ceo', 'finance'), previewPayslip);
router.delete('/:id', authenticate, authorize('admin', 'ceo', 'finance'), deletePayslip);
router.get('/', authenticate, listMyOrAllPayslips);
router.get('/:id/file', authenticate, downloadPayslipFile);

module.exports = router;
