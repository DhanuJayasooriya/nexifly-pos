// ════════════════════════════════════════════════════════════════════════════
// PRODUCT MODULE
// ════════════════════════════════════════════════════════════════════════════
const router = require('express').Router();
const resolveDiscount = require('../../utils/resolveDiscount');
const { query } = require('../../db/pool');
const { withTransaction } = require('../../db/transaction');
const { ok, created, noContent, notFound } = require('../../utils/response');
const { authenticate, authorize } = require('../../middleware/auth');
const { parsePagination, paginationMeta } = require('../../utils/pagination');

// ── Repository ────────────────────────────────────────────────────────────────

const repo = {
  // Brands
  async listBrands(branchId) {
    const { rows } = await query(`SELECT * FROM brand WHERE branch_id=$1 AND is_active=TRUE ORDER BY name`, [branchId]);
    return rows;
  },
  async createBrand(branchId, name) {
    const { rows } = await query(`INSERT INTO brand (branch_id,name) VALUES ($1,$2) RETURNING *`, [branchId, name]);
    return rows[0];
  },
  async updateBrand(id, data) {
    const { rows } = await query(
      `UPDATE brand SET name=COALESCE($1,name), is_active=COALESCE($2,is_active) WHERE id=$3 RETURNING *`,
      [data.name, data.isActive, id]
    );
    return rows[0] || null;
  },
  async deleteBrand(id) {
    const { rowCount } = await query(`DELETE FROM brand WHERE id=$1`, [id]);
    return rowCount > 0;
  },

  // Categories
  async listCategories(branchId) {
    const { rows } = await query(
      `SELECT c.*, p.name AS parent_name FROM category c
       LEFT JOIN category p ON c.parent_id=p.id
       WHERE c.branch_id=$1 ORDER BY c.name`, [branchId]
    );
    return rows;
  },
  async createCategory(branchId, data) {
    const { rows } = await query(
      `INSERT INTO category (branch_id,name,parent_id) VALUES ($1,$2,$3) RETURNING *`,
      [branchId, data.name, data.parentId || null]
    );
    return rows[0];
  },
  async updateCategory(id, data) {
    const { rows } = await query(
      `UPDATE category SET name=COALESCE($1,name), parent_id=COALESCE($2,parent_id) WHERE id=$3 RETURNING *`,
      [data.name, data.parentId, id]
    );
    return rows[0] || null;
  },
  async deleteCategory(id) {
    const { rowCount } = await query(`DELETE FROM category WHERE id=$1`, [id]);
    return rowCount > 0;
  },

  // Attribute types + values
  async listAttributeTypes(branchId) {
    const { rows } = await query(
      `SELECT at.*, json_agg(json_build_object('id',av.id,'value',av.value,'displayLabel',av.display_label)
         ORDER BY av.value) FILTER (WHERE av.id IS NOT NULL) AS values
       FROM attribute_type at
       LEFT JOIN attribute_value av ON av.attribute_type_id=at.id
       WHERE at.branch_id=$1 GROUP BY at.id ORDER BY at.name`, [branchId]
    );
    return rows;
  },
  async createAttributeType(branchId, name) {
    const { rows } = await query(
      `INSERT INTO attribute_type (branch_id,name) VALUES ($1,$2) RETURNING *`, [branchId, name]
    );
    return rows[0];
  },
  async createAttributeValue(typeId, data) {
    const { rows } = await query(
      `INSERT INTO attribute_value (attribute_type_id,value,display_label) VALUES ($1,$2,$3) RETURNING *`,
      [typeId, data.value, data.displayLabel || data.value]
    );
    return rows[0];
  },
  async updateAttributeValue(id, data) {
    const { rows } = await query(
      `UPDATE attribute_value SET value=COALESCE($1,value), display_label=COALESCE($2,display_label) WHERE id=$3 RETURNING *`,
      [data.value, data.displayLabel, id]
    );
    return rows[0] || null;
  },
  async deleteAttributeValue(id) {
    const { rowCount } = await query(`DELETE FROM attribute_value WHERE id=$1`, [id]);
    return rowCount > 0;
  },

  // Products
  async listProducts(branchId, filters) {
    const { limit, offset, search, brandId, categoryId, isActive } = filters;
    const conditions = ['p.branch_id=$1'];
    const params = [branchId];
    let i = 2;

    if (search) { conditions.push(`(p.name ILIKE $${i} OR p.sku ILIKE $${i})`); params.push(`%${search}%`); i++; }
    if (brandId) { conditions.push(`p.brand_id=$${i}`); params.push(brandId); i++; }
    if (categoryId) { conditions.push(`p.category_id=$${i}`); params.push(categoryId); i++; }
    if (isActive !== undefined) { conditions.push(`p.is_active=$${i}`); params.push(isActive); i++; }

    const where = conditions.join(' AND ');
    const { rows } = await query(
      `SELECT p.*, b.name AS brand_name, c.name AS category_name, pt.name AS type_name,
              pt.inventory_mode, pt.is_rentable,
              COALESCE((
                SELECT SUM(pv.stock_qty) FROM product_variant pv WHERE pv.product_id = p.id
              ), 0) AS total_stock,
              COALESCE((
                SELECT SUM(pv.stock_qty_continuous) FROM product_variant pv WHERE pv.product_id = p.id
              ), 0) AS total_stock_continuous,
              (
                SELECT MIN(pv.price) FROM product_variant pv WHERE pv.product_id = p.id
              ) AS price,
              (
                SELECT MIN(pv.price) FROM product_variant pv WHERE pv.product_id = p.id
              ) AS base_selling_price,
              (
                SELECT MIN(pv.low_stock_threshold) FROM product_variant pv WHERE pv.product_id = p.id
              ) AS low_stock_threshold,
              (
                SELECT MIN(pv.rental_price_per_day) FROM product_variant pv WHERE pv.product_id = p.id
              ) AS rental_price_per_day
       FROM product p
       LEFT JOIN brand b ON p.brand_id=b.id
       LEFT JOIN category c ON p.category_id=c.id
       JOIN product_type pt ON p.product_type_id=pt.id
       WHERE ${where} ORDER BY p.name LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );
    const { rows: t } = await query(`SELECT COUNT(*) FROM product p WHERE ${where}`, params);
    return { rows, total: parseInt(t[0].count) };
  },

  async findProductById(id) {
    const { rows } = await query(
      `SELECT p.*, b.name AS brand_name, c.name AS category_name, pt.name AS type_name,
              pt.inventory_mode, pt.is_rentable, pt.base_unit
       FROM product p
       LEFT JOIN brand b ON p.brand_id=b.id
       LEFT JOIN category c ON p.category_id=c.id
       JOIN product_type pt ON p.product_type_id=pt.id
       WHERE p.id=$1`, [id]
    );
    return rows[0] || null;
  },

  async createProduct(data) {
    const { branchId, brandId, categoryId, productTypeId, name, sku, description } = data;
    const { rows } = await query(
      `INSERT INTO product (branch_id,brand_id,category_id,product_type_id,name,sku,description)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [branchId, brandId, categoryId, productTypeId, name, sku, description]
    );
    return rows[0];
  },

  async updateProduct(id, data) {
    const { brandId, categoryId, name, sku, description, isActive } = data;
    const { rows } = await query(
      `UPDATE product SET brand_id=COALESCE($1,brand_id), category_id=COALESCE($2,category_id),
       name=COALESCE($3,name), sku=COALESCE($4,sku), description=COALESCE($5,description),
       is_active=COALESCE($6,is_active), updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [brandId, categoryId, name, sku, description, isActive, id]
    );
    return rows[0] || null;
  },

  async deleteProduct(id) {
    return withTransaction(async (client) => {
      const { rows: variants } = await client.query(
        `SELECT id FROM product_variant WHERE product_id=$1`, [id]
      );
      const variantIds = variants.map((v) => v.id);

      if (variantIds.length) {
        // Sales, returns and rentals are financial records: never delete them.
        // A product with history should be deactivated instead (PATCH isActive=false).
        const { rows: history } = await client.query(
          `SELECT
             (SELECT COUNT(*) FROM sale_item   WHERE variant_id = ANY($1)) +
             (SELECT COUNT(*) FROM return_item WHERE variant_id = ANY($1)) +
             (SELECT COUNT(*) FROM rental      WHERE variant_id = ANY($1)) AS n`,
          [variantIds]
        );
        if (parseInt(history[0].n) > 0) {
          throw {
            status: 409,
            message: 'This product has sales or rental history and cannot be deleted. Deactivate it instead.',
          };
        }

        // No history: remove stock and receiving records that belong only to this product
        await client.query(
          `DELETE FROM barcode WHERE grn_item_id IN (SELECT id FROM grn_item WHERE variant_id = ANY($1))`,
          [variantIds]
        );
        await client.query(`DELETE FROM grn_item            WHERE variant_id = ANY($1)`, [variantIds]);
        await client.query(`DELETE FROM variant_attribute   WHERE variant_id = ANY($1)`, [variantIds]);
        await client.query(`DELETE FROM bill_session_item   WHERE variant_id = ANY($1)`, [variantIds]);
        await client.query(`DELETE FROM purchase_order_item WHERE variant_id = ANY($1)`, [variantIds]);
        await client.query(`DELETE FROM measurable_stock    WHERE variant_id = ANY($1)`, [variantIds]);
        await client.query(`DELETE FROM stock_adjustment    WHERE variant_id = ANY($1)`, [variantIds]);
        await client.query(`DELETE FROM product_variant     WHERE product_id = $1`, [id]);
      }

      const { rowCount } = await client.query(`DELETE FROM product WHERE id=$1`, [id]);
      return rowCount > 0;
    });
  },

  // Variants
  async listVariants(productId) {
    const { rows } = await query(
      `SELECT pv.*,
         json_agg(json_build_object(
           'typeId', at.id, 'typeName', at.name,
           'valueId', av.id, 'value', av.value
         )) FILTER (WHERE av.id IS NOT NULL) AS attributes
       FROM product_variant pv
       LEFT JOIN variant_attribute va ON va.variant_id=pv.id
       LEFT JOIN attribute_value av ON av.id=va.attribute_value_id
       LEFT JOIN attribute_type at ON at.id=av.attribute_type_id
       WHERE pv.product_id=$1
       GROUP BY pv.id ORDER BY pv.sku`, [productId]
    );
    return rows;
  },

  async findVariantByBarcode(barcode) {
    // Match by barcode_value OR label_text (handles both EAN-13 and human labels)
    const { rows } = await query(
      `SELECT pv.*, pv.price AS base_selling_price, p.name AS product_name,
              pt.is_rentable, pt.inventory_mode, b.name AS brand_name, p.branch_id,
              bc.barcode_value, bc.label_text, bc.is_sold
       FROM barcode bc
       JOIN grn_item gi ON bc.grn_item_id=gi.id
       JOIN product_variant pv ON gi.variant_id=pv.id
       JOIN product p ON pv.product_id=p.id
       JOIN product_type pt ON p.product_type_id=pt.id
       LEFT JOIN brand b ON p.brand_id=b.id
       WHERE (bc.barcode_value=$1 OR bc.label_text=$1)
       LIMIT 1`, [barcode]
    );
    return rows[0] || null;
  },

  async findVariantBySku(sku) {
    const { rows } = await query(
      `SELECT pv.*, pv.price AS base_selling_price,
              p.name AS product_name, pt.is_rentable, pt.inventory_mode,
              b.name AS brand_name, p.branch_id
       FROM product_variant pv
       JOIN product p ON pv.product_id=p.id
       JOIN product_type pt ON p.product_type_id=pt.id
       LEFT JOIN brand b ON p.brand_id=b.id
       WHERE pv.sku=$1`, [sku]
    );
    return rows[0] || null;
  },

  async createVariant(data) {
    const { productId, sku, price, costPrice, rentalPricePerDay, stockQty,
      stockQtyContinuous, lowStockThreshold, attributeValueIds,
      size, color, material, style,
      fabricWidth, fabricUnit, fabricDesign } = data;

    const { rows: prodRows } = await query(`SELECT branch_id FROM product WHERE id=$1`, [productId]);
    const branchId = prodRows[0]?.branch_id;

    const { rows } = await query(
      `INSERT INTO product_variant
         (product_id,sku,price,cost_price,rental_price_per_day,stock_qty,
          stock_qty_continuous,low_stock_threshold,rental_status,
          fabric_width,fabric_unit,fabric_design)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'available',$9,$10,$11) RETURNING *`,
      [productId, sku, price, costPrice, rentalPricePerDay,
        stockQty || 0, stockQtyContinuous || 0, lowStockThreshold || 5,
        fabricWidth || null, fabricUnit || 'm', fabricDesign || null]
    );
    const variant = rows[0];

    // Link attribute values chosen by id
    if (attributeValueIds?.length) {
      for (const avId of attributeValueIds) {
        await query(
          `INSERT INTO variant_attribute (variant_id,attribute_value_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [variant.id, avId]
        );
      }
    }

    // Link attributes sent as plain text (size, color, ...). Types and values are
    // created on first use, so new sizes or colours don't need to be set up first.
    const namedAttributes = { Size: size, Color: color, Material: material, Style: style };
    for (const [typeName, rawValue] of Object.entries(namedAttributes)) {
      const value = rawValue?.trim();
      if (!value || !branchId) continue;

      const { rows: newType } = await query(
        `INSERT INTO attribute_type (branch_id, name) VALUES ($1,$2)
         ON CONFLICT DO NOTHING RETURNING id`, [branchId, typeName]
      );
      let typeId = newType[0]?.id;
      if (!typeId) {
        const { rows: existing } = await query(
          `SELECT id FROM attribute_type WHERE branch_id=$1 AND name=$2`, [branchId, typeName]
        );
        typeId = existing[0]?.id;
      }
      if (!typeId) continue;

      const { rows: newValue } = await query(
        `INSERT INTO attribute_value (attribute_type_id, value, display_label) VALUES ($1,$2,$2)
         ON CONFLICT DO NOTHING RETURNING id`, [typeId, value]
      );
      let valueId = newValue[0]?.id;
      if (!valueId) {
        const { rows: existing } = await query(
          `SELECT id FROM attribute_value WHERE attribute_type_id=$1 AND value=$2`, [typeId, value]
        );
        valueId = existing[0]?.id;
      }
      if (!valueId) continue;

      await query(
        `INSERT INTO variant_attribute (variant_id, attribute_value_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [variant.id, valueId]
      );
    }

    return variant;
  },

  async updateVariant(id, data) {
    const { price, costPrice, rentalPricePerDay, stockQty, lowStockThreshold, isActive } = data;
    const { rows } = await query(
      `UPDATE product_variant SET
         price=COALESCE($1,price), cost_price=COALESCE($2,cost_price),
         rental_price_per_day=COALESCE($3,rental_price_per_day),
         stock_qty=COALESCE($4,stock_qty),
         low_stock_threshold=COALESCE($5,low_stock_threshold),
         is_active=COALESCE($6,is_active)
       WHERE id=$7 RETURNING *`,
      [price, costPrice, rentalPricePerDay, stockQty, lowStockThreshold, isActive, id]
    );
    return rows[0] || null;
  },

  async deleteVariant(id) {
    const { rowCount } = await query(`DELETE FROM product_variant WHERE id=$1`, [id]);
    return rowCount > 0;
  },

  async listProductTypes() {
    const { rows } = await query(`SELECT * FROM product_type ORDER BY name`);
    return rows;
  },
};

// ── Controller + Routes ───────────────────────────────────────────────────────

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

// Product types (read-only reference data)
router.get('/product-types', authenticate, ALL, wrap(async (req, res) => ok(res, await repo.listProductTypes())));

// Brands
router.get('/branches/:branchId/brands', authenticate, ALL, wrap(async (req, res) => ok(res, await repo.listBrands(req.params.branchId))));
router.post('/branches/:branchId/brands', authenticate, OM, wrap(async (req, res) => created(res, await repo.createBrand(req.params.branchId, req.body.name))));
router.patch('/brands/:id', authenticate, OM, wrap(async (req, res) => { const d = await repo.updateBrand(req.params.id, req.body); d ? ok(res, d) : notFound(res); }));
router.delete('/brands/:id', authenticate, OWN, wrap(async (req, res) => { const ok_ = await repo.deleteBrand(req.params.id); ok_ ? noContent(res) : notFound(res); }));

// Categories
router.get('/branches/:branchId/categories', authenticate, ALL, wrap(async (req, res) => ok(res, await repo.listCategories(req.params.branchId))));
router.post('/branches/:branchId/categories', authenticate, OM, wrap(async (req, res) => created(res, await repo.createCategory(req.params.branchId, req.body))));
router.patch('/categories/:id', authenticate, OM, wrap(async (req, res) => { const d = await repo.updateCategory(req.params.id, req.body); d ? ok(res, d) : notFound(res); }));
router.delete('/categories/:id', authenticate, OWN, wrap(async (req, res) => { const ok_ = await repo.deleteCategory(req.params.id); ok_ ? noContent(res) : notFound(res); }));

// Attribute types + values
router.get('/branches/:branchId/attribute-types', authenticate, ALL, wrap(async (req, res) => ok(res, await repo.listAttributeTypes(req.params.branchId))));
router.post('/branches/:branchId/attribute-types', authenticate, OM, wrap(async (req, res) => created(res, await repo.createAttributeType(req.params.branchId, req.body.name))));
router.post('/attribute-types/:typeId/values', authenticate, OM, wrap(async (req, res) => created(res, await repo.createAttributeValue(req.params.typeId, req.body))));
router.patch('/attribute-values/:id', authenticate, OM, wrap(async (req, res) => { const d = await repo.updateAttributeValue(req.params.id, req.body); d ? ok(res, d) : notFound(res); }));
router.delete('/attribute-values/:id', authenticate, OWN, wrap(async (req, res) => { const ok_ = await repo.deleteAttributeValue(req.params.id); ok_ ? noContent(res) : notFound(res); }));

// Products
router.get('/branches/:branchId/products', authenticate, ALL, wrap(async (req, res) => {
  const pg = parsePagination(req.query);
  const { rows, total } = await repo.listProducts(req.params.branchId, { ...pg, ...req.query });
  ok(res, { items: rows, meta: paginationMeta(total, pg.page, pg.limit) });
}));
router.get('/products/:id', authenticate, ALL, wrap(async (req, res) => { const d = await repo.findProductById(req.params.id); d ? ok(res, d) : notFound(res); }));
router.post('/branches/:branchId/products', authenticate, OM, wrap(async (req, res) => created(res, await repo.createProduct({ ...req.body, branchId: req.params.branchId }))));
router.patch('/products/:id', authenticate, OM, wrap(async (req, res) => { const d = await repo.updateProduct(req.params.id, req.body); d ? ok(res, d) : notFound(res); }));
router.delete('/products/:id', authenticate, OWN, wrap(async (req, res) => { const ok_ = await repo.deleteProduct(req.params.id); ok_ ? noContent(res) : notFound(res); }));

// Variants
router.get('/products/:productId/variants', authenticate, ALL, wrap(async (req, res) => ok(res, await repo.listVariants(req.params.productId))));
router.post('/products/:productId/variants', authenticate, OM, wrap(async (req, res) => created(res, await repo.createVariant({ ...req.body, productId: req.params.productId }))));
router.patch('/variants/:id', authenticate, OM, wrap(async (req, res) => { const d = await repo.updateVariant(req.params.id, req.body); d ? ok(res, d) : notFound(res); }));
router.delete('/variants/:id', authenticate, OWN, wrap(async (req, res) => { const ok_ = await repo.deleteVariant(req.params.id); ok_ ? noContent(res) : notFound(res); }));

// Barcode / SKU lookup (used by billing)
router.get('/lookup/barcode/:barcode', authenticate, ALL, wrap(async (req, res) => {
  const variant = await repo.findVariantByBarcode(req.params.barcode);
  if (!variant) return notFound(res, 'Barcode not found');
  try {
    const branchId = req.query.branchId || variant.branch_id;
    const basePrice = parseFloat(variant.price || variant.base_selling_price || 0);
    const discount = await resolveDiscount(variant.id, basePrice, branchId, null);
    return ok(res, { ...variant, ...discount });
  } catch (e) {
    return ok(res, { ...variant, discountedPrice: parseFloat(variant.price || variant.base_selling_price || 0), discountApplied: 0, discountSource: 'none' });
  }
}));
router.get('/lookup/sku/:sku', authenticate, ALL, wrap(async (req, res) => {
  const variant = await repo.findVariantBySku(req.params.sku);
  if (!variant) return notFound(res, 'SKU not found');
  try {
    const branchId = req.query.branchId || variant.branch_id;
    const basePrice = parseFloat(variant.price || variant.base_selling_price || 0);
    const discount = await resolveDiscount(variant.id, basePrice, branchId, null);
    return ok(res, { ...variant, ...discount });
  } catch (e) {
    // Discount resolver failed — return variant without discount
    return ok(res, { ...variant, discountedPrice: parseFloat(variant.price || variant.base_selling_price || 0), discountApplied: 0, discountSource: 'none' });
  }
}));

// ── Barcode search for billing suggestions ───────────────────────────────────
// GET /branches/:branchId/variants/search?q=EBO
//
// Returns the next available (unsold) barcode labels for matching variants.
// Logic:
//   1. Find variants matching the query (SKU, product name, brand)
//   2. For each variant, total barcodes = COUNT(barcode rows)
//      available barcodes = stock_qty (decremented on each sale)
//   3. The LAST stock_qty barcodes (by barcode_value ASC) are the ones still in hand
//   4. Return up to 5 of those barcode values per matching variant
//
// Example: EBO-SH-M-WHT has 10 barcodes, stock_qty=5
//   → barcodes 001-005 sold, 006-010 available → suggest 006..010
router.get('/branches/:branchId/variants/search', authenticate, ALL, wrap(async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 1) return ok(res, []);

  // Find matching variants by SKU, product name, or brand name
  const { rows: variants } = await query(
    `SELECT pv.id, pv.sku, pv.price, pv.price AS base_selling_price,
            pv.stock_qty, pv.stock_qty_continuous, pv.low_stock_threshold, pv.rental_price_per_day,
            pv.fabric_unit, pv.fabric_width, pv.fabric_design,
            p.name AS product_name, pt.is_rentable, pt.inventory_mode, p.branch_id,
            b.name AS brand_name
     FROM product_variant pv
     JOIN product p ON pv.product_id = p.id
     JOIN product_type pt ON p.product_type_id = pt.id
     LEFT JOIN brand b ON p.brand_id = b.id
     WHERE p.branch_id = $1
       AND (pv.sku ILIKE $2 OR p.name ILIKE $2 OR b.name ILIKE $2)
     ORDER BY pv.sku
     LIMIT 5`,
    [req.params.branchId, '%' + q + '%']
  );

  if (!variants.length) return ok(res, []);

  const results = [];
  for (const variant of variants) {
    // Try to get available (unsold) barcodes — handle case where is_sold column doesn't exist
    let barcodes = [];
    try {
      const { rows } = await query(
        `SELECT bc.barcode_value
         FROM barcode bc
         JOIN grn_item gi ON bc.grn_item_id = gi.id
         WHERE gi.variant_id = $1
           AND bc.is_sold = FALSE
         ORDER BY bc.barcode_value ASC
         LIMIT 5`,
        [variant.id]
      );
      barcodes = rows;
    } catch (e) {
      // is_sold column doesn't exist yet — fall back to all barcodes
      try {
        const { rows } = await query(
          `SELECT bc.barcode_value
           FROM barcode bc
           JOIN grn_item gi ON bc.grn_item_id = gi.id
           WHERE gi.variant_id = $1
           ORDER BY bc.barcode_value ASC
           LIMIT 5`,
          [variant.id]
        );
        barcodes = rows;
      } catch (e2) { barcodes = []; }
    }

    const base = {
      variant_sku: variant.sku,
      product_name: variant.product_name,
      brand_name: variant.brand_name,
      price: variant.price,
      base_selling_price: variant.base_selling_price,
      stock_qty: variant.stock_qty,
      stock_qty_continuous: variant.stock_qty_continuous,
      inventory_mode: variant.inventory_mode,
      fabric_unit: variant.fabric_unit,
      fabric_width: variant.fabric_width,
      fabric_design: variant.fabric_design,
      variant_id: variant.id,
      id: variant.id,
      sku: variant.sku,
      is_rentable: variant.is_rentable,
      rental_price_per_day: variant.rental_price_per_day,
    };

    if (barcodes.length === 0) {
      // No barcodes — suggest the SKU itself so cashier can still type/scan it
      results.push({ ...base, barcode_value: variant.sku, is_sku_only: true });
    } else {
      for (const bc of barcodes) {
        results.push({ ...base, barcode_value: bc.barcode_value, is_sku_only: false });
      }
    }
  }

  ok(res, results);
}));

module.exports = router;
