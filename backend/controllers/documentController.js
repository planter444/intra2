const fs = require('fs');
const documentModel = require('../models/documentModel');
const { logAction } = require('../services/auditService');
const { deleteStoredDocument, getDocumentCategoryTypeCodes, getFolderTypeCodes, getRemoteDocumentUrl, isRemoteStoragePath, saveDocument, resolveDocumentPath } = require('../services/documentService');

const sendRemoteDocument = async ({ res, url, mimeType, fileName, disposition }) => {
  const response = await fetch(url);
  if (!response.ok) {
    const remoteErrorHeader = response.headers.get('x-cld-error');
    const remoteErrorBody = remoteErrorHeader ? '' : await response.text();
    const remoteError = remoteErrorHeader || remoteErrorBody || 'Unable to fetch remote document.';
    const error = new Error(/untrusted|show_original_customer_untrusted|deny|blocked for delivery/i.test(remoteError)
      ? 'Cloudinary is blocking delivery for this document. Enable PDF/ZIP delivery in your Cloudinary security settings, then try again.'
      : 'Unable to fetch this document right now.'
    );
    error.statusCode = 502;
    throw error;
  }

  const arrayBuffer = await response.arrayBuffer();
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`);
  res.send(Buffer.from(arrayBuffer));
};

const canAccessUserDocuments = (currentUser, targetUserId) => {
  if (['ceo', 'admin', 'finance'].includes(currentUser.role)) {
    return true;
  }

  return String(currentUser.id) === String(targetUserId);
};

const restrictedFolderTypes = new Set(['addendum']);
const canManageRestrictedFolderType = (currentUser) => ['ceo', 'admin'].includes(currentUser.role);

const getRestrictedFolderTypeCodes = async () => {
  const employmentTypeCodes = await getDocumentCategoryTypeCodes('employment');
  return new Set([...restrictedFolderTypes, ...employmentTypeCodes]);
};

const listDocuments = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId || req.query.userId || (req.user.role === 'ceo' ? undefined : req.user.id);

    if (targetUserId && !canAccessUserDocuments(req.user, targetUserId)) {
      return res.status(403).json({ message: 'You do not have permission to access these documents.' });
    }

    const documents = await documentModel.listVisible({
      viewerId: req.user.id,
      viewerRole: req.user.role,
      userId: targetUserId,
      search: req.query.search
    });
    res.json({ documents });
  } catch (error) {
    next(error);
  }
};

const uploadDocument = async (req, res, next) => {
  try {
    const targetUserId = req.body.userId || req.user.id;
    const folderType = req.body.folderType;
    const restrictedFolderTypeCodes = await getRestrictedFolderTypeCodes();

    if (!req.file) {
      return res.status(400).json({ message: 'A file is required.' });
    }

    const folderTypes = await getFolderTypeCodes();
    if (!folderTypes.includes(String(folderType || '').trim().toLowerCase())) {
      return res.status(400).json({ message: 'Invalid document folder type.' });
    }

    if (restrictedFolderTypeCodes.has(String(folderType || '').trim().toLowerCase()) && !canManageRestrictedFolderType(req.user)) {
      return res.status(403).json({ message: 'Only CEO or IT Officer can upload documents to this folder type.' });
    }

    if (!canAccessUserDocuments(req.user, targetUserId) || ((req.user.role === 'employee' || req.user.role === 'supervisor') && String(targetUserId) !== String(req.user.id))) {
      return res.status(403).json({ message: 'You do not have permission to upload for this user.' });
    }

    const { storedName, targetPath } = await saveDocument({
      userId: String(targetUserId),
      folderType,
      file: req.file
    });

    const document = await documentModel.create({
      userId: targetUserId,
      uploadedBy: req.user.id,
      folderType,
      fileName: req.file.originalname,
      storedName,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      storagePath: targetPath
    });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'DOCUMENT_UPLOAD',
      entityType: 'document',
      entityId: String(document.id),
      description: `${req.user.fullName} uploaded ${req.file.originalname}.`,
      metadata: { folderType, userId: targetUserId },
      ipAddress: req.ip
    });

    res.status(201).json({
      document: {
        id: document.id,
        userId: document.user_id,
        folderType: document.folder_type,
        fileName: document.file_name,
        mimeType: document.mime_type,
        fileSize: document.file_size,
        createdAt: document.created_at
      }
    });
  } catch (error) {
    next(error);
  }
};

const downloadDocument = async (req, res, next) => {
  try {
    const document = await documentModel.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    if (document.folderType !== 'branding' && !canAccessUserDocuments(req.user, document.userId)) {
      return res.status(403).json({ message: 'You do not have permission to access this document.' });
    }

    const disposition = req.query.preview === 'true' ? 'inline' : 'attachment';

    if (isRemoteStoragePath(document.storagePath)) {
      const remoteUrl = getRemoteDocumentUrl({
        storedName: document.storedName,
        mimeType: document.mimeType,
        fileName: document.fileName,
        asAttachment: req.query.preview !== 'true'
      });

      await sendRemoteDocument({
        res,
        url: remoteUrl,
        mimeType: document.mimeType,
        fileName: document.fileName,
        disposition
      });
      return;
    }

    const filePath = resolveDocumentPath(document.storagePath);

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${document.fileName}"`);

    const stream = fs.createReadStream(filePath);
    stream.on('error', next);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

const deleteDocument = async (req, res, next) => {
  try {
    const document = await documentModel.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found.' });
    }

    const restrictedFolderTypeCodes = await getRestrictedFolderTypeCodes();

    if (restrictedFolderTypeCodes.has(String(document.folderType || '').trim().toLowerCase()) && !canManageRestrictedFolderType(req.user)) {
      return res.status(403).json({ message: 'Only CEO or IT Officer can delete documents from this folder type.' });
    }

    const isOwner = String(document.userId) === String(req.user.id);
    const isAdmin = req.user.role === 'admin';
    const isCeo = req.user.role === 'ceo';
    const canDelete = isCeo || isAdmin || isOwner;
    if (!canDelete) {
      return res.status(403).json({ message: 'You do not have permission to delete this document.' });
    }

    await deleteStoredDocument({
      storagePath: document.storagePath,
      storedName: document.storedName,
      mimeType: document.mimeType
    });

    await documentModel.deleteById(document.id);

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'DOCUMENT_DELETE',
      entityType: 'document',
      entityId: String(document.id),
      description: `${req.user.fullName} deleted ${document.fileName}.`,
      metadata: { userId: document.userId, folderType: document.folderType },
      ipAddress: req.ip
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listDocuments,
  uploadDocument,
  downloadDocument,
  deleteDocument
};
