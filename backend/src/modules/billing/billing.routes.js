// ════════════════════════════════════════════════════════════════════════════
// BILLING MODULE  — Discounts · Sessions · Checkout · Sales · Returns
// ════════════════════════════════════════════════════════════════════════════
const router = require('express').Router();
const resolveDiscount = require('../../utils/resolveDiscount');
const { query } = require('../../db/pool');
const { withTransaction } = require('../../db/transaction');
const { ok, created, noContent, notFound, badRequest, forbidden } = require('../../utils/response');
const { authenticate, authorize } = require('../../middleware/auth');
const { parsePagination, paginationMeta } = require('../../utils/pagination');
const { markOverdueRentals } = require('../../utils/rentalStatus');

// ── Discount repository ───────────────────────────────────────────────────────

const discountRepo = {
  async list(branchId) {
    const { rows } = await query(
      `SELECT d.*,
         sd.brand_id, sd.condition_min_price, sd.condition_value, b.name AS brand_name,
         bd.grn_id, g.grn_no
       FROM discount d
       LEFT JOIN seasonal_discount sd ON sd.discount_id=d.id
       LEFT JOIN brand b ON b.id=sd.brand_id
       LEFT JOIN bulk_discount bd ON bd.discount_id=d.id
       LEFT JOIN grn g ON g.id=bd.grn_id
       WHERE d.branch_id=$1 ORDER BY d.name`,
      [branchId]
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT d.*, sd.brand_id, sd.condition_min_price, sd.condition_value,
              bd.grn_id FROM discount d
       LEFT JOIN seasonal_discount sd ON sd.discount_id=d.id
       LEFT JOIN bulk_discount bd ON bd.discount_id=d.id
       WHERE d.id=$1`, [id]
    );
    return rows[0] || null;
  },

  async create(branchId, data, staffId) {
    return withTransaction(async (client) => {
      const { name, discountType, valueType, value, validFrom, validUntil,
        brandId, conditionMinPrice, conditionValue, grnId } = data;

      // Resolve staff.id — platform-layer owner JWT id is platform_user.id not staff.id
      // created_by is nullable so fall back to null if not resolved
      let resolvedStaffId = null;
      const { rows: staffLookup } = await client.query(
        `SELECT s.id FROM staff s
         JOIN branch b ON s.branch_id = b.id
         JOIN owner o ON b.owner_id = o.id
         WHERE s.branch_id = $1
           AND (s.id = $2 OR o.platform_user_id = $2)
         LIMIT 1`,
        [branchId, staffId]
      );
      resolvedStaffId = staffLookup[0]?.id || null;

      const { rows } = await client.query(
        `INSERT INTO discount (branch_id,name,discount_type,value_type,value,valid_from,valid_until,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [branchId, name, discountType, valueType, value, validFrom || null, validUntil || null, resolvedStaffId]
      );
      const d = rows[0];
      if (discountType === 'seasonal') {
        await client.query(
          `INSERT INTO seasonal_discount (discount_id,brand_id,condition_min_price,condition_value)
           VALUES ($1,$2,$3,$4)`,
          [d.id, brandId, conditionMinPrice || null, conditionValue || null]
        );
      } else if (discountType === 'bulk') {
        await client.query(
          `INSERT INTO bulk_discount (discount_id,grn_id) VALUES ($1,$2)`,
          [d.id, grnId]
        );
      }
      return d;
    });
  },

  async update(id, data) {
    const { name, valueType, value, validFrom, validUntil, isActive } = data;
    const { rows } = await query(
      `UPDATE discount SET name=COALESCE($1,name), value_type=COALESCE($2,value_type),
       value=COALESCE($3,value), valid_from=COALESCE($4,valid_from),
       valid_until=COALESCE($5,valid_until), is_active=COALESCE($6,is_active)
       WHERE id=$7 RETURNING *`,
      [name, valueType, value, validFrom, validUntil, isActive, id]
    );
    return rows[0] || null;
  },

  async delete(id) {
    // Must delete child rows first (no ON DELETE CASCADE on seasonal/bulk_discount)
    await query(`DELETE FROM seasonal_discount WHERE discount_id=$1`, [id]);
    await query(`DELETE FROM bulk_discount     WHERE discount_id=$1`, [id]);
    const { rowCount } = await query(`DELETE FROM discount WHERE id=$1`, [id]);
    return rowCount > 0;
  },

  /**
   * Resolve applicable discount for a variant at a given price.
   * Priority: seasonal > bulk > none.
   */
  async resolveDiscount(branchId, variantId, price, grnId) {
    // Seasonal: match by brand and optional price condition
    const { rows: sea } = await query(
      `SELECT d.*, sd.condition_min_price, sd.condition_value
       FROM discount d
       JOIN seasonal_discount sd ON sd.discount_id=d.id
       JOIN product_variant pv ON pv.id=$2
       JOIN product p ON p.id=pv.product_id
       WHERE d.branch_id=$1 AND d.is_active=TRUE
         AND sd.brand_id = p.brand_id
         AND (d.valid_from IS NULL OR d.valid_from <= NOW())
         AND (d.valid_until IS NULL OR d.valid_until >= NOW())
       ORDER BY d.id LIMIT 1`,
      [branchId, variantId]
    );

    if (sea.length > 0) {
      const s = sea[0];
      // Check price condition
      const meetsCondition = !s.condition_min_price || parseFloat(price) >= parseFloat(s.condition_min_price);
      if (meetsCondition) {
        const effectiveValue = s.condition_value || s.value;
        const discountAmt = s.value_type === 'flat'
          ? effectiveValue
          : (parseFloat(price) * effectiveValue / 100);
        return { discountId: s.id, source: 'seasonal', amount: discountAmt };
      }
    }

    // Bulk: match by GRN
    if (grnId) {
      const { rows: bulk } = await query(
        `SELECT d.* FROM discount d
         JOIN bulk_discount bd ON bd.discount_id=d.id
         WHERE d.branch_id=$1 AND d.is_active=TRUE AND bd.grn_id=$2
           AND (d.valid_from IS NULL OR d.valid_from <= NOW())
           AND (d.valid_until IS NULL OR d.valid_until >= NOW())
         LIMIT 1`,
        [branchId, grnId]
      );
      if (bulk.length > 0) {
        const b = bulk[0];
        const discountAmt = b.value_type === 'flat'
          ? b.value
          : (parseFloat(price) * b.value / 100);
        return { discountId: b.id, source: 'bulk', amount: discountAmt };
      }
    }
    return { discountId: null, source: 'none', amount: 0 };
  },
};

// ── Session repository ────────────────────────────────────────────────────────

const sessionRepo = {
  async listActive(staffId) {
    const { rows } = await query(
      `SELECT bs.*, json_agg(json_build_object(
         'id',bsi.id,'variantId',bsi.variant_id,'quantity',bsi.quantity_sold,
         'unitPrice',bsi.unit_price,'discountApplied',bsi.discount_applied,
         'discountSource',bsi.discount_source,'lineTotal',bsi.line_total
       )) FILTER (WHERE bsi.id IS NOT NULL) AS items
       FROM bill_session bs
       LEFT JOIN bill_session_item bsi ON bsi.session_id=bs.id
       WHERE bs.staff_id=$1 AND bs.status IN ('active','on_hold')
       GROUP BY bs.id`,
      [staffId]
    );
    return rows;
  },

  async create(branchId, staffId, billType, sessionKey) {
    // Max 2 sessions per staff
    const { rows: cnt } = await query(
      `SELECT COUNT(*) FROM bill_session WHERE staff_id=$1 AND status IN ('active','on_hold')`,
      [staffId]
    );
    if (parseInt(cnt[0].count) >= 2) throw { status: 409, message: 'Maximum 2 concurrent sessions allowed' };

    const key = sessionKey || 'A';

    // Return existing active session if one exists for this key
    const { rows: existing } = await query(
      `SELECT * FROM bill_session
       WHERE staff_id=$1 AND session_key=$2 AND status='active'
       LIMIT 1`,
      [staffId, key]
    );
    if (existing[0]) return existing[0];

    // Clean up completed/cancelled sessions with same key — delete items first (FK)
    const { rows: oldSess } = await query(
      `SELECT id FROM bill_session
       WHERE staff_id=$1 AND session_key=$2
         AND status IN ('completed','cancelled','voided')`,
      [staffId, key]
    );
    for (const s of oldSess) {
      await query(`DELETE FROM bill_session_item WHERE session_id=$1`, [s.id]);
      await query(`DELETE FROM bill_session WHERE id=$1`, [s.id]);
    }

    // Create fresh session
    const { rows } = await query(
      `INSERT INTO bill_session (branch_id,staff_id,bill_type,session_key,status)
       VALUES ($1,$2,$3,$4,'active') RETURNING *`,
      [branchId, staffId, billType || 'sale', key]
    );
    return rows[0];
  },

  async addItem(sessionId, itemData, branchId) {
    // Accept both field name conventions from frontend
    const variantId = itemData.variantId;
    const quantitySold = parseFloat(itemData.quantitySold || itemData.quantity || 1);
    const quantityUnitId = itemData.quantityUnitId || null;
    const quantityInBase = itemData.quantityInBase || quantitySold;
    // Use price resolved at lookup time if provided, else fetch fresh
    const rawPrice = parseFloat(itemData.unitPrice || itemData.basePrice || 0);

    // Resolve discount
    const discount = await resolveDiscount(variantId, rawPrice, branchId);
    const unitPrice = parseFloat(itemData.unitPrice || rawPrice);
    const discountApplied = parseFloat(discount.discountApplied || 0);
    const lineTotal = (unitPrice * quantitySold) - (discountApplied * quantitySold);

    const { rows } = await query(
      `INSERT INTO bill_session_item
         (session_id,variant_id,quantity_unit_id,quantity_sold,quantity_in_base,
          unit_price,discount_applied,discount_id,discount_source,line_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [sessionId, variantId, quantityUnitId, quantitySold,
        quantityInBase, unitPrice, discountApplied,
        discount.discountId || null, discount.discountSource || 'none', lineTotal]
    );

    await this._recalcSession(sessionId);
    return rows[0];
  },

  async removeItem(itemId, sessionId) {
    await query(`DELETE FROM bill_session_item WHERE id=$1 AND session_id=$2`, [itemId, sessionId]);
    await this._recalcSession(sessionId);
  },

  async _recalcSession(sessionId) {
    await query(
      `UPDATE bill_session SET
         subtotal=(SELECT COALESCE(SUM(line_total+discount_applied),0) FROM bill_session_item WHERE session_id=$1),
         total=(SELECT COALESCE(SUM(line_total),0) FROM bill_session_item WHERE session_id=$1)
                  - shop_discount + tax_amount,
         updated_at=NOW()
       WHERE id=$1`,
      [sessionId]
    );
  },

  async applyTaxAndDiscount(sessionId, taxAmount, shopDiscount) {
    const { rows } = await query(
      `UPDATE bill_session SET
         tax_amount=$1, shop_discount=$2,
         total=subtotal - $2 + $1, updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [taxAmount || 0, shopDiscount || 0, sessionId]
    );
    return rows[0] || null;
  },

  async hold(sessionId, staffId) {
    const { rows } = await query(
      `UPDATE bill_session SET status='on_hold', updated_at=NOW()
       WHERE id=$1 AND staff_id=$2 RETURNING *`,
      [sessionId, staffId]
    );
    return rows[0] || null;
  },

  async resume(sessionId, staffId) {
    const { rows } = await query(
      `UPDATE bill_session SET status='active', updated_at=NOW()
       WHERE id=$1 AND staff_id=$2 RETURNING *`,
      [sessionId, staffId]
    );
    return rows[0] || null;
  },

  async checkout(sessionId, staffId, paymentMethods) {
    return withTransaction(async (client) => {
      // Lock and fetch session
      const { rows: sess } = await client.query(
        `SELECT * FROM bill_session WHERE id=$1 AND staff_id=$2 AND status='active' FOR UPDATE`,
        [sessionId, staffId]
      );
      if (!sess.length) throw { status: 404, message: 'Active session not found' };
      const session = sess[0];

      const { rows: items } = await client.query(
        `SELECT * FROM bill_session_item WHERE session_id=$1`, [sessionId]
      );
      if (!items.length) throw { status: 400, message: 'Cannot checkout an empty session' };

      // Create sale
      const { rows: saleRows } = await client.query(
        `INSERT INTO sale (branch_id,bill_session_id,customer_id,staff_id,bill_type,
           subtotal,discount_amount,tax_amount,total,payment_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'paid') RETURNING *`,
        [session.branch_id, sessionId, session.customer_id, staffId,
        session.bill_type, session.subtotal, session.shop_discount,
        session.tax_amount, session.total]
      );
      const sale = saleRows[0];

      // Copy items to sale_items + deduct stock
      for (const item of items) {
        await client.query(
          `INSERT INTO sale_item (sale_id,variant_id,quantity_unit_id,quantity_sold,
             quantity_in_base,unit_price,discount_applied,discount_id,discount_source,line_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [sale.id, item.variant_id, item.quantity_unit_id, item.quantity_sold,
          item.quantity_in_base, item.unit_price, item.discount_applied,
          item.discount_id, item.discount_source, item.line_total]
        );

        // Deduct stock — fabric (continuous) items are sold by length, everything else by unit.
        // The row is locked so two tills can't sell the last item at the same time.
        const { rows: modeRows } = await client.query(
          `SELECT pt.inventory_mode, pv.sku, pv.stock_qty, pv.stock_qty_continuous
           FROM product_variant pv
           JOIN product p ON p.id=pv.product_id
           JOIN product_type pt ON pt.id=p.product_type_id
           WHERE pv.id=$1
           FOR UPDATE OF pv`,
          [item.variant_id]
        );
        const isContinuous = modeRows[0]?.inventory_mode === 'continuous';
        const available = parseFloat(isContinuous ? modeRows[0]?.stock_qty_continuous : modeRows[0]?.stock_qty) || 0;
        const needed = isContinuous ? parseFloat(item.quantity_sold) : Math.round(item.quantity_sold);
        if (needed > available) {
          throw {
            status: 409,
            message: `Not enough stock for ${modeRows[0]?.sku || 'item'}: ${available} available, ${needed} requested`,
          };
        }
        if (isContinuous) {
          await client.query(
            `UPDATE product_variant SET stock_qty_continuous = stock_qty_continuous - $1 WHERE id=$2`,
            [item.quantity_sold, item.variant_id]
          );
        } else {
          await client.query(
            `UPDATE product_variant SET stock_qty = stock_qty - $1 WHERE id=$2`,
            [Math.round(item.quantity_sold), item.variant_id]
          );
        }

        // Mark the correct number of barcodes as sold (circular buffer — oldest unsold first)
        // Orders by barcode_value ASC so 001, 002... are marked before higher numbers
        await client.query(
          `UPDATE barcode SET is_sold=TRUE, sold_at=NOW()
           WHERE id IN (
             SELECT bc.id
             FROM barcode bc
             JOIN grn_item gi ON bc.grn_item_id = gi.id
             WHERE gi.variant_id = $1
               AND bc.is_sold = FALSE
             ORDER BY bc.barcode_value ASC
             LIMIT $2
           )`,
          [item.variant_id, Math.round(item.quantity_sold)]
        );

        // Stock audit — non-fatal, staffId may be platform_user.id not staff.id
        try {
          await client.query(
            `INSERT INTO stock_adjustment (branch_id,variant_id,adjusted_by,reason,quantity_change,reference_type,reference_id)
             VALUES ($1,$2,$3,'sale',$4,'sale',$5)`,
            [session.branch_id, item.variant_id, staffId, -item.quantity_sold, sale.id]
          );
        } catch (auditErr) {
          console.warn('[CHECKOUT] stock_adjustment insert failed (non-fatal):', auditErr.message);
        }
      }

      // Record payments
      for (const pm of (paymentMethods || [])) {
        await client.query(
          `INSERT INTO payment (sale_id,method,amount,reference) VALUES ($1,$2,$3,$4)`,
          [sale.id, pm.method, pm.amount, pm.reference || null]
        );
      }

      // Close session
      await client.query(
        `UPDATE bill_session SET status='completed', updated_at=NOW() WHERE id=$1`, [sessionId]
      );

      // Archive completed session key — use last 2 chars of ID to stay in VARCHAR(2)
      // Wrapped in try/catch so a key conflict never rolls back the sale
      try {
        await client.query(
          `UPDATE bill_session
           SET session_key = RIGHT(CAST(id AS VARCHAR), 2)
           WHERE id = $1`,
          [sessionId]
        );
      } catch (e) {
        // If that key conflicts too, use a random 2-char string
        const rk = String.fromCharCode(65 + (sessionId % 26)) + String(sessionId % 10);
        try {
          await client.query(`UPDATE bill_session SET session_key=$1 WHERE id=$2`, [rk, sessionId]);
        } catch (e2) { /* ignore — session is completed, key rename is cosmetic */ }
      }

      // Low-stock notifications
      for (const item of items) {
        const { rows: v } = await client.query(
          `SELECT stock_qty, low_stock_threshold FROM product_variant WHERE id=$1`, [item.variant_id]
        );
        if (v[0] && v[0].stock_qty <= v[0].low_stock_threshold) {
          await client.query(
            `INSERT INTO notification (recipient_type,branch_id,type,title,message,reference_type,reference_id)
             VALUES ('branch',$1,'low_stock','Low stock alert','Stock below threshold','product_variant',$2)
             ON CONFLICT DO NOTHING`,
            [session.branch_id, item.variant_id]
          );
        }
      }

      return sale;
    });
  },
};

// ── Sales repository ──────────────────────────────────────────────────────────

const salesRepo = {
  async list(branchId, { limit, offset }) {
    const { rows } = await query(
      `SELECT s.*, st.name AS cashier_name, c.name AS customer_name
       FROM sale s LEFT JOIN staff st ON s.staff_id=st.id
       LEFT JOIN customer c ON s.customer_id=c.id
       WHERE s.branch_id=$1 ORDER BY s.sold_at DESC LIMIT $2 OFFSET $3`,
      [branchId, limit, offset]
    );
    const { rows: t } = await query(`SELECT COUNT(*) FROM sale WHERE branch_id=$1`, [branchId]);
    return { rows, total: parseInt(t[0].count) };
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT s.*, st.name AS cashier_name, c.name AS customer_name,
         json_agg(json_build_object(
           'id',si.id,'variantId',si.variant_id,'sku',pv.sku,'productName',p.name,
           'quantity',si.quantity_sold,'unitPrice',si.unit_price,
           'discountApplied',si.discount_applied,'discountSource',si.discount_source,
           'lineTotal',si.line_total
         )) FILTER (WHERE si.id IS NOT NULL) AS items,
         json_agg(DISTINCT jsonb_build_object('method',py.method,'amount',py.amount)) AS payments
       FROM sale s
       LEFT JOIN staff st ON s.staff_id=st.id
       LEFT JOIN customer c ON s.customer_id=c.id
       LEFT JOIN sale_item si ON si.sale_id=s.id
       LEFT JOIN product_variant pv ON si.variant_id=pv.id
       LEFT JOIN product p ON pv.product_id=p.id
       LEFT JOIN payment py ON py.sale_id=s.id
       WHERE s.id=$1 GROUP BY s.id,st.name,c.name`, [id]
    );
    return rows[0] || null;
  },

  async getDashboard(branchId) {
    await markOverdueRentals(branchId);
    const { rows: daily } = await query(
      `SELECT COALESCE(SUM(total),0) AS daily_total, COUNT(*) AS daily_count
       FROM sale WHERE branch_id=$1 AND DATE(sold_at)=CURRENT_DATE`, [branchId]
    );
    const { rows: monthly } = await query(
      `SELECT COALESCE(SUM(total),0) AS monthly_total
       FROM sale WHERE branch_id=$1
       AND sold_at >= DATE_TRUNC('month', CURRENT_DATE)`, [branchId]
    );
    const { rows: hourly } = await query(
      `SELECT EXTRACT(HOUR FROM sold_at) AS hour, COALESCE(SUM(total),0) AS total
       FROM sale WHERE branch_id=$1 AND DATE(sold_at)=CURRENT_DATE
       GROUP BY hour ORDER BY hour`, [branchId]
    );
    // Revenue for the last 7 days (today included)
    const { rows: weekly } = await query(
      `SELECT TO_CHAR(DATE(sold_at), 'Dy') AS day,
              COALESCE(SUM(total),0) AS revenue
       FROM sale WHERE branch_id=$1
         AND sold_at >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY DATE(sold_at), TO_CHAR(DATE(sold_at), 'Dy')
       ORDER BY DATE(sold_at) ASC`, [branchId]
    );
    // Low stock: fabric is compared by length, other items by unit count
    const { rows: lowStock } = await query(
      `SELECT p.name, pv.sku, pv.stock_qty, pv.stock_qty_continuous, pv.low_stock_threshold, pt.inventory_mode, pv.fabric_unit
       FROM product_variant pv
       JOIN product p ON p.id = pv.product_id
       JOIN product_type pt ON pt.id = p.product_type_id
       WHERE p.branch_id=$1
         AND pv.is_active = TRUE
         AND (
           (pt.inventory_mode = 'continuous' AND pv.stock_qty_continuous <= pv.low_stock_threshold)
           OR
           (pt.inventory_mode != 'continuous' AND pv.stock_qty <= pv.low_stock_threshold)
         )
       ORDER BY pv.stock_qty ASC, pv.stock_qty_continuous ASC
       LIMIT 20`, [branchId]
    );
    const { rows: rentalCounts } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('active','reserved')) AS active,
         COUNT(*) FILTER (WHERE status = 'overdue' OR (status = 'active' AND due_date < CURRENT_DATE)) AS overdue
       FROM rental WHERE branch_id=$1`, [branchId]
    );
    const { rows: recentSales } = await query(
      `SELECT s.id, s.total, s.sold_at AS created_at, s.payment_status AS status,
              COALESCE(c.name, 'Walk-in') AS customer_name,
              COUNT(si.id) AS item_count
       FROM sale s
       LEFT JOIN customer c ON c.id = s.customer_id
       LEFT JOIN sale_item si ON si.sale_id = s.id
       WHERE s.branch_id=$1
       GROUP BY s.id, c.name
       ORDER BY s.sold_at DESC
       LIMIT 8`, [branchId]
    );
    const { rows: recentGRNs } = await query(
      `SELECT g.id, g.grn_no, g.type AS grn_type, g.received_date AS received_at,
              COUNT(gi.id) AS item_count
       FROM grn g
       LEFT JOIN grn_item gi ON gi.grn_id = g.id
       WHERE g.branch_id=$1
       GROUP BY g.id
       ORDER BY g.received_date DESC
       LIMIT 5`, [branchId]
    );
    return {
      daily: { ...daily[0], monthly_total: monthly[0]?.monthly_total || 0 },
      hourly,
      weekly,
      lowStock,
      activeRentals: parseInt(rentalCounts[0]?.active || 0),
      overdueRentals: parseInt(rentalCounts[0]?.overdue || 0),
      recentSales,
      recentGRNs,
    };
  },
};

// ── Returns ───────────────────────────────────────────────────────────────────

const returnRepo = {
  async create(branchId, data, staffId) {
    return withTransaction(async (client) => {
      const { originalSaleId, reason, refundAmount, refundMethod, items } = data;
      const { rows } = await client.query(
        `INSERT INTO return_record (branch_id,original_sale_id,staff_id,reason,refund_amount,refund_method,status)
         VALUES ($1,$2,$3,$4,$5,$6,'approved') RETURNING *`,
        [branchId, originalSaleId, staffId, reason, refundAmount || 0, refundMethod]
      );
      const ret = rows[0];
      for (const item of (items || [])) {
        await client.query(
          `INSERT INTO return_item (return_id,sale_item_id,variant_id,quantity_returned,restock)
           VALUES ($1,$2,$3,$4,$5)`,
          [ret.id, item.saleItemId, item.variantId, item.quantityReturned, item.restock !== false]
        );
        if (item.restock !== false) {
          await client.query(
            `UPDATE product_variant SET stock_qty=stock_qty+$1 WHERE id=$2`,
            [item.quantityReturned, item.variantId]
          );
          await client.query(
            `INSERT INTO stock_adjustment (branch_id,variant_id,adjusted_by,reason,quantity_change,reference_type,reference_id)
             VALUES ($1,$2,$3,'return',$4,'return_record',$5)`,
            [branchId, item.variantId, staffId, item.quantityReturned, ret.id]
          );
        }
      }
      return ret;
    });
  },
};

// ── Routes ────────────────────────────────────────────────────────────────────

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

// Dashboard
router.get('/branches/:branchId/dashboard', authenticate, ALL, wrap(async (req, res) => ok(res, await salesRepo.getDashboard(req.params.branchId))));

// Discounts
router.get('/branches/:branchId/discounts', authenticate, ALL, wrap(async (req, res) => ok(res, await discountRepo.list(req.params.branchId))));
router.get('/discounts/:id', authenticate, ALL, wrap(async (req, res) => { const d = await discountRepo.findById(req.params.id); d ? ok(res, d) : notFound(res); }));
router.post('/branches/:branchId/discounts', authenticate, ALL, wrap(async (req, res) => created(res, await discountRepo.create(req.params.branchId, req.body, req.user.id))));
router.patch('/discounts/:id', authenticate, OWN, wrap(async (req, res) => { const d = await discountRepo.update(req.params.id, req.body); d ? ok(res, d) : notFound(res); }));
router.delete('/discounts/:id', authenticate, OWN, wrap(async (req, res) => { const ok_ = await discountRepo.delete(req.params.id); ok_ ? noContent(res) : notFound(res); }));

// Bill Sessions
router.get('/sessions', authenticate, ALL, wrap(async (req, res) => ok(res, await sessionRepo.listActive(req.user.id))));
router.post('/sessions', authenticate, ALL, wrap(async (req, res) => {
  const { billType, sessionKey } = req.body;

  // Platform-layer owner has no branchId in JWT — resolve from request header or DB
  let branchId = req.user.branchId || parseInt(req.headers['x-branch-id']);
  if (!branchId && req.user.role === 'owner') {
    const { rows } = await query(
      `SELECT b.id FROM branch b
       JOIN owner o ON b.owner_id = o.id
       WHERE o.platform_user_id = $1
       ORDER BY b.id LIMIT 1`,
      [req.user.id]
    );
    branchId = rows[0]?.id;
  }
  if (!branchId) return res.status(400).json({ success: false, message: 'Cannot determine branch — please log in via staff login' });

  // Resolve staff.id — try exact match first, then any staff in branch
  let staffId = null;
  const { rows: sr } = await query(
    `SELECT id FROM staff WHERE branch_id=$1 ORDER BY id LIMIT 1`, [branchId]
  );
  staffId = sr[0]?.id || null;

  if (!staffId) {
    return res.status(400).json({ success: false, message: 'No staff record found for branch ' + branchId });
  }

  try {
    const result = await sessionRepo.create(branchId, staffId, billType, sessionKey);
    created(res, result);
  } catch (err) {
    console.error('[SESSION CREATE] branchId:', branchId, 'staffId:', staffId, 'error:', err.message, 'code:', err.code);
    throw err;
  }
}));
router.post('/sessions/:id/items', authenticate, ALL, wrap(async (req, res) => {
  let branchId = req.user.branchId || parseInt(req.headers['x-branch-id']);
  if (!branchId && req.user.role === 'owner') {
    const { rows } = await query(
      `SELECT b.id FROM branch b JOIN owner o ON b.owner_id=o.id WHERE o.platform_user_id=$1 LIMIT 1`,
      [req.user.id]
    );
    branchId = rows[0]?.id;
  }
  ok(res, await sessionRepo.addItem(req.params.id, req.body, branchId));
}));
router.delete('/sessions/:sessionId/items/:itemId', authenticate, ALL, wrap(async (req, res) => { await sessionRepo.removeItem(req.params.itemId, req.params.sessionId); noContent(res); }));
router.patch('/sessions/:id/summary', authenticate, ALL, wrap(async (req, res) => { const d = await sessionRepo.applyTaxAndDiscount(req.params.id, req.body.taxAmount, req.body.shopDiscount); d ? ok(res, d) : notFound(res); }));
router.post('/sessions/:id/hold', authenticate, ALL, wrap(async (req, res) => {
  let staffId = req.user.id;
  const branchId = req.user.branchId || parseInt(req.headers['x-branch-id']);
  if (req.user.role === 'owner') {
    const { rows } = await query(`SELECT s.id FROM staff s JOIN branch b ON s.branch_id=b.id JOIN owner o ON b.owner_id=o.id WHERE s.branch_id=$1 AND (s.id=$2 OR o.platform_user_id=$2) LIMIT 1`, [branchId, req.user.id]);
    if (rows[0]) staffId = rows[0].id;
  }
  const d = await sessionRepo.hold(req.params.id, staffId);
  d ? ok(res, d) : notFound(res);
}));
router.post('/sessions/:id/resume', authenticate, ALL, wrap(async (req, res) => {
  let staffId = req.user.id;
  const branchId = req.user.branchId || parseInt(req.headers['x-branch-id']);
  if (req.user.role === 'owner') {
    const { rows } = await query(`SELECT s.id FROM staff s JOIN branch b ON s.branch_id=b.id JOIN owner o ON b.owner_id=o.id WHERE s.branch_id=$1 AND (s.id=$2 OR o.platform_user_id=$2) LIMIT 1`, [branchId, req.user.id]);
    if (rows[0]) staffId = rows[0].id;
  }
  const d = await sessionRepo.resume(req.params.id, staffId);
  d ? ok(res, d) : notFound(res);
}));
router.post('/sessions/:id/checkout', authenticate, ALL, wrap(async (req, res) => {
  let staffId = req.user.id;
  let branchId = req.user.branchId || parseInt(req.headers['x-branch-id']) || null;

  // Fallback: if branchId still missing, look up from DB using platform_user.id
  if (!branchId || isNaN(branchId)) {
    const { rows: br } = await query(
      `SELECT b.id FROM branch b JOIN owner o ON b.owner_id=o.id WHERE o.platform_user_id=$1 ORDER BY b.id LIMIT 1`,
      [req.user.id]
    );
    branchId = br[0]?.id || null;
  }

  if (branchId && req.user.role === 'owner') {
    const { rows } = await query(
      `SELECT s.id FROM staff s
       JOIN branch b ON s.branch_id = b.id
       JOIN owner o ON b.owner_id = o.id
       WHERE s.branch_id = $1
         AND (s.id = $2 OR o.platform_user_id = $2)
       LIMIT 1`,
      [branchId, req.user.id]
    );
    if (rows[0]) staffId = rows[0].id;
  }
  created(res, await sessionRepo.checkout(req.params.id, staffId, req.body.payments));
}));

// Sales
router.get('/branches/:branchId/sales', authenticate, ALL, wrap(async (req, res) => {
  const pg = parsePagination(req.query);
  const { rows, total } = await salesRepo.list(req.params.branchId, pg);
  ok(res, { items: rows, meta: paginationMeta(total, pg.page, pg.limit) });
}));
router.get('/sales/:id', authenticate, ALL, wrap(async (req, res) => { const d = await salesRepo.findById(req.params.id); d ? ok(res, d) : notFound(res); }));

// Returns
router.post('/branches/:branchId/returns', authenticate, ALL, wrap(async (req, res) => created(res, await returnRepo.create(req.params.branchId, req.body, req.user.id))));

// ── Rental availability check ─────────────────────────────────────────────────
// GET /branches/:branchId/rental/check?variantId=X&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/branches/:branchId/rental/check', authenticate, ALL, wrap(async (req, res) => {
  const { variantId, from, to } = req.query;
  if (!variantId || !from || !to) return badRequest(res, 'variantId, from and to are required');

  // Check for any active/reserved rental that overlaps with the requested period
  const { rows } = await query(
    `SELECT r.id, r.reserved_date, r.due_date
     FROM rental r
     WHERE r.variant_id = $1
       AND r.branch_id = $2
       AND r.status IN ('reserved','active')
       AND r.reserved_date < $4::date
       AND r.due_date > $3::date`,
    [variantId, req.params.branchId, from, to]
  );

  if (rows.length > 0) {
    const conflict = rows[0];
    return ok(res, {
      available: false,
      conflictFrom: conflict.reserved_date,
      conflictTo: conflict.due_date,
    });
  }
  return ok(res, { available: true });
}));

module.exports = router;