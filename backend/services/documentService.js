const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const defaultSettings = require('../config/defaultSettings');
const settingsModel = require('../models/settingsModel');

let cloudinaryClient = null;

const isRemoteStoragePath = (value) => /^https?:\/\//i.test(String(value || ''));

const sanitizeFilename = (value) => value.replace(/[^a-zA-Z0-9._-]/g, '_');
const isCloudinaryEnabled = () => env.mediaStorage === 'cloudinary';
const normalizeFolderCode = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
const getFileExtension = (fileName = '') => {
  const segments = String(fileName || '').split('.');
  return segments.length > 1 ? segments.pop().toLowerCase() : undefined;
};

const ensureCloudinaryConfigured = () => {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw new Error('Cloudinary storage is enabled but Cloudinary credentials are missing.');
  }
};

const getCloudinaryResourceType = (mimeType = '') => String(mimeType).startsWith('image/') ? 'image' : 'raw';

const getCloudinaryClient = () => {
  ensureCloudinaryConfigured();

  if (!cloudinaryClient) {
    ({ v2: cloudinaryClient } = require('cloudinary'));
    cloudinaryClient.config({
      cloud_name: env.cloudinaryCloudName,
      api_key: env.cloudinaryApiKey,
      api_secret: env.cloudinaryApiSecret
    });
  }

  return cloudinaryClient;
};

const getConfiguredFolders = async () => {
  const settings = await settingsModel.getGlobal();
  // Union DB-configured folders with defaults and any category-defined types
  const categories = Array.isArray(settings?.payload?.documentCategories) ? settings.payload.documentCategories : [];
  const categoryTypes = categories.flatMap((cat) => Array.isArray(cat?.types) ? cat.types : []);
  const sourceFolders = [
    ...(Array.isArray(settings?.payload?.folders) ? settings.payload.folders : []),
    ...categoryTypes,
    ...defaultSettings.folders
  ];

  const seenCodes = new Set();
  return sourceFolders.reduce((accumulator, folder) => {
    const code = normalizeFolderCode(folder?.code);
    if (!code || seenCodes.has(code)) {
      return accumulator;
    }

    seenCodes.add(code);
    accumulator.push({
      code,
      label: String(folder?.label || code).trim() || code
    });
    return accumulator;
  }, []);
};

const getFolderTypeCodes = async () => (await getConfiguredFolders()).map((folder) => folder.code);

const getDocumentCategoryTypeCodes = async (categoryCode) => {
  const normalizedCode = normalizeFolderCode(categoryCode);
  if (!normalizedCode) {
    return [];
  }

  const settings = await settingsModel.getGlobal();
  const categories = [
    ...(Array.isArray(settings?.payload?.documentCategories) ? settings.payload.documentCategories : []),
    ...(Array.isArray(defaultSettings.documentCategories) ? defaultSettings.documentCategories : [])
  ];

  const seenCodes = new Set();
  return categories
    .filter((cat) => normalizeFolderCode(cat?.code) === normalizedCode)
    .flatMap((cat) => Array.isArray(cat?.types) ? cat.types : [])
    .reduce((accumulator, item) => {
      const code = normalizeFolderCode(item?.code);
      if (!code || seenCodes.has(code)) {
        return accumulator;
      }
      seenCodes.add(code);
      accumulator.push(code);
      return accumulator;
    }, []);
};

const ensureEmployeeFolders = async (userId) => {
  await fs.promises.mkdir(path.join(env.filesRoot, userId), { recursive: true });

  const folderTypes = await getFolderTypeCodes();
  await Promise.all(
    folderTypes.map((folder) => fs.promises.mkdir(path.join(env.filesRoot, userId, folder), { recursive: true }))
  );
};

const deleteStoredDocument = async ({ storagePath, storedName, mimeType }) => {
  if (!storagePath) {
    return;
  }

  if (isCloudinaryEnabled() || isRemoteStoragePath(storagePath)) {
    if (storedName) {
      await getCloudinaryClient().uploader.destroy(storedName, { resource_type: getCloudinaryResourceType(mimeType), type: 'authenticated' });
    }
    return;
  }

  try {
    await fs.promises.unlink(resolveDocumentPath(storagePath));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};

const saveDocument = async ({ userId, folderType, file }) => {
  if (isCloudinaryEnabled()) {
    const uploadResult = await getCloudinaryClient().uploader.upload(`data:${file.mimetype};base64,${file.buffer.toString('base64')}`, {
      resource_type: getCloudinaryResourceType(file.mimetype),
      type: 'authenticated',
      public_id: `${env.cloudinaryFolder}/${userId}/${folderType}/${Date.now()}-${sanitizeFilename(file.originalname)}`,
      overwrite: false
    });

    return {
      storedName: uploadResult.public_id,
      targetPath: uploadResult.secure_url
    };
  }

  await fs.promises.mkdir(path.join(env.filesRoot, userId, folderType), { recursive: true });
  const storedName = `${Date.now()}-${sanitizeFilename(file.originalname)}`;
  const targetPath = path.join(env.filesRoot, userId, folderType, storedName);

  await fs.promises.writeFile(targetPath, file.buffer);

  return {
    storedName,
    targetPath
  };
};

const getRemoteDocumentUrl = ({ storedName, mimeType, fileName, asAttachment = true }) => {
  return getCloudinaryClient().utils.private_download_url(storedName, getFileExtension(fileName), {
    resource_type: getCloudinaryResourceType(mimeType),
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + 90,
    attachment: asAttachment ? (fileName || true) : undefined
  });
};

const resolveDocumentPath = (storagePath) => path.resolve(storagePath);

module.exports = {
  deleteStoredDocument,
  getConfiguredFolders,
  getDocumentCategoryTypeCodes,
  getFolderTypeCodes,
  getRemoteDocumentUrl,
  ensureEmployeeFolders,
  isRemoteStoragePath,
  saveDocument,
  resolveDocumentPath
};
