'use strict';
const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { MongoStore } = require('connect-mongo');
const mongoose = require('mongoose');

const env = require('./config/env');
const apiRoutes = require('./routes');
const { loadUser } = require('./middleware/auth');
const { csrfProtection } = require('./middleware/csrf');
const { noOperators } = require('./middleware/noOperators');
const { writeLimiter } = require('./middleware/rateLimits');
const { apiNotFound, errorHandler } = require('./middleware/errors');

/**
 * Build the Express application. The same server delivers the static frontend
 * and the JSON API, so the session cookie is first-party and no CORS is needed.
 */
function createApp({ sessionStore } = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        // Bootstrap, Bootstrap Icons and the Inter font are vendored under frontend/assets/vendor.
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'font-src': ["'self'"],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
        'upgrade-insecure-requests': env.isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  app.use(session({
    name: 'educycle.sid',
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: sessionStore || MongoStore.create({
      client: mongoose.connection.getClient(),
      collectionName: 'sessions',
      ttl: env.sessionMaxAgeHours * 3600,
      touchAfter: 15 * 60,
    }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProd,
      maxAge: env.sessionMaxAgeHours * 3600 * 1000,
    },
  }));

  /* ------------------------------ API ------------------------------ */
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api', noOperators, loadUser);
  app.use('/api', (req, res, next) => (['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? next() : writeLimiter(req, res, next)));
  app.use('/api', csrfProtection);
  app.use('/api', apiRoutes);
  app.use('/api', apiNotFound);

  /* --------------------------- Frontend --------------------------- */
  // The admin dashboard shell is only served to signed-in administrators.
  app.get(['/admin', '/admin.html'], loadUser, (req, res) => {
    if (!req.user || req.user.role !== 'admin') return res.redirect('/admin-login.html');
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(env.frontendDir, 'admin.html'));
  });
  app.use(express.static(env.frontendDir, { extensions: ['html'], index: 'index.html', maxAge: env.isProd ? '1h' : 0 }));

  app.use((req, res) => {
    res.status(404).sendFile(path.join(env.frontendDir, '404.html'));
  });

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
