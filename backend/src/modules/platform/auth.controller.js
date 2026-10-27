const { loginPlatform, loginStaff } = require('./auth.service');
const { ok, badRequest } = require('../../utils/response');

async function platformLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return badRequest(res, 'email and password required');
    const result = await loginPlatform(email, password);
    return ok(res, result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
}

async function staffLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return badRequest(res, 'email and password required');
    const result = await loginStaff(email, password);
    return ok(res, result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
}

module.exports = { platformLogin, staffLogin };
