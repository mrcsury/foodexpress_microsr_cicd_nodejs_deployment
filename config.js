// Central place for reading environment variables (loaded from .env by dotenv).
require('dotenv').config();

const toBool = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['true', '1', 'yes'].includes(String(value).toLowerCase());
};

const nodeEnv = process.env.NODE_ENV || 'development';
const smtpPort = Number(process.env.SMTP_PORT) || 587;

module.exports = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(process.env.PORT) || 3000,
  trustProxy: process.env.TRUST_PROXY === undefined ? 0 : (Number(process.env.TRUST_PROXY) || 0),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: smtpPort,
    // Port 465 normally means implicit TLS; otherwise default to STARTTLS.
    secure: toBool(process.env.SMTP_SECURE, smtpPort === 465),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  emailFrom: process.env.EMAIL_FROM || 'FoodExpress <no-reply@foodexpress.local>',
  limits: {
    maxQuantityPerItem: 10,
    maxLineItems: 20,
    maxStoredOrders: 1000,
    emailResendCooldownMs: 30 * 1000,
    emailMaxAttempts: 5,
    // Per client IP, per minute. Classrooms often share one public IP, so keep this generous.
    ordersPerMinute: Number(process.env.RATE_LIMIT_ORDERS_PER_MIN) || 60,
  },
};
