const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please login' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Session expired. Please login again' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.user.role)) return next();
    res.status(403).json({ error: `Your role (${req.user.role}) is not allowed to do this` });
  };
}

module.exports = { authenticate, authorize };
