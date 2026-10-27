// ── Shared discount resolver ──────────────────────────────────────────────────
// Used by both product.routes (lookup) and billing.routes (checkout).
// Priority: seasonal > bulk > none. Never combine.

const { query } = require('../db/pool');

async function resolveDiscount(variantId, basePrice, branchId) {
    if (!basePrice || basePrice <= 0 || !branchId) {
        return { discountedPrice: basePrice, discountApplied: 0, discountId: null, discountSource: 'none' };
    }

    // 1. Seasonal discount — by brand of this variant's product
    const { rows: seasonal } = await query(
        `SELECT d.id, d.value_type, d.value,
            sd.condition_min_price, sd.condition_value
     FROM discount d
     JOIN seasonal_discount sd ON sd.discount_id = d.id
     JOIN product p ON p.brand_id = sd.brand_id
     JOIN product_variant pv ON pv.product_id = p.id
     WHERE pv.id = $1
       AND d.branch_id = $2
       AND d.is_active = TRUE
       AND (d.valid_from  IS NULL OR d.valid_from  <= NOW())
       AND (d.valid_until IS NULL OR d.valid_until >= NOW())
     ORDER BY d.created_at DESC
     LIMIT 1`,
        [variantId, branchId]
    );

    if (seasonal[0]) {
        const s = seasonal[0];
        const meetsCondition = !s.condition_min_price || basePrice >= parseFloat(s.condition_min_price);
        if (meetsCondition) {
            const effectiveValue = parseFloat(s.condition_value || s.value);
            const applied = s.value_type === 'percentage'
                ? Math.round(basePrice * effectiveValue / 100)
                : effectiveValue;
            const capped = Math.min(applied, basePrice);
            return {
                discountedPrice: basePrice - capped,
                discountApplied: capped,
                discountId: s.id,
                discountSource: 'seasonal',
            };
        }
    }

    // 2. Bulk discount — variant received in a GRN that has a bulk_discount
    const { rows: bulk } = await query(
        `SELECT d.id, d.value_type, d.value
     FROM discount d
     JOIN bulk_discount bd ON bd.discount_id = d.id
     JOIN grn g ON g.id = bd.grn_id
     JOIN grn_item gi ON gi.grn_id = g.id
     WHERE gi.variant_id = $1
       AND d.branch_id = $2
       AND d.is_active = TRUE
       AND (d.valid_from  IS NULL OR d.valid_from  <= NOW())
       AND (d.valid_until IS NULL OR d.valid_until >= NOW())
     ORDER BY d.created_at DESC
     LIMIT 1`,
        [variantId, branchId]
    );

    if (bulk[0]) {
        const b = bulk[0];
        const effectiveValue = parseFloat(b.value);
        const applied = b.value_type === 'percentage'
            ? Math.round(basePrice * effectiveValue / 100)
            : effectiveValue;
        const capped = Math.min(applied, basePrice);
        return {
            discountedPrice: basePrice - capped,
            discountApplied: capped,
            discountId: b.id,
            discountSource: 'bulk',
        };
    }

    return { discountedPrice: basePrice, discountApplied: 0, discountId: null, discountSource: 'none' };
}

module.exports = resolveDiscount;
