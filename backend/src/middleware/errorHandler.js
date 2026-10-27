const { serverError } = require('../utils/response');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Postgres unique violation
  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'Duplicate entry: ' + (err.detail || err.message) });
  }
  // Postgres FK violation
  if (err.code === '23503') {
    return res.status(400).json({ success: false, message: 'Referenced record not found' });
  }
  // Postgres check violation
  if (err.code === '23514') {
    return res.status(400).json({ success: false, message: 'Value violates constraint: ' + err.detail });
  }
  return serverError(res, err);
}

module.exports = { errorHandler };
