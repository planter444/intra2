const express = require('express');
const { listDocuments, uploadDocument, downloadDocument, deleteDocument } = require('../controllers/documentController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.use(authenticate);
router.get('/', listDocuments);
router.get('/user/:userId', listDocuments);
router.post('/upload', authorize('employee', 'supervisor', 'admin', 'ceo', 'finance'), upload.single('file'), uploadDocument);
router.get('/:id/download', downloadDocument);
router.delete('/:id', authorize('admin', 'ceo'), deleteDocument);

module.exports = router;
