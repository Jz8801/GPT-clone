const rateLimit = {};

const createRateLimit = (windowMs = 60000, max = 10) => {
  return (req, res, next) => {
    const key = req.ip + ':' + req.path;
    const now = Date.now();
    
    if (!rateLimit[key]) {
      rateLimit[key] = {
        count: 1,
        resetTime: now + windowMs
      };
      return next();
    }
    
    if (now > rateLimit[key].resetTime) {
      rateLimit[key] = {
        count: 1,
        resetTime: now + windowMs
      };
      return next();
    }
    
    if (rateLimit[key].count >= max) {
      return res.status(429).json({
        error: 'Too many requests, please try again later.',
        retryAfter: Math.ceil((rateLimit[key].resetTime - now) / 1000)
      });
    }
    
    rateLimit[key].count++;
    next();
  };
};

module.exports = createRateLimit;