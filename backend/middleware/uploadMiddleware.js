const multer = require('multer');
const env = require('../config/env');

const allowedMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxFileSizeMb * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Unsupported file type. Please upload a PDF, image, or Word document.'));
    }

    cb(null, true);
  }
});

module.exports = {
  upload
};
