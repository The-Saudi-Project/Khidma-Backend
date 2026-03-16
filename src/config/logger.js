const winston = require('winston');
const path = require('path');

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: 5242880,
      maxFiles: 10
    })
  ]
});

// Console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(colorize(), simple())
  }));
}

module.exports = logger;
