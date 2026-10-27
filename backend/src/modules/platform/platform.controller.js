const svc = require('./platform.service');
const { ok, created, noContent, notFound, serverError } = require('../../utils/response');
const { paginationMeta, parsePagination } = require('../../utils/pagination');

// ── Admins ────────────────────────────────────────────────────────────────────
const listAdmins   = wrap(async (req,res) => ok(res, await svc.listAdmins()));
const getAdmin     = wrap(async (req,res) => {
  const data = await svc.getAdmin(req.params.id);
  return data ? ok(res, data) : notFound(res);
});
const createAdmin  = wrap(async (req,res) => created(res, await svc.createAdmin(req.body, req.user.id)));
const updateAdmin  = wrap(async (req,res) => {
  const data = await svc.updateAdmin(req.params.id, req.body);
  return data ? ok(res, data) : notFound(res);
});
const resetAdminPwd = wrap(async (req,res) => {
  await svc.changeAdminPassword(req.params.id, req.body.password);
  return ok(res, { message: 'Password updated' });
});
const deleteAdmin  = wrap(async (req,res) => {
  const ok_ = await svc.deleteAdmin(req.params.id);
  return ok_ ? noContent(res) : notFound(res);
});

// ── Owners ────────────────────────────────────────────────────────────────────
const listOwners   = wrap(async (req,res) => {
  const { rows, total } = await svc.listOwners(req.query);
  const pg = parsePagination(req.query);
  return ok(res, { items: rows, meta: paginationMeta(total, pg.page, pg.limit) });
});
const getOwner     = wrap(async (req,res) => {
  const data = await svc.getOwner(req.params.id);
  return data ? ok(res, data) : notFound(res);
});
const createOwner  = wrap(async (req,res) => created(res, await svc.createOwner(req.body, req.user.id)));
const updateOwner  = wrap(async (req,res) => {
  const data = await svc.updateOwner(req.params.id, req.body, req.user.role);
  return data ? ok(res, data) : notFound(res);
});
const resetOwnerPwd = wrap(async (req,res) => {
  await svc.changeOwnerPassword(req.params.id, req.body.password);
  return ok(res, { message: 'Password updated' });
});
const deleteOwner  = wrap(async (req,res) => {
  const ok_ = await svc.deleteOwner(req.params.id);
  return ok_ ? noContent(res) : notFound(res);
});

// Error-wrapping helper
function wrap(fn) {
  return async (req, res, next) => {
    try { await fn(req, res); }
    catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, message: err.message });
      next(err);
    }
  };
}

module.exports = {
  listAdmins, getAdmin, createAdmin, updateAdmin, resetAdminPwd, deleteAdmin,
  listOwners, getOwner, createOwner, updateOwner, resetOwnerPwd, deleteOwner,
};
