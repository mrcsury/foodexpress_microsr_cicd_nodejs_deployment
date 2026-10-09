// A very small in-memory rate limiter (per client IP). Good enough for a demo;
// for production consider the "express-rate-limit" package or limiting at Nginx.
const { HttpError } = require('../services/orderService');

module.exports = function rateLimit({ windowMs, max }) {
  const hits = new Map(); // ip -> { count, resetAt }

  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (h.resetAt <= now) hits.delete(ip);
  }, windowMs);
  timer.unref(); // don't keep the process alive just for this timer

  return (req, res, next) => {
    const now = Date.now();
    let h = hits.get(req.ip);
    if (!h || h.resetAt <= now) {
      h = { count: 0, resetAt: now + windowMs };
      hits.set(req.ip, h);
    }
    h.count += 1;
    if (h.count > max) {
      res.set('Retry-After', String(Math.ceil((h.resetAt - now) / 1000)));
      return next(new HttpError(429, 'TOO_MANY_REQUESTS', 'Too many requests. Please slow down and try again shortly.'));
    }
    next();
  };
};
