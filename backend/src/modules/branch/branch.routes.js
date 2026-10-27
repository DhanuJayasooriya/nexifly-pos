// ════════════════════════════════════════════════════════════════════════════
// BRANCH MODULE  — repository → service → controller → routes
// ════════════════════════════════════════════════════════════════════════════
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../../db/pool');
const { withTransaction } = require('../../db/transaction');
const { ok, created, noContent, notFound, forbidden, badRequest } = require('../../utils/response');
const { authenticate, authorize } = require('../../middleware/auth');
const { parsePagination, paginationMeta } = require('../../utils/pagination');

// ── Repository ────────────────────────────────────────────────────────────────

const repo = {
  async list(ownerId, { limit, offset }) {
    const { rows } = await query(
      `SELECT b.*, bs.shop_name, bs.logo_url
       FROM branch b LEFT JOIN branch_settings bs ON bs.branch_id=b.id
       WHERE b.owner_id=$1 ORDER BY b.id LIMIT $2 OFFSET $3`,
      [ownerId, limit, offset]
    );
    const { rows: t } = await query(`SELECT COUNT(*) FROM branch WHERE owner_id=$1`, [ownerId]);
    return { rows, total: parseInt(t[0].count) };
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT b.*, bs.shop_name, bs.logo_url, bs.shop_address, bs.shop_contact, bs.shop_contact2,
              bs.purchase_bill_note, bs.rental_bill_note
       FROM branch b LEFT JOIN branch_settings bs ON bs.branch_id=b.id
       WHERE b.id=$1`, [id]
    );
    return rows[0] || null;
  },

  async countByOwner(ownerId) {
    const { rows } = await query(`SELECT COUNT(*) FROM branch WHERE owner_id=$1`, [ownerId]);
    return parseInt(rows[0].count);
  },

  async create(data, client) {
    const db = client || { query: (...a) => query(...a) };
    const { ownerId, name, address, phone } = data;
    const { rows } = await db.query(
      `INSERT INTO branch (owner_id,name,address,phone) VALUES ($1,$2,$3,$4) RETURNING *`,
      [ownerId, name, address, phone]
    );
    const branch = rows[0];
    // Auto-create branch_settings
    await db.query(
      `INSERT INTO branch_settings (branch_id) VALUES ($1)`, [branch.id]
    );
    return branch;
  },

  async update(id, data) {
    const { name, address, phone, isActive } = data;
    const { rows } = await query(
      `UPDATE branch SET name=COALESCE($1,name), address=COALESCE($2,address),
       phone=COALESCE($3,phone), is_active=COALESCE($4,is_active), updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [name, address, phone, isActive, id]
    );
    return rows[0] || null;
  },

  async updateSettings(branchId, data, staffId) {
    const { shopName, shopAddress, shopContact, shopContact2, logoUrl, purchaseBillNote, rentalBillNote } = data;
    // Upsert: creates the settings row if a branch doesn't have one yet.
    // logo_url keeps its current value unless a new one is sent.
    try {
      const { rows } = await query(
        `INSERT INTO branch_settings
           (branch_id, shop_name, shop_address, shop_contact, shop_contact2, logo_url, purchase_bill_note, rental_bill_note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (branch_id) DO UPDATE SET
           shop_name=$2,
           shop_address=$3,
           shop_contact=$4,
           shop_contact2=$5,
           logo_url=COALESCE($6, branch_settings.logo_url),
           purchase_bill_note=$7,
           rental_bill_note=$8,
           updated_at=NOW()
         RETURNING *`,
        [branchId, shopName || null, shopAddress || null, shopContact || null, shopContact2 || null,
          logoUrl || null, purchaseBillNote ?? null, rentalBillNote ?? null]
      );
      return rows[0] || null;
    } catch (err) {
      console.error('[updateSettings SQL error]', err.code, err.message, err.detail);
      throw err;
    }
  },

  async delete(id) {
    const { rowCount } = await query(`DELETE FROM branch WHERE id=$1`, [id]);
    return rowCount > 0;
  },

  // ── Staff ──────────────────────────────────────────────────────────────────
  async listStaff(branchId) {
    const { rows } = await query(
      `SELECT id,name,role,email,is_active,created_at FROM staff WHERE branch_id=$1 ORDER BY name`,
      [branchId]
    );
    return rows;
  },

  async findStaffById(id) {
    const { rows } = await query(
      `SELECT id,name,role,email,is_active,branch_id,created_at FROM staff WHERE id=$1`, [id]
    );
    return rows[0] || null;
  },

  async createStaff(data) {
    const { branchId, name, role, email, passwordHash, pinHash, createdBy } = data;
    const { rows } = await query(
      `INSERT INTO staff (branch_id,name,role,email,password_hash,pin_hash,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,role,email,is_active,branch_id`,
      [branchId, name, role, email, passwordHash, pinHash, createdBy]
    );
    return rows[0];
  },

  async updateStaff(id, data) {
    const { name, email, isActive, branchId } = data;
    const { rows } = await query(
      `UPDATE staff SET name=COALESCE($1,name), email=COALESCE($2,email),
       is_active=COALESCE($3,is_active), branch_id=COALESCE($4,branch_id),
       updated_at=NOW()
       WHERE id=$5 RETURNING id,name,role,email,is_active,branch_id`,
      [name, email, isActive, branchId || null, id]
    );
    return rows[0] || null;
  },

  async updateStaffPassword(id, passwordHash) {
    await query(`UPDATE staff SET password_hash=$1, updated_at=NOW() WHERE id=$2`, [passwordHash, id]);
  },

  async deleteStaff(id) {
    const { rowCount } = await query(`DELETE FROM staff WHERE id=$1`, [id]);
    return rowCount > 0;
  },

  // ── Device config ──────────────────────────────────────────────────────────
  async listDevices(branchId) {
    const { rows } = await query(`SELECT * FROM device_config WHERE branch_id=$1`, [branchId]);
    return rows;
  },
  async upsertDevice(branchId, data, staffId) {
    const { deviceType, deviceName, connectionString } = data;
    const { rows } = await query(
      `INSERT INTO device_config (branch_id,device_type,device_name,connection_string,configured_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (branch_id, device_type) DO UPDATE SET
         device_name=EXCLUDED.device_name,
         connection_string=EXCLUDED.connection_string,
         configured_by=EXCLUDED.configured_by,
         configured_at=NOW()
       RETURNING *`,
      [branchId, deviceType, deviceName, connectionString, staffId]
    );
    return rows[0];
  },
};

// ── Service ───────────────────────────────────────────────────────────────────

const svc = {
  async list(ownerId, query) {
    const pg = parsePagination(query);
    return repo.list(ownerId, pg);
  },

  async get(id) { return repo.findById(id); },

  async create(body, user) {
    // Enforce max_branches
    const { rows } = await query(
      `SELECT max_branches FROM owner WHERE id=$1`, [user.ownerId]
    );
    const maxBranches = rows[0]?.max_branches || 1;
    const count = await repo.countByOwner(user.ownerId);
    if (count >= maxBranches) throw { status: 403, message: `Branch limit of ${maxBranches} reached` };
    return repo.create({ ...body, ownerId: user.ownerId });
  },

  async update(id, body) { return repo.update(id, body); },
  async updateSettings(id, body, staffId) { return repo.updateSettings(id, body, staffId); },
  async delete(id) { return repo.delete(id); },

  // Staff
  async listStaff(branchId) { return repo.listStaff(branchId); },
  async getStaff(id) { return repo.findStaffById(id); },

  async createStaff(branchId, body, actorId) {
    const passwordHash = body.password ? await bcrypt.hash(body.password, 12) : null;
    const pinHash = body.pin ? await bcrypt.hash(body.pin, 10) : null;
    return repo.createStaff({ ...body, branchId, passwordHash, pinHash, createdBy: actorId });
  },

  async updateStaff(id, body) { return repo.updateStaff(id, body); },

  async resetStaffPassword(id, newPassword) {
    const hash = await bcrypt.hash(newPassword, 12);
    return repo.updateStaffPassword(id, hash);
  },

  async deleteStaff(id) { return repo.deleteStaff(id); },
  async listDevices(branchId) { return repo.listDevices(branchId); },
  async upsertDevice(branchId, body, user) {
    // configured_by references staff(id). Shop-layer logins already carry a staff id;
    // owners logged in on the platform layer carry a platform_user id, so use their
    // owner staff row for this branch instead.
    let staffId = user.id;
    if (user.layer === 'platform') {
      const { rows } = await query(
        `SELECT s.id FROM staff s
         JOIN branch b ON s.branch_id = b.id
         JOIN owner o ON b.owner_id = o.id
         WHERE s.branch_id = $1 AND s.role = 'owner' AND o.platform_user_id = $2
         LIMIT 1`,
        [branchId, user.id]
      );
      staffId = rows[0]?.id || null;
    }
    return repo.upsertDevice(branchId, body, staffId);
  },
};

// ── Controller ────────────────────────────────────────────────────────────────

function wrap(fn) {
  return async (req, res, next) => {
    try { await fn(req, res); }
    catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, message: err.message });
      next(err);
    }
  };
}

const ctrl = {
  list: wrap(async (req, res) => {
    let ownerId = req.user.ownerId || req.params.ownerId;
    // Platform-layer owner login has no ownerId in JWT — resolve from DB
    if (!ownerId && req.user.role === 'owner' && req.user.layer === 'platform') {
      const { query } = require('../../db/pool');
      const { rows } = await query(
        `SELECT id FROM owner WHERE platform_user_id=$1`, [req.user.id]
      );
      ownerId = rows[0]?.id;
    }
    if (!ownerId) return ok(res, { items: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } });
    const { rows, total } = await svc.list(ownerId, req.query);
    const pg = parsePagination(req.query);
    ok(res, { items: rows, meta: paginationMeta(total, pg.page, pg.limit) });
  }),
  get: wrap(async (req, res) => { const d = await svc.get(req.params.id); d ? ok(res, d) : notFound(res); }),
  create: wrap(async (req, res) => {
    let user = { ...req.user };
    if (!user.ownerId && user.role === 'owner' && user.layer === 'platform') {
      const { query } = require('../../db/pool');
      const { rows } = await query(`SELECT id FROM owner WHERE platform_user_id=$1`, [user.id]);
      user.ownerId = rows[0]?.id;
    }
    created(res, await svc.create(req.body, user));
  }),
  update: wrap(async (req, res) => { const d = await svc.update(req.params.id, req.body); d ? ok(res, d) : notFound(res); }),
  updateSettings: wrap(async (req, res) => {
    const d = await svc.updateSettings(req.params.id, req.body, req.user.id);
    d ? ok(res, d) : notFound(res);
  }),
  delete: wrap(async (req, res) => { const ok_ = await svc.delete(req.params.id); ok_ ? noContent(res) : notFound(res); }),

  listStaff: wrap(async (req, res) => ok(res, await svc.listStaff(req.params.branchId))),
  getStaff: wrap(async (req, res) => { const d = await svc.getStaff(req.params.id); d ? ok(res, d) : notFound(res); }),
  createStaff: wrap(async (req, res) => created(res, await svc.createStaff(req.params.branchId, req.body, req.user.id))),
  updateStaff: wrap(async (req, res) => { const d = await svc.updateStaff(req.params.id, req.body); d ? ok(res, d) : notFound(res); }),
  resetStaffPwd: wrap(async (req, res) => { await svc.resetStaffPassword(req.params.id, req.body.password); ok(res, { message: 'Password updated' }); }),
  deleteStaff: wrap(async (req, res) => { const ok_ = await svc.deleteStaff(req.params.id); ok_ ? noContent(res) : notFound(res); }),

  listDevices: wrap(async (req, res) => ok(res, await svc.listDevices(req.params.branchId))),
  upsertDevice: wrap(async (req, res) => ok(res, await svc.upsertDevice(req.params.branchId, req.body, req.user))),
};

// ── Routes ────────────────────────────────────────────────────────────────────

const OWN = authorize('owner');
const OM = authorize('owner', 'manager');
const ALL = authorize('owner', 'manager', 'cashier');

router.get('/branches', authenticate, OWN, ctrl.list);
router.get('/branches/:id', authenticate, OM, ctrl.get);
router.post('/branches', authenticate, OWN, ctrl.create);
router.patch('/branches/:id', authenticate, OWN, ctrl.update);
router.patch('/branches/:id/settings', authenticate, OWN, ctrl.updateSettings);
router.delete('/branches/:id', authenticate, OWN, ctrl.delete);

router.get('/branches/:branchId/staff', authenticate, OWN, ctrl.listStaff);
router.get('/staff/:id', authenticate, OM, ctrl.getStaff);
router.post('/branches/:branchId/staff', authenticate, OWN, ctrl.createStaff);
router.patch('/staff/:id', authenticate, OWN, ctrl.updateStaff);
router.patch('/staff/:id/password', authenticate, OWN, ctrl.resetStaffPwd);
router.delete('/staff/:id', authenticate, OWN, ctrl.deleteStaff);

router.get('/branches/:branchId/devices', authenticate, OWN, ctrl.listDevices);
router.put('/branches/:branchId/devices', authenticate, OWN, ctrl.upsertDevice);

module.exports = router;
