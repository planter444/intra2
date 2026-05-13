const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kerea_hrms',
  jwtSecret: process.env.JWT_SECRET || 'change-this-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  resetTokenExpiresIn: process.env.RESET_TOKEN_EXPIRES_IN || '30m',
  ceoSeedEmail: process.env.CEO_SEED_EMAIL || process.env.ADMIN_SEED_EMAIL || 'ceo@kerea.org',
  ceoSeedPassword: process.env.CEO_SEED_PASSWORD || process.env.ADMIN_SEED_PASSWORD || 'Twocores@0010',
  mediaStorage: process.env.MEDIA_STORAGE || 'local',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER || 'kerea-hrms',
  filesRoot: path.resolve(process.cwd(), process.env.FILES_ROOT || 'uploads/private'),
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 10),
  brevoApiKey: process.env.BREVO_API_KEY || '',
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL || '',
  brevoSenderName: process.env.BREVO_SENDER_NAME || 'KEREA HRMS'
};

module.exports = env;
