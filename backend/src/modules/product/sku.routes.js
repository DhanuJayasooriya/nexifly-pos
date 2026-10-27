// ════════════════════════════════════════════════════════════════════════════
// SKU MODULE
//
// POST /branches/:branchId/sku/suggest
//   Pure computation — builds SKU string, NO DB write, NO sequence.
//   Returns: { suggestedSku }
//
// GET  /branches/:branchId/sku/check?sku=EBN-TR-28W-BLK
//   Checks if SKU already exists in this branch.
//   Returns: { exists, variant? }
//
// POST /branches/:branchId/sku/next  (kept for backwards compatibility)
//   Same as suggest but also increments sku_sequence in DB.
// ════════════════════════════════════════════════════════════════════════════

const router = require('express').Router();
const { query } = require('../../db/pool');
const { ok, badRequest } = require('../../utils/response');
const { authenticate, authorize } = require('../../middleware/auth');

// ── Abbreviation maps ─────────────────────────────────────────────────────────
const CAT_MAP = {
    'shirts': 'SH', 'shirt': 'SH',
    'jeans': 'JN', 'jean': 'JN',
    'trousers': 'TR', 'trouser': 'TR',
    'blazers': 'BL', 'blazer': 'BL',
    'suits': 'ST', 'suit': 'ST',
    'shoes': 'SH', 'shoe': 'SH',
    'ties': 'TI', 'tie': 'TI',
    'accessories': 'AC', 'accessory': 'AC',
    'fabric': 'FB',
    'denim': 'DN',
    'shorts': 'SR',
    'jackets': 'JK', 'jacket': 'JK',
    'tshirts': 'TS', 't-shirts': 'TS',
    'polo': 'PO',
};

const COLOR_MAP = {
    'white': 'WHT', 'black': 'BLK',
    'navy': 'NVY', 'powder blue': 'PBL',
    'sky blue': 'SKB', 'olive green': 'OLV',
    'magenta': 'MAG', 'charcoal': 'CHR',
    'cream': 'CRM', 'red': 'RED',
    'brown': 'BRN', 'grey': 'GRY',
    'gray': 'GRY', 'green': 'GRN',
    'yellow': 'YLW', 'pink': 'PNK',
    'purple': 'PRP', 'orange': 'ORG',
};

function brandPrefix(name) {
    if (!name) return 'GEN';
    const clean = name.trim().toUpperCase().replace(/[^A-Z]/g, '');
    return clean.length <= 3 ? clean.padEnd(3, 'X') : clean.slice(0, 3);
}

function catPrefix(name) {
    if (!name) return 'XX';
    const key = name.trim().toLowerCase();
    if (CAT_MAP[key]) return CAT_MAP[key];
    return name.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2).padEnd(2, 'X');
}

function colorCode(color) {
    if (!color) return null;
    return COLOR_MAP[color.toLowerCase()] || color.toUpperCase().replace(/\s+/g, '').slice(0, 3);
}

// Builds SKU WITHOUT sequence number — sequence belongs on barcode labels, not product SKU
function buildSku({ brandName, categoryName, productType, size, color, material }) {
    const bp = brandPrefix(brandName);
    const cp = catPrefix(categoryName);
    const parts = [bp];

    if (productType === 'rental') {
        parts.push('RNT');
        parts.push(cp);
        if (size) parts.push(size.replace(/["\s]/g, '').toUpperCase().slice(0, 4));
    } else if (productType === 'fabric') {
        parts.push('FB');
        if (material) parts.push(material.toUpperCase().slice(0, 3));
        const c = colorCode(color);
        if (c) parts.push(c);
    } else {
        parts.push(cp);
        if (size) parts.push(size.replace(/["\s]/g, '').toUpperCase().slice(0, 5));
        const c = colorCode(color);
        if (c) parts.push(c);
    }

    return parts.join('-');
}

// ── POST /branches/:branchId/sku/suggest ──────────────────────────────────────
// Pure computation — no DB writes. Safe to call any time.
router.post('/branches/:branchId/sku/suggest', authenticate, async (req, res, next) => {
    try {
        const { brandName, categoryName, productType, size, color, material } = req.body;
        if (!brandName || !categoryName)
            return badRequest(res, 'brandName and categoryName are required');
        const suggestedSku = buildSku({ brandName, categoryName, productType, size, color, material });
        return ok(res, { suggestedSku });
    } catch (err) { next(err); }
});

// ── GET /branches/:branchId/sku/check?sku=EBN-TR-28W-BLK ─────────────────────
// Check if a variant with this SKU already exists in this branch.
router.get('/branches/:branchId/sku/check', authenticate, async (req, res, next) => {
    try {
        const { branchId } = req.params;
        const { sku } = req.query;
        if (!sku) return badRequest(res, 'sku query param is required');

        const { rows } = await query(
            `SELECT pv.id, pv.sku, pv.stock_qty,
                    p.id AS product_id, p.name AS product_name,
                    b.name AS brand_name, cat.name AS category_name
             FROM product_variant pv
             JOIN product p ON pv.product_id = p.id
             LEFT JOIN brand b   ON p.brand_id    = b.id
             LEFT JOIN category cat ON p.category_id = cat.id
             WHERE pv.sku = $1 AND p.branch_id = $2`,
            [sku, branchId]
        );

        return rows[0]
            ? ok(res, { exists: true, variant: rows[0] })
            : ok(res, { exists: false });
    } catch (err) { next(err); }
});

// ── POST /branches/:branchId/sku/next (backwards compat) ─────────────────────
// Old endpoint — still increments sku_sequence so existing code doesn't break.
router.post('/branches/:branchId/sku/next', authenticate,
    authorize('owner', 'manager', 'cashier'),
    async (req, res, next) => {
        try {
            const { branchId } = req.params;
            const { brandName, categoryName, productType, size, color, material } = req.body;
            if (!brandName || !categoryName)
                return badRequest(res, 'brandName and categoryName are required');

            const bp = brandPrefix(brandName);
            const cp = catPrefix(categoryName);

            const { rows } = await query(
                `INSERT INTO sku_sequence (branch_id, brand_prefix, cat_prefix, next_seq)
                 VALUES ($1, $2, $3, 2)
                 ON CONFLICT (branch_id, brand_prefix, cat_prefix)
                 DO UPDATE SET next_seq = sku_sequence.next_seq + 1
                 RETURNING next_seq - 1 AS sequence`,
                [branchId, bp, cp]
            );

            const suggestedSku = buildSku({ brandName, categoryName, productType, size, color, material });
            return ok(res, { sequence: rows[0].sequence, brandPrefix: bp, catPrefix: cp, suggestedSku });
        } catch (err) { next(err); }
    }
);

// Export router directly (not wrapped) so app.js can use it as before
module.exports = router;
