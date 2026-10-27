const router   = require('express').Router();
const ctrl     = require('./platform.controller');
const authCtrl = require('./auth.controller');
const svc      = require('./platform.service');
const { authenticate, authorize } = require('../../middleware/auth');
const { ok, notFound } = require('../../utils/response');

const SA  = authorize('super_admin');
const SAA = authorize('super_admin', 'admin');

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post('/auth/platform/login', authCtrl.platformLogin);
router.post('/auth/staff/login',    authCtrl.staffLogin);

// ── Owner context (called by frontend after owner platform login) ──────────────
router.get('/owners/me', authenticate, authorize('owner'), async (req, res, next) => {
  try {
    const ctx = await svc.getOwnerContext(req.user.id);
    ctx ? ok(res, ctx) : notFound(res, 'Owner record not found');
  } catch (err) { next(err); }
});

// ── Branch settings for active branch (used after branch switch) ──────────────
router.get('/branches/:branchId/context', authenticate, async (req, res, next) => {
  try {
    const { query } = require('../../db/pool');
    const { rows } = await query(
      `SELECT b.id, b.name, b.address, b.phone,
              bs.shop_name, bs.shop_address, bs.shop_contact, bs.shop_contact2, bs.logo_url,
              bs.purchase_bill_note, bs.rental_bill_note
       FROM branch b
       LEFT JOIN branch_settings bs ON bs.branch_id=b.id
       WHERE b.id=$1`, [req.params.branchId]
    );
    rows[0] ? ok(res, rows[0]) : notFound(res);
  } catch (err) { next(err); }
});

// ── Admins (Super Admin only) ─────────────────────────────────────────────────
router.get   ('/admins',              authenticate, SA,  ctrl.listAdmins);
router.get   ('/admins/:id',          authenticate, SA,  ctrl.getAdmin);
router.post  ('/admins',              authenticate, SA,  ctrl.createAdmin);
router.patch ('/admins/:id',          authenticate, SA,  ctrl.updateAdmin);
router.patch ('/admins/:id/password', authenticate, SA,  ctrl.resetAdminPwd);
router.delete('/admins/:id',          authenticate, SA,  ctrl.deleteAdmin);

// ── Owners ────────────────────────────────────────────────────────────────────
router.get   ('/owners',              authenticate, SAA, ctrl.listOwners);
router.get   ('/owners/:id',          authenticate, SAA, ctrl.getOwner);
router.post  ('/owners',              authenticate, SAA, ctrl.createOwner);
router.patch ('/owners/:id',          authenticate, SAA, ctrl.updateOwner);
router.patch ('/owners/:id/password', authenticate, SAA, ctrl.resetOwnerPwd);
router.delete('/owners/:id',          authenticate, SAA, ctrl.deleteOwner);

module.exports = router;
