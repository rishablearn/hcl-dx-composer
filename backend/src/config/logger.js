/**
 * Winston Logger Configuration
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'hcl-dx-composer' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      )
    })
  ]
});

// Add file transport in production (use app directory for Docker compatibility)
if (process.env.NODE_ENV === 'production') {
  const logDir = process.env.LOG_PATH || '/app/logs';
  const fs = require('fs');
  
  // Create log directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (err) {
      console.warn(`Could not create log directory ${logDir}, using console only`);
    }
  }
  
  // Only add file transports if directory is writable
  if (fs.existsSync(logDir)) {
    try {
      logger.add(new winston.transports.File({ 
        filename: `${logDir}/error.log`, 
        level: 'error' 
      }));
      logger.add(new winston.transports.File({ 
        filename: `${logDir}/combined.log` 
      }));
    } catch (err) {
      console.warn('Could not add file transports, using console only');
    }
  }
}

module.exports = logger;
