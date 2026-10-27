-- =============================================================================
-- Nexifly POS: reference data
-- Run once after database/schema.sql:
--   psql -d nexifly_pos -f database/seed.sql
-- =============================================================================

-- Product types
INSERT INTO product_type (name, inventory_mode, base_unit, is_rentable) VALUES
    ('Standard clothing',  'discrete',   'unit',   FALSE),
    ('Rental item',        'discrete',   'unit',   TRUE),
    ('Fabric roll',        'continuous', 'meter',  FALSE),
    ('Accessories',        'discrete',   'unit',   FALSE);

-- Units of measure
INSERT INTO unit_of_measure (name, symbol, dimension, to_base_factor) VALUES
    ('Meter',      'm',    'length', 1.0),
    ('Yard',       'yd',   'length', 0.9144),
    ('Centimeter', 'cm',   'length', 0.01),
    ('Kilogram',   'kg',   'weight', 1.0),
    ('Gram',       'g',    'weight', 0.001),
    ('Unit',       'unit', NULL,     1.0);

-- Subscription plans (set amounts after deployment)
INSERT INTO subscription_plan (name, billing_cycle, amount) VALUES
    ('One-time purchase',    'one_time', 0.00),
    ('Monthly subscription', 'monthly',  0.00),
    ('Annual subscription',  'annual',   0.00);
