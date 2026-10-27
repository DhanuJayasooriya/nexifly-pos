// ════════════════════════════════════════════════════════════════════════════
// RENTAL MODULE — Reservations, Payments, Availability
// ════════════════════════════════════════════════════════════════════════════
const router = require('express').Router();
const { query } = require('../../db/pool');
const { withTransaction } = require('../../db/transaction');
const { ok, created, notFound, badRequest, noContent } = require('../../utils/response');
const { authenticate, authorize } = require('../../middleware/auth');
const { parsePagination, paginationMeta } = require('../../utils/pagination');
const { markOverdueRentals } = require('../../utils/rentalStatus');

function wrap(fn) {
    return async (req, res, next) => {
        try { await fn(req, res); }
        catch (err) {
            if (err.status) return res.status(err.status).json({ success: false, message: err.message });
            next(err);
        }
    };
}
const ALL = authorize('owner', 'manager', 'cashier');
const OM = authorize('owner', 'manager');

// Resolve staff.id — platform-layer owner JWT id is platform_user.id not staff.id
async function resolveStaff(branchId, userId) {
    const { rows } = await query(
        `SELECT s.id FROM staff s
     JOIN branch b ON s.branch_id = b.id
     JOIN owner o ON b.owner_id = o.id
     WHERE s.branch_id = $1 AND (s.id = $2 OR o.platform_user_id = $2)
     LIMIT 1`,
        [branchId, userId]
    );
    if (rows[0]) return rows[0].id;
    const { rows: fb } = await query(
        `SELECT id FROM staff WHERE branch_id=$1 ORDER BY id LIMIT 1`, [branchId]
    );
    return fb[0]?.id || null;
}

// ── List rentals ──────────────────────────────────────────────────────────────
router.get('/branches/:branchId/rentals', authenticate, ALL, wrap(async (req, res) => {
    await markOverdueRentals(req.params.branchId);
    const pg = parsePagination(req.query);
    const { status } = req.query;
    const statusCond = status ? `AND r.status = $4` : '';
    const params = [req.params.branchId, pg.limit, pg.offset, ...(status ? [status] : [])];

    const { rows } = await query(
        `SELECT r.*,
       c.name  AS customer_name,
       c.phone AS customer_phone,
       c.nic   AS customer_nic,
       pv.sku,
       p.name  AS product_name,
       COALESCE((
         SELECT SUM(rp.amount) FROM rental_payment rp WHERE rp.rental_id = r.id
       ), 0) AS paid_amount
     FROM rental r
     LEFT JOIN customer       c  ON r.customer_id = c.id
     LEFT JOIN product_variant pv ON r.variant_id  = pv.id
     LEFT JOIN product         p  ON pv.product_id  = p.id
     WHERE r.branch_id = $1 ${statusCond}
     ORDER BY r.reserved_date DESC
     LIMIT $2 OFFSET $3`,
        params
    );
    const { rows: t } = await query(
        `SELECT COUNT(*) FROM rental WHERE branch_id = $1 ${status ? 'AND status=$2' : ''}`,
        status ? [req.params.branchId, status] : [req.params.branchId]
    );
    ok(res, { items: rows, meta: paginationMeta(parseInt(t[0].count), pg.page, pg.limit) });
}));

// ── Get rental by id ──────────────────────────────────────────────────────────
router.get('/rentals/:id', authenticate, ALL, wrap(async (req, res) => {
    const { rows } = await query(
        `SELECT r.*,
       c.name AS customer_name, c.phone AS customer_phone, c.nic AS customer_nic,
       pv.sku, p.name AS product_name,
       COALESCE((SELECT SUM(rp.amount) FROM rental_payment rp WHERE rp.rental_id=r.id),0) AS paid_amount,
       (SELECT json_agg(json_build_object(
           'id',rp.id,'amount',rp.amount,'method',rp.method,
           'payment_type',rp.payment_type,'notes',rp.notes,'paid_at',rp.paid_at
         ) ORDER BY rp.paid_at)
        FROM rental_payment rp WHERE rp.rental_id=r.id
       ) AS payments
     FROM rental r
     LEFT JOIN customer        c  ON r.customer_id = c.id
     LEFT JOIN product_variant pv ON r.variant_id  = pv.id
     LEFT JOIN product         p  ON pv.product_id  = p.id
     WHERE r.id = $1`,
        [req.params.id]
    );
    rows[0] ? ok(res, rows[0]) : notFound(res, 'Rental not found');
}));

// ── Create rental + optional advance payment ──────────────────────────────────
router.post('/branches/:branchId/rentals', authenticate, ALL, wrap(async (req, res) => {
    const { branchId } = req.params;
    const {
        variantId, customerId,
        reservedDate, rentedDate, dueDate,
        totalRentAmount, depositAmount,
        dailyRate: dailyRateParam,
        advancePayment, advanceMethod, advanceNotes,
        notes, status,
    } = req.body;

    if (!variantId || !reservedDate || !dueDate)
        return badRequest(res, 'variantId, reservedDate and dueDate are required');

    const staffId = await resolveStaff(branchId, req.user.id);

    return withTransaction(async (client) => {
        // Overlap check
        const { rows: overlap } = await client.query(
            `SELECT id FROM rental
       WHERE variant_id = $1 AND branch_id = $2
         AND status IN ('reserved','active','overdue')
         AND reserved_date < $4::date
         AND due_date      > $3::date`,
            [variantId, branchId, reservedDate, dueDate]
        );
        if (overlap.length)
            throw { status: 409, message: 'This item is already booked for that date range' };

        // daily_rate: use provided value or look up from variant
        let dailyRate = parseFloat(dailyRateParam) || 0;
        if (!dailyRate) {
            const { rows: vr } = await client.query(
                `SELECT COALESCE(rental_price_per_day, 0) AS rate FROM product_variant WHERE id=$1`, [variantId]
            );
            dailyRate = parseFloat(vr[0]?.rate || 0);
        }
        // If still 0, calculate from totalRentAmount and days
        if (!dailyRate && totalRentAmount && reservedDate && dueDate) {
            const days = Math.max(1, Math.ceil(
                (new Date(dueDate) - new Date(reservedDate)) / 86400000
            ));
            dailyRate = parseFloat(totalRentAmount) / days;
        }
        // Absolute minimum — avoid NOT NULL violation
        if (!dailyRate || isNaN(dailyRate)) dailyRate = 1;

        // Diagnostic: verify all FK references exist before INSERT
        const { rows: custCheck } = await client.query(
            `SELECT id FROM customer WHERE id=$1`, [customerId]
        );
        if (!custCheck.length) throw { status: 400, message: 'Customer id=' + customerId + ' not found in database' };

        const { rows: varCheck } = await client.query(
            `SELECT id FROM product_variant WHERE id=$1`, [variantId]
        );
        if (!varCheck.length) throw { status: 400, message: 'Variant id=' + variantId + ' not found in database' };

        const { rows: branchCheck } = await client.query(
            `SELECT id FROM branch WHERE id=$1`, [branchId]
        );
        if (!branchCheck.length) throw { status: 400, message: 'Branch id=' + branchId + ' not found in database' };

        if (!staffId) throw { status: 400, message: 'Could not resolve staff record for branch ' + branchId };

        let rentalId;
        try {
            const { rows: ins } = await client.query(
                `INSERT INTO rental
           (branch_id, variant_id, customer_id, staff_id,
            reserved_date, rented_date, due_date,
            daily_rate, total_rent_amount, deposit_amount, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
                [branchId, variantId, customerId, staffId,
                    reservedDate, rentedDate || null, dueDate,
                    dailyRate, totalRentAmount || 0, depositAmount || 0,
                    notes || null, status || 'reserved']
            );
            rentalId = ins[0].id;
            var rows = ins;
        } catch (e) {
            if (e.message && e.message.includes('total_rent_amount')) {
                const { rows: ins } = await client.query(
                    `INSERT INTO rental
             (branch_id, variant_id, customer_id, staff_id,
              reserved_date, rented_date, due_date,
              daily_rate, deposit_amount, notes, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
                    [branchId, variantId, customerId, staffId,
                        reservedDate, rentedDate || null, dueDate,
                        dailyRate, depositAmount || 0,
                        notes || null, status || 'reserved']
                );
                rentalId = ins[0].id;
                var rows = ins;
            } else { throw e; }
        }
        const rental = rows[0];

        // Record advance payment if provided
        const advance = parseFloat(advancePayment) || 0;
        if (advance > 0) {
            try {
                await client.query(
                    `INSERT INTO rental_payment
             (rental_id, amount, method, payment_type, notes, recorded_by)
           VALUES ($1,$2,$3,'advance',$4,$5)`,
                    [rentalId, advance, advanceMethod || 'cash', advanceNotes || null, staffId]
                );
            } catch (payErr) {
                // rental_payment table may not exist yet — non-fatal
                console.warn('[rental] advance payment insert failed (non-fatal):', payErr.message);
            }
        }

        // Fetch with paid_amount
        let full;
        try {
            const { rows: f } = await client.query(
                `SELECT r.*,
           COALESCE((SELECT SUM(rp.amount) FROM rental_payment rp WHERE rp.rental_id=r.id),0) AS paid_amount
         FROM rental r WHERE r.id = $1`,
                [rentalId]
            );
            full = f;
        } catch (e) {
            const { rows: f } = await client.query(`SELECT * FROM rental WHERE id=$1`, [rentalId]);
            full = f;
        }

        // Notify the branch about the new reservation (shows under "upcoming rentals").
        // A savepoint keeps a failed notification from rolling back the rental itself.
        try {
            await client.query('SAVEPOINT rental_notification');
            const { rows: cust } = await client.query(`SELECT name FROM customer WHERE id=$1`, [customerId]);
            const { rows: item } = await client.query(
                `SELECT pv.sku, p.name FROM product_variant pv
         JOIN product p ON p.id = pv.product_id WHERE pv.id = $1`, [variantId]
            );
            const customerName = cust[0]?.name || 'Customer';
            const itemName = item[0]?.name || 'Item';
            await client.query(
                `INSERT INTO notification
           (recipient_type, branch_id, type, title, message, reference_type, reference_id)
         VALUES ('branch',$1,'upcoming_rental',$2,$3,'rental',$4)`,
                [branchId, `Rental reserved — ${itemName}`,
                    `${customerName} reserved "${itemName}" from ${reservedDate || rentedDate} to ${dueDate}`, rentalId]
            );
            await client.query('RELEASE SAVEPOINT rental_notification');
        } catch (notifyErr) {
            await client.query('ROLLBACK TO SAVEPOINT rental_notification').catch(() => {});
            console.warn('[rental] notification insert failed (non-fatal):', notifyErr.message);
        }

        return created(res, full[0]);
    });
}));

// ── Update rental ─────────────────────────────────────────────────────────────
router.patch('/rentals/:id', authenticate, OM, wrap(async (req, res) => {
    const { rentedDate, dueDate, status, notes, totalRentAmount } = req.body;
    const { rows } = await query(
        `UPDATE rental SET
       rented_date       = COALESCE($1, rented_date),
       due_date          = COALESCE($2, due_date),
       status            = COALESCE($3, status),
       notes             = COALESCE($4, notes),
       total_rent_amount = COALESCE($5, total_rent_amount),
       updated_at        = NOW()
     WHERE id = $6 RETURNING *`,
        [rentedDate || null, dueDate || null, status || null,
        notes || null, totalRentAmount || null, req.params.id]
    );
    rows[0] ? ok(res, rows[0]) : notFound(res);
}));

// ── Add payment to rental ─────────────────────────────────────────────────────
router.post('/rentals/:id/payments', authenticate, ALL, wrap(async (req, res) => {
    const { amount, method, paymentType, notes } = req.body;
    if (!amount || parseFloat(amount) <= 0) return badRequest(res, 'Amount is required');

    const { rows: r } = await query(`SELECT branch_id FROM rental WHERE id=$1`, [req.params.id]);
    if (!r[0]) return notFound(res, 'Rental not found');
    const staffId = await resolveStaff(r[0].branch_id, req.user.id);

    const { rows } = await query(
        `INSERT INTO rental_payment
       (rental_id, amount, method, payment_type, notes, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [req.params.id, parseFloat(amount),
        method || 'cash', paymentType || 'installment',
        notes || null, staffId]
    );
    ok(res, rows[0]);
}));

// ── Availability check (also in billing.routes, kept here for clarity) ────────
router.get('/branches/:branchId/rental/available', authenticate, ALL, wrap(async (req, res) => {
    const { variantId, from, to } = req.query;
    if (!variantId || !from || !to) return badRequest(res, 'variantId, from and to required');
    const { rows } = await query(
        `SELECT id, reserved_date, due_date FROM rental
     WHERE variant_id = $1 AND branch_id = $2
       AND status IN ('reserved','active','overdue')
       AND reserved_date < $4::date
       AND due_date      > $3::date`,
        [variantId, req.params.branchId, from, to]
    );
    if (rows.length)
        return ok(res, { available: false, conflictFrom: rows[0].reserved_date, conflictTo: rows[0].due_date });
    ok(res, { available: true });
}));

// ── Search rentals by customer NIC / name / phone ────────────────────────────
router.get('/branches/:branchId/rentals/search', authenticate, ALL, wrap(async (req, res) => {
    const { q } = req.query;
    if (!q?.trim()) return ok(res, []);
    const { rows } = await query(
        `SELECT r.*,
       c.name AS customer_name, c.nic AS customer_nic, c.phone AS customer_phone,
       pv.sku, p.name AS product_name,
       COALESCE(r.total_rent_amount, r.deposit_amount, 0) AS total_amount,
       COALESCE((SELECT SUM(rp.amount) FROM rental_payment rp WHERE rp.rental_id=r.id),0) AS paid_amount
     FROM rental r
     LEFT JOIN customer c ON c.id = r.customer_id
     LEFT JOIN product_variant pv ON pv.id = r.variant_id
     LEFT JOIN product p ON p.id = pv.product_id
     WHERE r.branch_id = $1
       AND r.status IN ('reserved','active','overdue')
       AND (c.name ILIKE $2 OR c.nic ILIKE $2 OR c.phone ILIKE $2)
     ORDER BY r.due_date ASC LIMIT 20`,
        [req.params.branchId, `%${q.trim()}%`]
    );
    ok(res, rows);
}));

// ── List payments for a rental ────────────────────────────────────────────────
router.get('/rentals/:id/payments', authenticate, ALL, wrap(async (req, res) => {
    const { rows } = await query(
        `SELECT rp.*, s.name AS recorded_by_name
     FROM rental_payment rp
     LEFT JOIN staff s ON s.id = rp.recorded_by
     WHERE rp.rental_id = $1 ORDER BY rp.paid_at ASC`,
        [req.params.id]
    );
    ok(res, rows);
}));

// ── Receive rental item back ──────────────────────────────────────────────────
router.post('/rentals/:id/receive', authenticate, OM, wrap(async (req, res) => {
    const { condition, notes } = req.body;
    const { rows: rRows } = await query(
        `SELECT r.*,
       c.name AS customer_name, c.nic AS customer_nic, c.phone AS customer_phone,
       pv.sku, p.name AS product_name,
       COALESCE(r.total_rent_amount, r.deposit_amount, 0) AS total_amount,
       COALESCE((SELECT SUM(rp.amount) FROM rental_payment rp WHERE rp.rental_id=r.id),0) AS paid_amount
     FROM rental r
     LEFT JOIN customer c ON c.id = r.customer_id
     LEFT JOIN product_variant pv ON pv.id = r.variant_id
     LEFT JOIN product p ON p.id = pv.product_id
     WHERE r.id = $1`, [req.params.id]
    );
    if (!rRows[0]) return notFound(res);
    const rental = rRows[0];
    const totalAmount = parseFloat(rental.total_amount) || 0;
    const paidAmount = parseFloat(rental.paid_amount) || 0;
    const balance = Math.max(0, totalAmount - paidAmount);
    const newStatus = condition === 'damaged' ? 'returned' : 'item_received';
    await withTransaction(async (client) => {
        await client.query(
            `UPDATE rental SET status=$1, returned_date=CURRENT_DATE, notes=COALESCE($2,notes) WHERE id=$3`,
            [newStatus, notes || null, req.params.id]
        );
        if (condition !== 'damaged') {
            await client.query(
                `UPDATE product_variant SET rental_status='available' WHERE id=$1`,
                [rental.variant_id]
            );
        } else {
            await client.query(`UPDATE product_variant SET rental_status='available' WHERE id=$1`, [rental.variant_id]);
        }
    });
    ok(res, { rental: { ...rental, status: newStatus }, totalAmount, paidAmount, balance, fullyPaid: balance <= 0, condition });
}));

module.exports = router;
