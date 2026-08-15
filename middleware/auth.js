// API????????? JSON 401?
function apiRequireLogin(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ ok: false, message: '???' });
}

// API????????? JSON 403?
function apiRequireAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.isAdmin) return next();
  return res.status(403).json({ ok: false, message: '???????' });
}

module.exports = { apiRequireLogin, apiRequireAdmin };
