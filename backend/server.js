const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const { initDatabase } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const documentRoutes = require('./routes/documentRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const auditRoutes = require('./routes/auditRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { bootstrapSystem } = require('./services/settingsService');
const { hashPassword } = require('./services/authService');

const app = express();
const isDevelopment = env.nodeEnv === 'development';
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 1000 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again shortly.' }
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 5000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again shortly.' }
});

const start = async () => {
  await fs.promises.mkdir(env.filesRoot, { recursive: true });
  await initDatabase();
  await bootstrapSystem({
    ceoSeedEmail: env.ceoSeedEmail,
    ceoSeedPassword: env.ceoSeedPassword,
    hashPassword
  });

  app.use(helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false
  }));
  app.use(cors({ origin: env.frontendUrl, credentials: false }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan('dev'));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'kerea-hrms-backend' });
  });

  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api', apiLimiter);
  app.use('/api/users', userRoutes);
  app.use('/api/leaves', leaveRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/audit-logs', auditRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  app.use(notFound);
  app.use(errorHandler);

  app.listen(env.port, () => {
    console.log(`KEREA HRMS backend listening on port ${env.port}`);
  });
};

start().catch((error) => {
  console.error('Failed to start KEREA HRMS backend', error);
  process.exit(1);
});
