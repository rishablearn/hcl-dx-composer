/**
 * HCL DX Composer Backend - Main Entry Point
 * Express server handling LDAP authentication, PostgreSQL staging, and HCL DX API proxying
 */

require('dotenv').config();

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION - keeping process alive:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION - keeping process alive:', reason);
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');

const logger = require('./config/logger');
const db = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const damRoutes = require('./routes/dam');
const wcmRoutes = require('./routes/wcm');
const configRoutes = require('./routes/config');
const dxProxyRoutes = require('./routes/dxProxy');
const micrositeRoutes = require('./routes/microsite');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Static file serving for uploaded assets
app.use('/uploads', express.static(process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads')));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        server: 'running'
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'disconnected',
        server: 'running'
      }
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dam', damRoutes);
app.use('/api/wcm', wcmRoutes);
app.use('/api/config', configRoutes);
app.use('/api/dx', dxProxyRoutes);
app.use('/api/microsite', micrositeRoutes);
app.use('/api/ai', aiRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      message: 'The uploaded file exceeds the maximum allowed size.'
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// Seed default role mappings for local LDAP
async function seedDefaultRoleMappings() {
  const ldapMode = process.env.LDAP_MODE || 'local';
  if (ldapMode !== 'local') return;
  
  const mappings = [
    { dn: 'cn=Admins,ou=Groups,dc=hcldx,dc=local', name: 'Admins', role: 'wpsadmin' },
    { dn: 'cn=Authors,ou=Groups,dc=hcldx,dc=local', name: 'Authors', role: 'dxcontentauthors' },
    { dn: 'cn=Reviewers,ou=Groups,dc=hcldx,dc=local', name: 'Reviewers', role: 'dxcontentapprovers' },
    { dn: 'cn=Publishers,ou=Groups,dc=hcldx,dc=local', name: 'Publishers', role: 'dxcontentauthors' },
    { dn: 'cn=AllUsers,ou=Groups,dc=hcldx,dc=local', name: 'AllUsers', role: 'dxcontentauthors' },
  ];
  
  for (const mapping of mappings) {
    await db.query(`
      INSERT INTO role_mappings (ldap_group_dn, ldap_group_name, app_role)
      VALUES ($1, $2, $3)
      ON CONFLICT (ldap_group_dn, app_role) DO NOTHING
    `, [mapping.dn, mapping.name, mapping.role]);
  }
  logger.info('Default role mappings seeded for local LDAP');
}

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    await db.query('SELECT NOW()');
    logger.info('Database connection established');
    
    // Seed default role mappings for local LDAP mode
    await seedDefaultRoleMappings();

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`HCL DX Composer Backend running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await db.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await db.end();
  process.exit(0);
});

startServer();

module.exports = app;
