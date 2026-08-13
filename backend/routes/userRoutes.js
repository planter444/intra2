const express = require('express');
const { listUsers, getProfile, createUser, updateUser, changePassword, resetPassword, softDeleteUser } = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticate);
router.get('/', authorize('supervisor', 'admin', 'ceo', 'finance'), listUsers);
router.post('/', authorize('admin', 'ceo'), createUser);
router.get('/:id', authorize('admin', 'employee', 'supervisor', 'ceo', 'finance'), getProfile);
router.put('/:id', authorize('admin', 'employee', 'supervisor', 'ceo', 'finance'), updateUser);
router.patch('/:id/change-password', authorize('admin', 'employee', 'supervisor', 'ceo', 'finance'), changePassword);
router.patch('/:id/reset-password', authorize('admin', 'ceo'), resetPassword);
router.delete('/:id', authorize('admin', 'ceo'), softDeleteUser);

module.exports = router;
