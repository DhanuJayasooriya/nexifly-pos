// ════════════════════════════════════════════════════════════════════════════
// GRN MODULE  — Suppliers · Purchase Orders · GRN · Barcodes (EAN-13)
// ════════════════════════════════════════════════════════════════════════════
const router = require('express').Router();
const { query } = require('../../db/pool');
const { withTransaction } = require('../../db/transaction');
const { generateEAN13 } = require('../../utils/barcode');
const { ok, created, noContent, notFound, badRequest } = require('../../utils/response');
const { authenticate, authorize } = require('../../middleware/auth');
const { parsePagination, paginationMeta } = require('../../utils/pagination');

// ── Repository ────────────────────────────────────────────────────────────────

const repo = {
  // Suppliers
  async listSuppliers(branchId) {
    const { rows } = await query(`SELECT * FROM supplier WHERE branch_id=$1 AND is_active=TRUE ORDER BY name`, [branchId]);
    return rows;
  },
  async createSupplier(branchId, data) {
    const { name, contactName, phone, email, address } = data;
    const { rows } = await query(
      `INSERT INTO supplier (branch_id,name,contact_name,phone,email,address) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [branchId, name, contactName, phone, email, address]
    );
    return rows[0];
  },
  async updateSupplier(id, data) {
    const { name, contactName, phone, email, address, isActive } = data;
    const { rows } = await query(
      `UPDATE supplier SET name=COALESCE($1,name), contact_name=COALESCE($2,contact_name),
       phone=COALESCE($3,phone), email=COALESCE($4,email), address=COALESCE($5,address),
       is_active=COALESCE($6,is_active) WHERE id=$7 RETURNING *`,
      [name, contactName, phone, email, address, isActive, id]
    );
    return rows[0] || null;
  },
  async deleteSupplier(id) {
    const { rowCount } = await query(`DELETE FROM supplier WHERE id=$1`, [id]);
    return rowCount > 0;
  },

  // Purchase Orders
  async listPOs(branchId, { limit, offset }) {
    const { rows } = await query(
      `SELECT po.*, s.name AS supplier_name FROM purchase_order po
       JOIN supplier s ON po.supplier_id=s.id
       WHERE po.branch_id=$1 ORDER BY po.ordered_at DESC LIMIT $2 OFFSET $3`,
      [branchId, limit, offset]
    );
    const { rows: t } = await query(`SELECT COUNT(*) FROM purchase_order WHERE branch_id=$1`, [branchId]);
    return { rows, total: parseInt(t[0].count) };
  },
  async findPOById(id) {
    const { rows } = await query(
      `SELECT po.*, s.name AS supplier_name,
         json_agg(json_build_object(
           'id',poi.id,'variantId',poi.variant_id,'sku',pv.sku,
           'productName',p.name,'quantity',poi.quantity,'unitCost',poi.unit_cost
         )) FILTER (WHERE poi.id IS NOT NULL) AS items
       FROM purchase_order po
       JOIN supplier s ON po.supplier_id=s.id
       LEFT JOIN purchase_order_item poi ON poi.po_id=po.id
       LEFT JOIN product_variant pv ON poi.variant_id=pv.id
       LEFT JOIN product p ON pv.product_id=p.id
       WHERE po.id=$1 GROUP BY po.id, s.name`, [id]
    );
    return rows[0] || null;
  },
  async createPO(branchId, data, staffId) {
    return withTransaction(async (client) => {
      const { supplierId, poNumber, notes, items } = data;
      const { rows } = await client.query(
        `INSERT INTO purchase_order (branch_id,supplier_id,po_number,status,notes,created_by)
         VALUES ($1,$2,$3,'draft',$4,$5) RETURNING *`,
        [branchId, supplierId, poNumber, notes, staffId]
      );
      const po = rows[0];
      for (const item of (items || [])) {
        await client.query(
          `INSERT INTO purchase_order_item (po_id,variant_id,quantity,unit_cost) VALUES ($1,$2,$3,$4)`,
          [po.id, item.variantId, item.quantity, item.unitCost]
        );
      }
      return po;
    });
  },
  async updatePO(id, data, staffId) {
    const { status, notes } = data;
    const { rows } = await query(
      `UPDATE purchase_order SET status=COALESCE($1,status), notes=COALESCE($2,notes),
       updated_by=$3 WHERE id=$4 RETURNING *`,
      [status, notes, staffId, id]
    );
    return rows[0] || null;
  },
  async deletePO(id) {
    const { rowCount } = await query(`DELETE FROM purchase_order WHERE id=$1`, [id]);
    return rowCount > 0;
  },

  // GRN
  async listGRNs(branchId, { limit, offset }) {
    const { rows } = await query(
      `SELECT g.*, po.po_number, s.name AS supplier_name,
              st.name AS received_by_name
       FROM grn g
       LEFT JOIN purchase_order po ON g.purchase_order_id=po.id
       LEFT JOIN supplier s ON po.supplier_id=s.id
       LEFT JOIN staff st ON g.received_by=st.id
       WHERE g.branch_id=$1 ORDER BY g.created_at DESC LIMIT $2 OFFSET $3`,
      [branchId, limit, offset]
    );
    const { rows: t } = await query(`SELECT COUNT(*) FROM grn WHERE branch_id=$1`, [branchId]);
    return { rows, total: parseInt(t[0].count) };
  },

  async findGRNById(id) {
    const { rows } = await query(
      `SELECT g.*,
         json_agg(json_build_object(
           'id',gi.id,'variantId',gi.variant_id,'sku',pv.sku,
           'productName',p.name,'quantityReceived',gi.quantity_received,
           'unitCost',gi.unit_cost,'barcodesPrinted',gi.barcodes_printed,
           'barcodes', (
             SELECT json_agg(json_build_object('id',bc.id,'value',bc.barcode_value,'isPrinted',bc.is_printed))
             FROM barcode bc WHERE bc.grn_item_id=gi.id
           )
         )) FILTER (WHERE gi.id IS NOT NULL) AS items
       FROM grn g
       LEFT JOIN grn_item gi ON gi.grn_id=g.id
       LEFT JOIN product_variant pv ON gi.variant_id=pv.id
       LEFT JOIN product p ON pv.product_id=p.id
       WHERE g.id=$1 GROUP BY g.id`, [id]
    );
    return rows[0] || null;
  },

  async findGRNByNumber(branchId, grnNo) {
    const { rows } = await query(`SELECT * FROM grn WHERE branch_id=$1 AND grn_no=$2`, [branchId, grnNo]);
    return rows[0] || null;
  },

  /**
   * Create GRN + items + generate EAN-13 barcodes for each unit.
   * For 'bulk' type, barcodes are generated but not marked printed yet.
   */
  async createGRN(branchId, data, staffId) {
    return withTransaction(async (client) => {
      const { purchaseOrderId, type, referenceNo, receivedDate, notes, items } = data;

      // The supplier's invoice number is required so every GRN can be traced back to a bill
      if (!referenceNo || !referenceNo.trim()) {
        throw { status: 400, message: 'Reference number (supplier invoice no.) is required' };
      }

      // Resolve a valid staff.id for audit columns (adjusted_by, received_by).
      // Handles both login layers:
      //   shop-layer  → JWT id IS the staff.id  (s.id = staffId)
      //   platform-layer owner → JWT id is platform_user.id  (o.platform_user_id = staffId)
      // Also enforces ownership: owner can only create GRNs for their own branches.
      const { rows: staffLookup } = await client.query(
        `SELECT s.id FROM staff s
         JOIN branch b ON s.branch_id = b.id
         JOIN owner o ON b.owner_id = o.id
         WHERE s.branch_id = $1
           AND s.role = 'owner'
           AND (
             s.id = $2
             OR o.platform_user_id = $2
           )
         LIMIT 1`,
        [branchId, staffId]
      );
      const resolvedStaffId = staffLookup[0]?.id || null;

      if (!resolvedStaffId) {
        throw { status: 403, message: 'Access denied — you do not own this branch, or no staff record exists. Ensure the owner has a staff row for this branch.' };
      }

      // GRN numbers are generated from a sequence: GRN-000001, GRN-000002, ...
      const { rows: seqRows } = await client.query(`SELECT nextval('grn_sequence') AS seq`);
      const grnNo = 'GRN-' + String(seqRows[0].seq).padStart(6, '0');

      const { rows } = await client.query(
        `INSERT INTO grn (branch_id,purchase_order_id,grn_no,type,reference_no,received_date,notes,received_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [branchId, purchaseOrderId || null, grnNo, type, referenceNo.trim(), receivedDate || new Date(), notes, resolvedStaffId]
      );
      const grn = rows[0];

      for (const item of (items || [])) {
        const { rows: giRows } = await client.query(
          `INSERT INTO grn_item (grn_id,variant_id,quantity_received,unit_cost)
           VALUES ($1,$2,$3,$4) RETURNING *`,
          [grn.id, item.variantId, item.quantityReceived, item.unitCost]
        );
        const grnItem = giRows[0];

        const { rows: varRows } = await client.query(
          `SELECT pv.sku, pt.inventory_mode
           FROM product_variant pv
           JOIN product p ON p.id = pv.product_id
           JOIN product_type pt ON pt.id = p.product_type_id
           WHERE pv.id=$1`,
          [item.variantId]
        );
        const variantSku = varRows[0]?.sku || String(item.variantId);
        const isFabric = varRows[0]?.inventory_mode === 'continuous';

        // ── Barcodes ─────────────────────────────────────────────────────────
        // One EAN-13 label per garment, or one per roll for fabric.
        // Values come from a database sequence, so they are unique and scannable.
        const labelCount = isFabric ? (item.fabricRolls || item.quantityReceived) : item.quantityReceived;
        for (let n = 0; n < labelCount; n++) {
          const { rows: bcSeq } = await client.query(`SELECT nextval('barcode_sequence') AS seq`);
          const barcodeValue = generateEAN13(parseInt(bcSeq[0].seq, 10));
          await client.query(
            `INSERT INTO barcode (grn_item_id, barcode_value, is_sold, label_text, grn_id)
             VALUES ($1,$2,FALSE,$3,$4)`,
            [grnItem.id, barcodeValue, variantSku, grn.id]
          );
        }

        // ── Stock ────────────────────────────────────────────────────────────
        if (isFabric) {
          // Fabric is stocked by length: rolls × meters per roll
          const rolls = item.fabricRolls || item.quantityReceived;
          const metersPerRoll = item.fabricMetersPerRoll || item.quantityReceived;
          await client.query(
            `UPDATE product_variant SET stock_qty_continuous = stock_qty_continuous + $1 WHERE id=$2`,
            [rolls * metersPerRoll, item.variantId]
          );
          await client.query(
            `UPDATE grn_item SET fabric_rolls=$1, fabric_meters_per_roll=$2 WHERE id=$3`,
            [rolls, metersPerRoll, grnItem.id]
          );
        } else {
          await client.query(
            `UPDATE product_variant SET stock_qty = stock_qty + $1 WHERE id=$2`,
            [item.quantityReceived, item.variantId]
          );
        }

        // Stock adjustment audit — non-fatal. The savepoint stops a failed
        // insert from aborting the whole GRN transaction.
        try {
          await client.query('SAVEPOINT grn_audit');
          await client.query(
            `INSERT INTO stock_adjustment (branch_id,variant_id,adjusted_by,reason,quantity_change,reference_type,reference_id)
             VALUES ($1,$2,$3,'grn_receipt',$4,'grn',$5)`,
            [branchId, item.variantId, resolvedStaffId, item.quantityReceived, grn.id]
          );
          await client.query('RELEASE SAVEPOINT grn_audit');
        } catch (auditErr) {
          await client.query('ROLLBACK TO SAVEPOINT grn_audit').catch(() => {});
          console.warn('[GRN] stock_adjustment insert failed (non-fatal):', auditErr.message);
        }
      }

      // If individual GRN, mark all barcodes as printed
      if (type === 'individual') {
        await client.query(
          `UPDATE barcode SET is_printed=TRUE, printed_at=NOW()
           WHERE grn_item_id IN (SELECT id FROM grn_item WHERE grn_id=$1)`, [grn.id]
        );
        await client.query(`UPDATE grn_item SET barcodes_printed=TRUE WHERE grn_id=$1`, [grn.id]);
      }

      return grn;
    });
  },

  async updateGRN(id, data, staffId) {
    const { notes } = data;
    const { rows } = await query(
      `UPDATE grn SET notes=COALESCE($1,notes), updated_by=$2 WHERE id=$3 RETURNING *`,
      [notes, staffId, id]
    );
    return rows[0] || null;
  },

  async deleteGRN(id) {
    const { rowCount } = await query(`DELETE FROM grn WHERE id=$1`, [id]);
    return rowCount > 0;
  },

  // Mark a single barcode as printed (bulk GRN flow)
  async markBarcodePrinted(barcodeId) {
    const { rows } = await query(
      `UPDATE barcode SET is_printed=TRUE, printed_at=NOW() WHERE id=$1 RETURNING *`,
      [barcodeId]
    );
    return rows[0] || null;
  },

  async getBarcodesByGRNItem(grnItemId) {
    const { rows } = await query(
      `SELECT bc.id, bc.barcode_value, bc.label_text, bc.is_printed, bc.is_sold,
              p.name AS product_name, pv.price
       FROM barcode bc
       JOIN grn_item gi ON gi.id = bc.grn_item_id
       JOIN product_variant pv ON pv.id = gi.variant_id
       JOIN product p ON p.id = pv.product_id
       WHERE bc.grn_item_id = $1
       ORDER BY bc.id ASC`,
      [grnItemId]
    );
    return rows;
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

// Suppliers
router.get('/branches/:branchId/suppliers', authenticate, ALL, wrap(async (req, res) => ok(res, await repo.listSuppliers(req.params.branchId))));
router.post('/branches/:branchId/suppliers', authenticate, OM, wrap(async (req, res) => created(res, await repo.createSupplier(req.params.branchId, req.body))));
router.patch('/suppliers/:id', authenticate, OM, wrap(async (req, res) => { const d = await repo.updateSupplier(req.params.id, req.body); d ? ok(res, d) : notFound(res); }));
router.delete('/suppliers/:id', authenticate, OWN, wrap(async (req, res) => { const ok_ = await repo.deleteSupplier(req.params.id); ok_ ? noContent(res) : notFound(res); }));

// Purchase Orders
router.get('/branches/:branchId/purchase-orders', authenticate, ALL, wrap(async (req, res) => {
  const pg = parsePagination(req.query);
  const { rows, total } = await repo.listPOs(req.params.branchId, pg);
  ok(res, { items: rows, meta: paginationMeta(total, pg.page, pg.limit) });
}));
router.get('/purchase-orders/:id', authenticate, ALL, wrap(async (req, res) => { const d = await repo.findPOById(req.params.id); d ? ok(res, d) : notFound(res); }));
router.post('/branches/:branchId/purchase-orders', authenticate, ALL, wrap(async (req, res) => created(res, await repo.createPO(req.params.branchId, req.body, req.user.id))));
router.patch('/purchase-orders/:id', authenticate, OWN, wrap(async (req, res) => { const d = await repo.updatePO(req.params.id, req.body, req.user.id); d ? ok(res, d) : notFound(res); }));
router.delete('/purchase-orders/:id', authenticate, OWN, wrap(async (req, res) => { const ok_ = await repo.deletePO(req.params.id); ok_ ? noContent(res) : notFound(res); }));

// GRN
router.get('/branches/:branchId/grn', authenticate, ALL, wrap(async (req, res) => {
  const pg = parsePagination(req.query);
  const { rows, total } = await repo.listGRNs(req.params.branchId, pg);
  ok(res, { items: rows, meta: paginationMeta(total, pg.page, pg.limit) });
}));
router.get('/grn/:id', authenticate, ALL, wrap(async (req, res) => { const d = await repo.findGRNById(req.params.id); d ? ok(res, d) : notFound(res); }));
router.get('/grn/lookup/:branchId/:grnNo', authenticate, ALL, wrap(async (req, res) => { const d = await repo.findGRNByNumber(req.params.branchId, req.params.grnNo); d ? ok(res, d) : notFound(res); }));
router.post('/branches/:branchId/grn', authenticate, ALL, wrap(async (req, res) => created(res, await repo.createGRN(req.params.branchId, req.body, req.user.id))));
router.patch('/grn/:id', authenticate, OWN, wrap(async (req, res) => { const d = await repo.updateGRN(req.params.id, req.body, req.user.id); d ? ok(res, d) : notFound(res); }));
router.delete('/grn/:id', authenticate, OWN, wrap(async (req, res) => { const ok_ = await repo.deleteGRN(req.params.id); ok_ ? noContent(res) : notFound(res); }));

// Barcode print management
router.post('/barcodes/:id/printed', authenticate, ALL, wrap(async (req, res) => { const d = await repo.markBarcodePrinted(req.params.id); d ? ok(res, d) : notFound(res); }));
router.get('/grn-items/:id/barcodes', authenticate, ALL, wrap(async (req, res) => ok(res, await repo.getBarcodesByGRNItem(req.params.id))));

// ── ZPL/Browser barcode printing ─────────────────────────────────────────────
// GET /branches/:branchId/barcodes/printer-config
// Returns configured barcode printer connection string for this branch.
router.get('/branches/:branchId/barcodes/printer-config', authenticate, ALL, wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT connection_string, device_name FROM device_config
     WHERE branch_id=$1 AND device_type='barcode_printer' AND is_active=TRUE LIMIT 1`,
    [req.params.branchId]
  );
  ok(res, rows[0] || null);
}));

// POST /barcodes/:id/print  — TCP/ZPL to Zebra (Ethernet) or fallback mark-printed (USB)
router.post('/barcodes/:id/print', authenticate, ALL, wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT bc.id, bc.barcode_value, bc.is_printed,
            pv.sku, pv.price,
            p.name AS product_name,
            dc.connection_string
     FROM barcode bc
     JOIN grn_item gi ON gi.id = bc.grn_item_id
     JOIN product_variant pv ON pv.id = gi.variant_id
     JOIN product p ON p.id = pv.product_id
     JOIN branch b ON b.id = p.branch_id
     LEFT JOIN device_config dc ON dc.branch_id = b.id AND dc.device_type='barcode_printer' AND dc.is_active=TRUE
     WHERE bc.id = $1`, [req.params.id]
  );
  if (!rows[0]) return notFound(res);
  const bc = rows[0];
  const conn = bc.connection_string;
  if (!conn || !conn.includes(':') || conn.toUpperCase().startsWith('USB')) {
    await query(`UPDATE barcode SET is_printed=TRUE, printed_at=NOW() WHERE id=$1`, [req.params.id]);
    return ok(res, { printed: true, warning: 'Barcode printer not configured for network printing. Marked as printed.' });
  }
  const net = require('net');
  const [ip, port] = conn.split(':');
  const name = (bc.product_name || '').slice(0, 30);
  const sku = (bc.sku || '').slice(0, 28);
  const zpl = [
    '^XA', '^PW330', '^LL240', '^CI28',
    `^FO20,10^BY2^BCN,80,Y,N,N^FD${bc.barcode_value}^FS`,
    `^FO20,105^A0N,18,18^FD${name}^FS`,
    `^FO20,128^A0N,14,14^FD${sku}^FS`,
    bc.price ? `^FO230,128^A0N,14,14^FDRs ${Number(bc.price).toLocaleString()}^FS` : '',
    '^XZ',
  ].filter(Boolean).join('\n');
  await new Promise((resolve, reject) => {
    const socket = require('net').Socket();
    const t = setTimeout(() => { socket.destroy(); reject(new Error('Printer timeout')); }, 6000);
    socket.connect(parseInt(port) || 9100, ip, () => socket.write(zpl, 'utf8', () => socket.end()));
    socket.on('close', () => { clearTimeout(t); resolve(); });
    socket.on('error', err => { clearTimeout(t); reject(err); });
  });
  await query(`UPDATE barcode SET is_printed=TRUE, printed_at=NOW() WHERE id=$1`, [req.params.id]);
  ok(res, { printed: true, barcode: bc.barcode_value });
}));

// POST /grn/:id/print-all  — print all unprinted labels for a GRN
router.post('/grn/:id/print-all', authenticate, ALL, wrap(async (req, res) => {
  const { rows: barcodes } = await query(
    `SELECT bc.id, bc.barcode_value, pv.sku, pv.price, p.name AS product_name, dc.connection_string
     FROM barcode bc
     JOIN grn_item gi ON gi.grn_id=$1 AND gi.id=bc.grn_item_id
     JOIN product_variant pv ON pv.id=gi.variant_id
     JOIN product p ON p.id=pv.product_id
     JOIN branch b ON b.id=p.branch_id
     LEFT JOIN device_config dc ON dc.branch_id=b.id AND dc.device_type='barcode_printer' AND dc.is_active=TRUE
     ORDER BY bc.barcode_value ASC`, [req.params.id]
  );
  if (!barcodes.length) return ok(res, { total: 0, printed: 0, failed: 0, message: 'No barcodes found' });
  const conn = barcodes[0].connection_string;
  if (!conn || !conn.includes(':') || conn.toUpperCase().startsWith('USB')) {
    await query(`UPDATE barcode SET is_printed=TRUE, printed_at=NOW() WHERE grn_item_id IN (SELECT id FROM grn_item WHERE grn_id=$1)`, [req.params.id]);
    await query(`UPDATE grn_item SET barcodes_printed=TRUE WHERE grn_id=$1`, [req.params.id]);
    return ok(res, { total: barcodes.length, printed: barcodes.length, failed: 0, warning: 'USB mode — marked as printed without sending to printer.' });
  }
  const [ip, port] = conn.split(':');
  let printed = 0, failed = 0; const warnings = [];
  for (const bc of barcodes) {
    try {
      const name = (bc.product_name || '').slice(0, 30), sku = (bc.sku || '').slice(0, 28);
      const zpl = ['^XA', '^PW330', '^LL240', '^CI28', `^FO20,10^BY2^BCN,80,Y,N,N^FD${bc.barcode_value}^FS`, `^FO20,105^A0N,18,18^FD${name}^FS`, `^FO20,128^A0N,14,14^FD${sku}^FS`, '^XZ'].join('\n');
      await new Promise((resolve, reject) => {
        const s = require('net').Socket(); const t = setTimeout(() => { s.destroy(); reject(new Error('timeout')); }, 6000);
        s.connect(parseInt(port) || 9100, ip, () => s.write(zpl, 'utf8', () => s.end()));
        s.on('close', () => { clearTimeout(t); resolve(); }); s.on('error', e => { clearTimeout(t); reject(e); });
      });
      await query(`UPDATE barcode SET is_printed=TRUE, printed_at=NOW() WHERE id=$1`, [bc.id]);
      printed++; await new Promise(r => setTimeout(r, 150));
    } catch (e) { failed++; warnings.push(`${bc.barcode_value}: ${e.message}`); }
  }
  if (printed > 0) await query(`UPDATE grn_item SET barcodes_printed=TRUE WHERE grn_id=$1`, [req.params.id]);
  ok(res, { total: barcodes.length, printed, failed, warnings });
}));

module.exports = router;
