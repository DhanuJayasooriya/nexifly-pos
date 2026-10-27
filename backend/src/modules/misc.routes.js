// ════════════════════════════════════════════════════════════════════════════
// REMAINING MODULES: Customer · Rental · Notification · Expense
// ════════════════════════════════════════════════════════════════════════════
const router = require('express').Router();
const { query } = require('../db/pool');
const { withTransaction } = require('../db/transaction');
const { ok, created, noContent, notFound, badRequest } = require('../utils/response');
const { authenticate, authorize } = require('../middleware/auth');
const { parsePagination, paginationMeta } = require('../utils/pagination');
const { markOverdueRentals } = require('../utils/rentalStatus');

function wrap(fn) {
  return async (req, res, next) => {
    try { await fn(req, res); }
    catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, message: err.message });
      next(err);
    }
  };
}

const OWN = authorize('owner');
const OM = authorize('owner', 'manager');
const ALL = authorize('owner', 'manager', 'cashier');

// ════════════════════════════════════════════════════════════════════════════
// CUSTOMERS
// ════════════════════════════════════════════════════════════════════════════

router.get('/branches/:branchId/customers', authenticate, ALL, wrap(async (req, res) => {
  const pg = parsePagination(req.query);
  const { search } = req.query;
  const cond = search ? `AND (name ILIKE $3 OR phone ILIKE $3 OR email ILIKE $3 OR nic ILIKE $3)` : '';
  const params = search ? [req.params.branchId, pg.limit, `%${search}%`, pg.offset] : [req.params.branchId, pg.limit, pg.offset];
  const offsetIdx = search ? 4 : 3;
  const { rows } = await query(
    `SELECT * FROM customer WHERE branch_id=$1 ${cond} ORDER BY name LIMIT $2 OFFSET $${offsetIdx}`,
    params
  );
  const { rows: t } = await query(`SELECT COUNT(*) FROM customer WHERE branch_id=$1`, [req.params.branchId]);
  ok(res, { items: rows, meta: paginationMeta(parseInt(t[0].count), pg.page, pg.limit) });
}));

router.get('/customers/:id', authenticate, ALL, wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT c.*, json_agg(json_build_object('id',le.id,'change',le.points_change,'reason',le.reason,'at',le.created_at)
       ORDER BY le.created_at DESC) FILTER (WHERE le.id IS NOT NULL) AS loyalty_history
     FROM customer c LEFT JOIN loyalty_event le ON le.customer_id=c.id
     WHERE c.id=$1 GROUP BY c.id`, [req.params.id]
  );
  rows[0] ? ok(res, rows[0]) : notFound(res);
}));

router.post('/branches/:branchId/customers', authenticate, ALL, wrap(async (req, res) => {
  const { name, phone, email, notes, nic } = req.body;
  const { rows } = await query(
    `INSERT INTO customer (branch_id,name,phone,email,notes,nic) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.params.branchId, name, phone, email, notes, nic || null]
  );
  created(res, rows[0]);
}));

router.patch('/customers/:id', authenticate, ALL, wrap(async (req, res) => {
  const { name, phone, email, notes, nic } = req.body;
  const { rows } = await query(
    `UPDATE customer SET name=COALESCE($1,name), phone=COALESCE($2,phone),
     email=COALESCE($3,email), notes=COALESCE($4,notes), nic=COALESCE($5,nic), updated_at=NOW()
     WHERE id=$5 RETURNING *`, [name, phone, email, notes, req.params.id]
  );
  rows[0] ? ok(res, rows[0]) : notFound(res);
}));

router.delete('/customers/:id', authenticate, OWN, wrap(async (req, res) => {
  const { rowCount } = await query(`DELETE FROM customer WHERE id=$1`, [req.params.id]);
  rowCount ? noContent(res) : notFound(res);
}));

// Loyalty events
router.post('/customers/:id/loyalty', authenticate, OM, wrap(async (req, res) => {
  const { pointsChange, reason, note } = req.body;
  await query(`UPDATE customer SET loyalty_points = loyalty_points + $1 WHERE id=$2`, [pointsChange, req.params.id]);
  const { rows } = await query(
    `INSERT INTO loyalty_event (customer_id,points_change,reason,note,created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.params.id, pointsChange, reason, note, req.user.id]
  );
  ok(res, rows[0]);
}));

// ════════════════════════════════════════════════════════════════════════════
// RENTALS
// ════════════════════════════════════════════════════════════════════════════

router.get('/branches/:branchId/rentals', authenticate, ALL, wrap(async (req, res) => {
  await markOverdueRentals(req.params.branchId);
  const pg = parsePagination(req.query);
  const { status } = req.query;
  const cond = status ? 'AND r.status=$4' : '';
  const params = status
    ? [req.params.branchId, pg.limit, pg.offset, status]
    : [req.params.branchId, pg.limit, pg.offset];
  const { rows } = await query(
    `SELECT r.*, c.name AS customer_name, c.nic AS customer_nic, c.phone AS customer_phone,
            pv.sku, p.name AS product_name,
            COALESCE((SELECT SUM(rp.amount) FROM rental_payment rp WHERE rp.rental_id=r.id),0) AS paid_amount
     FROM rental r
     JOIN customer c ON r.customer_id=c.id
     JOIN product_variant pv ON r.variant_id=pv.id
     JOIN product p ON pv.product_id=p.id
     WHERE r.branch_id=$1 ${cond} ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
    params
  );
  const { rows: t } = await query(`SELECT COUNT(*) FROM rental WHERE branch_id=$1`, [req.params.branchId]);
  ok(res, { items: rows, meta: paginationMeta(parseInt(t[0].count), pg.page, pg.limit) });
}));

// ── Rental search by customer NIC or name ────────────────────────────────────
router.get('/branches/:branchId/rentals/search', authenticate, ALL, wrap(async (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) return ok(res, []);
  const { rows } = await query(
    `SELECT r.*, c.name AS customer_name, c.nic AS customer_nic, c.phone AS customer_phone,
            pv.sku, p.name AS product_name,
            COALESCE(r.total_rent_amount, r.deposit_amount, 0) AS total_amount,
            COALESCE((SELECT SUM(rp.amount) FROM rental_payment rp WHERE rp.rental_id=r.id),0) AS paid_amount
     FROM rental r
     JOIN customer c ON c.id=r.customer_id
     JOIN product_variant pv ON pv.id=r.variant_id
     JOIN product p ON p.id=pv.product_id
     WHERE r.branch_id=$1
       AND r.status IN ('reserved','active','overdue')
       AND (c.name ILIKE $2 OR c.nic ILIKE $2 OR c.phone ILIKE $2)
     ORDER BY r.due_date ASC LIMIT 20`,
    [req.params.branchId, `%${q.trim()}%`]
  );
  ok(res, rows);
}));

router.get('/rentals/:id', authenticate, ALL, wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT r.*, c.name AS customer_name, pv.sku, p.name AS product_name,
       json_agg(json_build_object('id',rc.id,'type',rc.charge_type,'amount',rc.amount,'at',rc.charged_at)
         ORDER BY rc.charged_at) FILTER (WHERE rc.id IS NOT NULL) AS charges
     FROM rental r
     JOIN customer c ON r.customer_id=c.id
     JOIN product_variant pv ON r.variant_id=pv.id
     JOIN product p ON pv.product_id=p.id
     LEFT JOIN rental_charge rc ON rc.rental_id=r.id
     WHERE r.id=$1 GROUP BY r.id, c.name, pv.sku, p.name`, [req.params.id]
  );
  rows[0] ? ok(res, rows[0]) : notFound(res);
}));

// Rental creation lives in modules/rental/rental.routes.js (with overlap checks and advance payments).

router.patch('/rentals/:id', authenticate, ALL, wrap(async (req, res) => {
  const { status, returnedDate, notes } = req.body;
  const { rows } = await query(
    `UPDATE rental SET status=COALESCE($1,status), returned_date=COALESCE($2,returned_date),
     notes=COALESCE($3,notes) WHERE id=$4 RETURNING *`,
    [status, returnedDate, notes, req.params.id]
  );
  if (!rows[0]) return notFound(res);
  // When the item is received back, mark it available again.
  // stock_qty is not changed: creating a rental doesn't deduct stock, so
  // adding it back on return would inflate the count.
  if (status === 'returned' || status === 'item_received') {
    await query(`UPDATE product_variant SET rental_status='available' WHERE id=$1`, [rows[0].variant_id]);
  }
  ok(res, rows[0]);
}));

// ── Rental — receive item back ───────────────────────────────────────────────
// POST /rentals/:id/receive
// Marks item as received, checks payment balance, restores inventory.
// Body: { condition: 'good'|'damaged', notes }
router.post('/rentals/:id/receive', authenticate, ALL, wrap(async (req, res) => {
  const { condition, notes } = req.body;
  const { rows: rRows } = await query(
    `SELECT r.*, c.name AS customer_name, c.nic AS customer_nic, c.phone AS customer_phone,
            pv.sku, p.name AS product_name,
            COALESCE(r.total_rent_amount, r.deposit_amount, 0) AS total_amount,
            COALESCE((SELECT SUM(rp.amount) FROM rental_payment rp WHERE rp.rental_id=r.id), 0) AS paid_amount
     FROM rental r
     JOIN customer c ON c.id=r.customer_id
     JOIN product_variant pv ON pv.id=r.variant_id
     JOIN product p ON p.id=pv.product_id
     WHERE r.id=$1`, [req.params.id]
  );
  if (!rRows[0]) return notFound(res);
  const rental = rRows[0];
  const totalAmount = parseFloat(rental.total_amount) || 0;
  const paidAmount = parseFloat(rental.paid_amount) || 0;
  const balance = Math.max(0, totalAmount - paidAmount);
  const newStatus = condition === 'damaged' ? 'returned' : 'item_received';

  await withTransaction(async (client) => {
    // Update rental status and return date
    await client.query(
      `UPDATE rental SET status=$1, returned_date=CURRENT_DATE,
       notes=COALESCE($2, notes) WHERE id=$3`,
      [newStatus, notes || null, req.params.id]
    );
    // Mark the item available again (stock_qty unchanged — rentals don't deduct stock)
    if (condition !== 'damaged') {
      await client.query(
        `UPDATE product_variant SET rental_status='available' WHERE id=$1`, [rental.variant_id]
      );
    } else {
      await client.query(
        `UPDATE product_variant SET rental_status='available' WHERE id=$1`,
        [rental.variant_id]
      );
    }
  });

  ok(res, {
    rental: { ...rental, status: newStatus },
    totalAmount, paidAmount, balance,
    fullyPaid: balance <= 0,
    condition,
  });
}));

// ── Rental — add payment ─────────────────────────────────────────────────────
// POST /rentals/:id/payments
// Body: { amount, method, paymentType }
// paymentType: 'advance' | 'installment' | 'final' | 'balance'
router.post('/rentals/:id/payments', authenticate, ALL, wrap(async (req, res) => {
  const { amount, method, paymentType, notes } = req.body;
  if (!amount || parseFloat(amount) <= 0) return badRequest(res, 'Amount must be greater than 0');

  const staffId = req.user.layer === 'platform' ? null : req.user.id;
  const { rows } = await query(
    `INSERT INTO rental_payment (rental_id, amount, method, payment_type, notes, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.params.id, parseFloat(amount), method || 'cash', paymentType || 'installment', notes || null, staffId]
  );

  // Recalculate balance
  const { rows: balRows } = await query(
    `SELECT COALESCE(r.total_rent_amount, r.deposit_amount, 0) AS total_amount,
            COALESCE((SELECT SUM(rp.amount) FROM rental_payment rp WHERE rp.rental_id=r.id), 0) AS paid_amount
     FROM rental r WHERE r.id=$1`, [req.params.id]
  );
  const totalAmount = parseFloat(balRows[0]?.total_amount) || 0;
  const paidAmount = parseFloat(balRows[0]?.paid_amount) || 0;
  const balance = Math.max(0, totalAmount - paidAmount);

  // Auto-update status to 'active' when advance payment is made on reserved rental
  if (paymentType === 'advance') {
    await query(
      `UPDATE rental SET status='active' WHERE id=$1 AND status='reserved'`,
      [req.params.id]
    );
  }

  created(res, { payment: rows[0], totalAmount, paidAmount, balance, fullyPaid: balance <= 0 });
}));

// ── Rental — get payments ────────────────────────────────────────────────────
router.get('/rentals/:id/payments', authenticate, ALL, wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT rp.*, s.name AS recorded_by_name
     FROM rental_payment rp
     LEFT JOIN staff s ON s.id = rp.recorded_by
     WHERE rp.rental_id=$1 ORDER BY rp.paid_at ASC`,
    [req.params.id]
  );
  ok(res, rows);
}));


// Convert rental to sale
router.post('/rentals/:id/convert-to-sale', authenticate, ALL, wrap(async (req, res) => {
  const rental = await (async () => { const { rows } = await query(`SELECT * FROM rental WHERE id=$1`, [req.params.id]); return rows[0]; })();
  if (!rental) return notFound(res);
  const { price, paymentMethod } = req.body;
  const result = await withTransaction(async (client) => {
    const { rows: saleRows } = await client.query(
      `INSERT INTO sale (branch_id,customer_id,staff_id,bill_type,subtotal,total,payment_status)
       VALUES ($1,$2,$3,'rental',$4,$4,'paid') RETURNING *`,
      [rental.branch_id, rental.customer_id, req.user.id, price]
    );
    const sale = saleRows[0];
    await client.query(`INSERT INTO payment (sale_id,method,amount) VALUES ($1,$2,$3)`, [sale.id, paymentMethod || 'cash', price]);
    await client.query(`UPDATE rental SET status='sold', converted_sale_id=$1 WHERE id=$2`, [sale.id, rental.id]);
    await client.query(`UPDATE product_variant SET rental_status='sold' WHERE id=$1`, [rental.variant_id]);
    return sale;
  });
  created(res, result);
}));

router.post('/rentals/:id/charges', authenticate, ALL, wrap(async (req, res) => {
  const { chargeType, amount, notes } = req.body;
  const { rows } = await query(
    `INSERT INTO rental_charge (rental_id,charge_type,amount,notes,charged_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.params.id, chargeType, amount, notes, req.user.id]
  );
  created(res, rows[0]);
}));

// ════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════════════

router.get('/notifications', authenticate, ALL, wrap(async (req, res) => {
  const { branchId, role } = req.user;
  let rows;
  if (role === 'super_admin' || role === 'admin') {
    const r = await query(`SELECT * FROM notification WHERE recipient_type='platform' ORDER BY created_at DESC LIMIT 50`);
    rows = r.rows;
  } else if (role === 'owner') {
    // Owners who log in on the platform layer have no ownerId in their token, so look it up
    let ownerId = req.user.ownerId;
    if (!ownerId) {
      const { rows: o } = await query(`SELECT id FROM owner WHERE platform_user_id=$1`, [req.user.id]);
      ownerId = o[0]?.id;
    }
    const r = await query(
      `SELECT * FROM notification WHERE (recipient_type='branch' AND branch_id IN (SELECT id FROM branch WHERE owner_id=$1))
       OR (recipient_type='owner' AND owner_id=$1) ORDER BY created_at DESC LIMIT 50`, [ownerId]
    );
    rows = r.rows;
  } else {
    const r = await query(
      `SELECT * FROM notification WHERE recipient_type='branch' AND branch_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [branchId]
    );
    rows = r.rows;
  }
  ok(res, rows);
}));

router.patch('/notifications/:id/read', authenticate, ALL, wrap(async (req, res) => {
  const { rows } = await query(
    `UPDATE notification SET is_read=TRUE, read_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]
  );
  rows[0] ? ok(res, rows[0]) : notFound(res);
}));

router.patch('/notifications/read-all', authenticate, ALL, wrap(async (req, res) => {
  await query(
    `UPDATE notification SET is_read=TRUE, read_at=NOW() WHERE branch_id=$1 AND is_read=FALSE`,
    [req.user.branchId]
  );
  ok(res, { message: 'All marked as read' });
}));

// Notification rules
router.get('/branches/:branchId/notification-rules', authenticate, OWN, wrap(async (req, res) => {
  const { rows } = await query(`SELECT * FROM notification_rule WHERE branch_id=$1`, [req.params.branchId]);
  ok(res, rows);
}));

router.put('/branches/:branchId/notification-rules', authenticate, OWN, wrap(async (req, res) => {
  const { type, isEnabled, thresholdOverride, advanceDays } = req.body;
  const { rows } = await query(
    `INSERT INTO notification_rule (branch_id,type,is_enabled,threshold_override,advance_days)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (branch_id,type) DO UPDATE SET
       is_enabled=EXCLUDED.is_enabled,
       threshold_override=EXCLUDED.threshold_override,
       advance_days=EXCLUDED.advance_days,
       updated_at=NOW()
     RETURNING *`,
    [req.params.branchId, type, isEnabled, thresholdOverride, advanceDays]
  );
  ok(res, rows[0]);
}));

// ════════════════════════════════════════════════════════════════════════════
// EXPENSES
// ════════════════════════════════════════════════════════════════════════════

// Expense categories
router.get('/branches/:branchId/expense-categories', authenticate, ALL, wrap(async (req, res) => {
  const { rows } = await query(`SELECT * FROM expense_category WHERE branch_id=$1 ORDER BY name`, [req.params.branchId]);
  ok(res, rows);
}));

router.post('/branches/:branchId/expense-categories', authenticate, OWN, wrap(async (req, res) => {
  const { name, description } = req.body;
  const { rows } = await query(
    `INSERT INTO expense_category (branch_id,name,description) VALUES ($1,$2,$3) RETURNING *`,
    [req.params.branchId, name, description]
  );
  created(res, rows[0]);
}));

router.patch('/expense-categories/:id', authenticate, OWN, wrap(async (req, res) => {
  const { name, description } = req.body;
  const { rows } = await query(
    `UPDATE expense_category SET name=COALESCE($1,name), description=COALESCE($2,description) WHERE id=$3 RETURNING *`,
    [name, description, req.params.id]
  );
  rows[0] ? ok(res, rows[0]) : notFound(res);
}));

router.delete('/expense-categories/:id', authenticate, OWN, wrap(async (req, res) => {
  const { rowCount } = await query(`DELETE FROM expense_category WHERE id=$1`, [req.params.id]);
  rowCount ? noContent(res) : notFound(res);
}));

// Expenses
router.get('/branches/:branchId/expenses', authenticate, OM, wrap(async (req, res) => {
  const pg = parsePagination(req.query);
  const { rows } = await query(
    `SELECT e.*, ec.name AS category_name, st.name AS staff_name, ap.name AS approver_name
     FROM expense e
     LEFT JOIN expense_category ec ON e.category_id=ec.id
     LEFT JOIN staff st ON e.staff_id=st.id
     LEFT JOIN staff ap ON e.approved_by=ap.id
     WHERE e.branch_id=$1 ORDER BY e.expense_date DESC LIMIT $2 OFFSET $3`,
    [req.params.branchId, pg.limit, pg.offset]
  );
  const { rows: t } = await query(`SELECT COUNT(*) FROM expense WHERE branch_id=$1`, [req.params.branchId]);
  ok(res, { items: rows, meta: paginationMeta(parseInt(t[0].count), pg.page, pg.limit) });
}));

router.get('/expenses/:id', authenticate, OM, wrap(async (req, res) => {
  const { rows } = await query(`SELECT * FROM expense WHERE id=$1`, [req.params.id]);
  rows[0] ? ok(res, rows[0]) : notFound(res);
}));

router.post('/branches/:branchId/expenses', authenticate, ALL, wrap(async (req, res) => {
  const { categoryId, amount, description, expenseDate, paymentMethod, receiptUrl, isBillable, notes } = req.body;
  const { rows } = await query(
    `INSERT INTO expense (branch_id,category_id,staff_id,amount,description,expense_date,
       payment_method,receipt_url,is_billable,notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [req.params.branchId, categoryId, req.user.id, amount, description,
    expenseDate || new Date(), paymentMethod || 'cash', receiptUrl, isBillable !== false, notes]
  );
  created(res, rows[0]);
}));

router.patch('/expenses/:id', authenticate, ALL, wrap(async (req, res) => {
  const { amount, description, expenseDate, categoryId, notes, receiptUrl } = req.body;
  const { rows } = await query(
    `UPDATE expense SET amount=COALESCE($1,amount), description=COALESCE($2,description),
     expense_date=COALESCE($3,expense_date), category_id=COALESCE($4,category_id),
     notes=COALESCE($5,notes), receipt_url=COALESCE($6,receipt_url), updated_at=NOW()
     WHERE id=$7 AND approval_status='pending' RETURNING *`,
    [amount, description, expenseDate, categoryId, notes, receiptUrl, req.params.id]
  );
  rows[0] ? ok(res, rows[0]) : notFound(res, 'Expense not found or already approved');
}));

router.patch('/expenses/:id/approve', authenticate, OWN, wrap(async (req, res) => {
  const { status } = req.body; // 'approved' | 'rejected'
  const { rows } = await query(
    `UPDATE expense SET approval_status=$1, approved_by=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
    [status, req.user.id, req.params.id]
  );
  rows[0] ? ok(res, rows[0]) : notFound(res);
}));

router.delete('/expenses/:id', authenticate, OWN, wrap(async (req, res) => {
  const { rowCount } = await query(`DELETE FROM expense WHERE id=$1 AND approval_status='pending'`, [req.params.id]);
  rowCount ? noContent(res) : notFound(res, 'Cannot delete approved expense');
}));

// Stock adjustments (manual)
router.get('/branches/:branchId/stock-adjustments', authenticate, OM, wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT sa.*, pv.sku, p.name AS product_name, st.name AS adjusted_by_name
     FROM stock_adjustment sa
     JOIN product_variant pv ON sa.variant_id=pv.id
     JOIN product p ON pv.product_id=p.id
     LEFT JOIN staff st ON sa.adjusted_by=st.id
     WHERE sa.branch_id=$1 ORDER BY sa.adjusted_at DESC LIMIT 100`,
    [req.params.branchId]
  );
  ok(res, rows);
}));

router.post('/branches/:branchId/stock-adjustments', authenticate, OM, wrap(async (req, res) => {
  const { variantId, quantityChange, reason, notes } = req.body;
  const { rows } = await query(
    `INSERT INTO stock_adjustment (branch_id,variant_id,adjusted_by,reason,quantity_change,notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.params.branchId, variantId, req.user.id, reason || 'manual', quantityChange, notes]
  );
  await query(
    `UPDATE product_variant SET stock_qty = stock_qty + $1 WHERE id=$2`,
    [quantityChange, variantId]
  );
  created(res, rows[0]);
}));

module.exports = router;
