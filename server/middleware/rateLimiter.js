const rateLimit = require('express-rate-limit');

// General API rate limiter: 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: 'Too many requests, please try again later.' },
});

// Auth rate limiter: 10 requests per 15 minutes per IP (login/register)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: 'Too many authentication attempts, please try again later.' },
});

// Upload rate limiter: 10 requests per 15 minutes per IP
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: 'Upload limit reached, please try again later.' },
});

module.exports = { apiLimiter, authLimiter, uploadLimiter };
