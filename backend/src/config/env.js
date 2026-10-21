'use strict';
const path = require('path');
require('dotenv').config({ path: process.env.DOTENV_PATH || path.resolve(__dirname, '../../../.env'), quiet: true });

const isProd = process.env.NODE_ENV === 'production';

function required(name, fallbackForDev) {
  const v = process.env[name];
  if (v && v.trim()) return v.trim();
  if (!isProd && fallbackForDev !== undefined) return fallbackForDev;
  throw new Error(`Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`);
}

const env = {
  isProd,
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/educycle'),
  // In development a random secret is generated per start (sessions then reset on restart).
  sessionSecret: required('SESSION_SECRET', require('crypto').randomBytes(32).toString('hex')),
  sessionMaxAgeHours: parseInt(process.env.SESSION_MAX_AGE_HOURS || '72', 10),
  frontendDir: path.resolve(__dirname, '../../../frontend'),
};

if (!process.env.SESSION_SECRET && !isProd && process.env.NODE_ENV !== 'test') {
  console.warn('[env] SESSION_SECRET is not set; using a temporary secret. Sessions will reset when the server restarts.');
}

module.exports = env;
