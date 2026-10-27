-- =============================================================================
-- Nexifly POS: PostgreSQL schema
-- Structure only (no data). Exported from the project database.
--
-- Usage:
--   createdb nexifly_pos
--   psql -d nexifly_pos -f database/schema.sql
--   psql -d nexifly_pos -f database/seed.sql
-- =============================================================================


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE TABLE public.attribute_type (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    name character varying(60) NOT NULL
);

CREATE SEQUENCE public.attribute_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.attribute_type_id_seq OWNED BY public.attribute_type.id;

CREATE TABLE public.attribute_value (
    id integer NOT NULL,
    attribute_type_id integer NOT NULL,
    value character varying(100) NOT NULL,
    display_label character varying(100)
);

CREATE SEQUENCE public.attribute_value_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.attribute_value_id_seq OWNED BY public.attribute_value.id;

CREATE TABLE public.barcode (
    id integer NOT NULL,
    grn_item_id integer NOT NULL,
    barcode_value character varying(100) NOT NULL,
    is_printed boolean DEFAULT false NOT NULL,
    printed_at timestamp with time zone,
    label_text character varying(120),
    is_sold boolean DEFAULT false NOT NULL,
    sold_at timestamp with time zone,
    grn_id integer
);

CREATE SEQUENCE public.barcode_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.barcode_id_seq OWNED BY public.barcode.id;

CREATE SEQUENCE public.barcode_sequence
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 10;

CREATE TABLE public.bill_session (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    staff_id integer NOT NULL,
    customer_id integer,
    session_key character varying(2) NOT NULL,
    bill_type character varying(10) DEFAULT 'sale'::character varying NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
    shop_discount numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bill_session_bill_type_check CHECK (((bill_type)::text = ANY (ARRAY[('sale'::character varying)::text, ('rental'::character varying)::text]))),
    CONSTRAINT bill_session_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('on_hold'::character varying)::text, ('completed'::character varying)::text, ('cancelled'::character varying)::text])))
);

CREATE SEQUENCE public.bill_session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.bill_session_id_seq OWNED BY public.bill_session.id;

CREATE TABLE public.bill_session_item (
    id integer NOT NULL,
    session_id integer NOT NULL,
    variant_id integer NOT NULL,
    quantity_unit_id integer,
    quantity_sold numeric(14,4) DEFAULT 1 NOT NULL,
    quantity_in_base numeric(14,4),
    unit_price numeric(12,2) NOT NULL,
    discount_applied numeric(12,2) DEFAULT 0 NOT NULL,
    discount_id integer,
    discount_source character varying(20),
    line_total numeric(12,2) NOT NULL,
    CONSTRAINT bill_session_item_discount_source_check CHECK (((discount_source)::text = ANY (ARRAY[('seasonal'::character varying)::text, ('bulk'::character varying)::text, ('shop'::character varying)::text, ('none'::character varying)::text])))
);

CREATE SEQUENCE public.bill_session_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.bill_session_item_id_seq OWNED BY public.bill_session_item.id;

CREATE TABLE public.branch (
    id integer NOT NULL,
    owner_id integer NOT NULL,
    name character varying(150) NOT NULL,
    address text,
    phone character varying(20),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.branch_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.branch_id_seq OWNED BY public.branch.id;

CREATE TABLE public.branch_settings (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    shop_name character varying(150),
    shop_address text,
    shop_contact character varying(20),
    logo_url text,
    purchase_bill_note text DEFAULT 'Goods are exchangeable within 7 days of Purchase'::text,
    rental_bill_note text DEFAULT 'Extra amount of Rs 500 is added on late returns.'::text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by integer,
    shop_contact2 character varying(20)
);

CREATE SEQUENCE public.branch_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.branch_settings_id_seq OWNED BY public.branch_settings.id;

CREATE TABLE public.brand (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    name character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.brand_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.brand_id_seq OWNED BY public.brand.id;

CREATE TABLE public.bulk_discount (
    id integer NOT NULL,
    discount_id integer NOT NULL,
    grn_id integer NOT NULL
);

CREATE SEQUENCE public.bulk_discount_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.bulk_discount_id_seq OWNED BY public.bulk_discount.id;

CREATE TABLE public.category (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    name character varying(100) NOT NULL,
    parent_id integer
);

CREATE SEQUENCE public.category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.category_id_seq OWNED BY public.category.id;

CREATE TABLE public.customer (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    name character varying(100) NOT NULL,
    phone character varying(20),
    email character varying(150),
    loyalty_tier character varying(20) DEFAULT 'standard'::character varying,
    loyalty_points integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    nic character varying(20),
    CONSTRAINT customer_loyalty_tier_check CHECK (((loyalty_tier)::text = ANY (ARRAY[('standard'::character varying)::text, ('silver'::character varying)::text, ('gold'::character varying)::text, ('platinum'::character varying)::text])))
);

CREATE SEQUENCE public.customer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.customer_id_seq OWNED BY public.customer.id;

CREATE TABLE public.device_config (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    device_type character varying(50) NOT NULL,
    device_name character varying(100) NOT NULL,
    connection_string character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    configured_at timestamp with time zone DEFAULT now() NOT NULL,
    configured_by integer,
    CONSTRAINT device_config_device_type_check CHECK (((device_type)::text = ANY (ARRAY[('barcode_printer'::character varying)::text, ('bill_printer'::character varying)::text, ('cash_drawer'::character varying)::text])))
);

CREATE SEQUENCE public.device_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.device_config_id_seq OWNED BY public.device_config.id;

CREATE TABLE public.discount (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    name character varying(150) NOT NULL,
    discount_type character varying(20) NOT NULL,
    value_type character varying(20) NOT NULL,
    value numeric(10,2) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    valid_from timestamp with time zone,
    valid_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer,
    CONSTRAINT discount_discount_type_check CHECK (((discount_type)::text = ANY (ARRAY[('seasonal'::character varying)::text, ('bulk'::character varying)::text]))),
    CONSTRAINT discount_value_type_check CHECK (((value_type)::text = ANY (ARRAY[('percentage'::character varying)::text, ('flat'::character varying)::text])))
);

CREATE SEQUENCE public.discount_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.discount_id_seq OWNED BY public.discount.id;

CREATE TABLE public.expense (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    category_id integer,
    staff_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    description text NOT NULL,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    payment_method character varying(30) DEFAULT 'cash'::character varying NOT NULL,
    receipt_url text,
    is_billable boolean DEFAULT true NOT NULL,
    approved_by integer,
    approval_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expense_approval_status_check CHECK (((approval_status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text]))),
    CONSTRAINT expense_payment_method_check CHECK (((payment_method)::text = ANY (ARRAY[('cash'::character varying)::text, ('card'::character varying)::text, ('bank_transfer'::character varying)::text, ('petty_cash'::character varying)::text, ('other'::character varying)::text])))
);

CREATE TABLE public.expense_category (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    name character varying(80) NOT NULL,
    description text
);

CREATE SEQUENCE public.expense_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.expense_category_id_seq OWNED BY public.expense_category.id;

CREATE SEQUENCE public.expense_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.expense_id_seq OWNED BY public.expense.id;

CREATE TABLE public.grn (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    purchase_order_id integer,
    grn_no character varying(15) NOT NULL,
    type character varying(12) NOT NULL,
    received_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    received_by integer,
    updated_by integer,
    reference_no character varying(50),
    CONSTRAINT grn_type_check CHECK (((type)::text = ANY (ARRAY[('individual'::character varying)::text, ('bulk'::character varying)::text])))
);

CREATE SEQUENCE public.grn_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.grn_id_seq OWNED BY public.grn.id;

CREATE TABLE public.grn_item (
    id integer NOT NULL,
    grn_id integer NOT NULL,
    variant_id integer NOT NULL,
    quantity_received integer NOT NULL,
    unit_cost numeric(12,2) NOT NULL,
    barcodes_printed boolean DEFAULT false NOT NULL,
    fabric_rolls integer,
    fabric_meters_per_roll numeric(10,2)
);

CREATE SEQUENCE public.grn_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.grn_item_id_seq OWNED BY public.grn_item.id;

CREATE SEQUENCE public.grn_sequence
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE public.loyalty_event (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    points_change integer NOT NULL,
    reason character varying(60) NOT NULL,
    reference_type character varying(20),
    reference_id integer,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer,
    CONSTRAINT loyalty_event_reason_check CHECK (((reason)::text = ANY (ARRAY[('sale'::character varying)::text, ('return'::character varying)::text, ('redemption'::character varying)::text, ('manual'::character varying)::text, ('expiry'::character varying)::text])))
);

CREATE SEQUENCE public.loyalty_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.loyalty_event_id_seq OWNED BY public.loyalty_event.id;

CREATE TABLE public.measurable_stock (
    id integer NOT NULL,
    variant_id integer NOT NULL,
    uom_id integer NOT NULL,
    quantity_in_base numeric(14,4) DEFAULT 0 NOT NULL,
    display_unit character varying(20),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.measurable_stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.measurable_stock_id_seq OWNED BY public.measurable_stock.id;

CREATE TABLE public.notification (
    id integer NOT NULL,
    recipient_type character varying(20) NOT NULL,
    branch_id integer,
    owner_id integer,
    type character varying(30) NOT NULL,
    title character varying(150) NOT NULL,
    message text NOT NULL,
    reference_type character varying(30),
    reference_id integer,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read_at timestamp with time zone,
    CONSTRAINT notification_recipient_type_check CHECK (((recipient_type)::text = ANY (ARRAY[('branch'::character varying)::text, ('owner'::character varying)::text, ('platform'::character varying)::text]))),
    CONSTRAINT notification_type_check CHECK (((type)::text = ANY (ARRAY[('low_stock'::character varying)::text, ('overdue_rental'::character varying)::text, ('expiring_sub'::character varying)::text, ('expired_sub'::character varying)::text, ('new_grn'::character varying)::text, ('return_approved'::character varying)::text, ('manual'::character varying)::text, ('upcoming_rental'::character varying)::text])))
);

CREATE SEQUENCE public.notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.notification_id_seq OWNED BY public.notification.id;

CREATE TABLE public.notification_rule (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    type character varying(30) NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    threshold_override integer,
    advance_days integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.notification_rule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.notification_rule_id_seq OWNED BY public.notification_rule.id;

CREATE TABLE public.owner (
    id integer NOT NULL,
    platform_user_id integer NOT NULL,
    business_name character varying(150) NOT NULL,
    business_logo_url text,
    owner_contact_no character varying(20),
    default_branch_address text,
    default_branch_contact_no character varying(20),
    max_branches integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer
);

CREATE SEQUENCE public.owner_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.owner_id_seq OWNED BY public.owner.id;

CREATE TABLE public.payment (
    id integer NOT NULL,
    sale_id integer NOT NULL,
    method character varying(30) NOT NULL,
    amount numeric(12,2) NOT NULL,
    reference character varying(100),
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_method_check CHECK (((method)::text = ANY (ARRAY[('cash'::character varying)::text, ('card'::character varying)::text, ('bank_transfer'::character varying)::text, ('loyalty_points'::character varying)::text, ('other'::character varying)::text])))
);

CREATE SEQUENCE public.payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.payment_id_seq OWNED BY public.payment.id;

CREATE TABLE public.payment_record (
    id integer NOT NULL,
    subscription_id integer NOT NULL,
    amount_paid numeric(12,2) NOT NULL,
    payment_method character varying(50),
    reference character varying(100),
    paid_on date NOT NULL,
    status character varying(20) NOT NULL,
    notes text,
    recorded_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_record_status_check CHECK (((status)::text = ANY (ARRAY[('paid'::character varying)::text, ('partial'::character varying)::text, ('failed'::character varying)::text, ('refunded'::character varying)::text])))
);

CREATE SEQUENCE public.payment_record_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.payment_record_id_seq OWNED BY public.payment_record.id;

CREATE TABLE public.platform_user (
    id integer NOT NULL,
    username character varying(60) NOT NULL,
    email character varying(150) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer,
    CONSTRAINT platform_user_role_check CHECK (((role)::text = ANY (ARRAY[('super_admin'::character varying)::text, ('admin'::character varying)::text, ('owner'::character varying)::text])))
);

CREATE SEQUENCE public.platform_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.platform_user_id_seq OWNED BY public.platform_user.id;

CREATE TABLE public.product (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    brand_id integer,
    category_id integer,
    product_type_id integer NOT NULL,
    name character varying(150) NOT NULL,
    sku character varying(80) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.product_id_seq OWNED BY public.product.id;

CREATE TABLE public.product_type (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    inventory_mode character varying(20) NOT NULL,
    base_unit character varying(20),
    is_rentable boolean DEFAULT false NOT NULL,
    CONSTRAINT product_type_inventory_mode_check CHECK (((inventory_mode)::text = ANY (ARRAY[('discrete'::character varying)::text, ('continuous'::character varying)::text])))
);

CREATE SEQUENCE public.product_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.product_type_id_seq OWNED BY public.product_type.id;

CREATE TABLE public.product_variant (
    id integer NOT NULL,
    product_id integer NOT NULL,
    sku character varying(100) NOT NULL,
    price numeric(12,2) NOT NULL,
    cost_price numeric(12,2),
    rental_price_per_day numeric(12,2),
    rental_status character varying(20),
    stock_qty integer DEFAULT 0 NOT NULL,
    stock_qty_continuous numeric(14,4) DEFAULT 0,
    low_stock_threshold integer DEFAULT 5 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    fabric_width numeric(10,2),
    fabric_unit character varying(10) DEFAULT 'm'::character varying,
    fabric_design character varying(100),
    fabric_roll_length numeric(10,2),
    CONSTRAINT product_variant_rental_status_check CHECK (((rental_status)::text = ANY (ARRAY[('available'::character varying)::text, ('rented'::character varying)::text, ('sold'::character varying)::text])))
);

CREATE SEQUENCE public.product_variant_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.product_variant_id_seq OWNED BY public.product_variant.id;

CREATE TABLE public.purchase_order (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    supplier_id integer NOT NULL,
    po_number character varying(50) NOT NULL,
    ordered_at timestamp with time zone DEFAULT now() NOT NULL,
    status character varying(20) NOT NULL,
    total_amount numeric(12,2),
    notes text,
    created_by integer,
    updated_by integer,
    CONSTRAINT purchase_order_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('sent'::character varying)::text, ('partial'::character varying)::text, ('received'::character varying)::text, ('cancelled'::character varying)::text])))
);

CREATE SEQUENCE public.purchase_order_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.purchase_order_id_seq OWNED BY public.purchase_order.id;

CREATE TABLE public.purchase_order_item (
    id integer NOT NULL,
    po_id integer NOT NULL,
    variant_id integer NOT NULL,
    quantity integer NOT NULL,
    unit_cost numeric(12,2) NOT NULL
);

CREATE SEQUENCE public.purchase_order_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.purchase_order_item_id_seq OWNED BY public.purchase_order_item.id;

CREATE TABLE public.rental (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    variant_id integer NOT NULL,
    customer_id integer NOT NULL,
    staff_id integer NOT NULL,
    reserved_date date,
    rented_date date,
    due_date date NOT NULL,
    returned_date date,
    deposit_amount numeric(12,2) DEFAULT 0 NOT NULL,
    daily_rate numeric(12,2) NOT NULL,
    status character varying(20) NOT NULL,
    converted_sale_id integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    total_rent_amount numeric(12,2) DEFAULT 0,
    CONSTRAINT rental_status_check CHECK (((status)::text = ANY (ARRAY[('reserved'::character varying)::text, ('active'::character varying)::text, ('returned'::character varying)::text, ('overdue'::character varying)::text, ('sold'::character varying)::text, ('item_received'::character varying)::text])))
);

CREATE TABLE public.rental_charge (
    id integer NOT NULL,
    rental_id integer NOT NULL,
    charge_type character varying(50) NOT NULL,
    amount numeric(12,2) NOT NULL,
    notes text,
    charged_at timestamp with time zone DEFAULT now() NOT NULL,
    charged_by integer,
    CONSTRAINT rental_charge_charge_type_check CHECK (((charge_type)::text = ANY (ARRAY[('late_fee'::character varying)::text, ('damage'::character varying)::text, ('cleaning'::character varying)::text, ('other'::character varying)::text])))
);

CREATE SEQUENCE public.rental_charge_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.rental_charge_id_seq OWNED BY public.rental_charge.id;

CREATE SEQUENCE public.rental_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.rental_id_seq OWNED BY public.rental.id;

CREATE TABLE public.rental_payment (
    id integer NOT NULL,
    rental_id integer NOT NULL,
    amount numeric(12,2) NOT NULL,
    method character varying(30) DEFAULT 'cash'::character varying NOT NULL,
    payment_type character varying(20) DEFAULT 'advance'::character varying NOT NULL,
    notes text,
    recorded_by integer,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rental_payment_method_check CHECK (((method)::text = ANY (ARRAY[('cash'::character varying)::text, ('card'::character varying)::text, ('bank_transfer'::character varying)::text, ('other'::character varying)::text]))),
    CONSTRAINT rental_payment_payment_type_check CHECK (((payment_type)::text = ANY (ARRAY[('advance'::character varying)::text, ('installment'::character varying)::text, ('final'::character varying)::text, ('balance'::character varying)::text])))
);

CREATE SEQUENCE public.rental_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.rental_payment_id_seq OWNED BY public.rental_payment.id;

CREATE TABLE public.return_item (
    id integer NOT NULL,
    return_id integer NOT NULL,
    sale_item_id integer NOT NULL,
    variant_id integer NOT NULL,
    quantity_returned numeric(14,4) NOT NULL,
    restock boolean DEFAULT true NOT NULL
);

CREATE SEQUENCE public.return_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.return_item_id_seq OWNED BY public.return_item.id;

CREATE TABLE public.return_record (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    original_sale_id integer NOT NULL,
    staff_id integer NOT NULL,
    return_date date DEFAULT CURRENT_DATE NOT NULL,
    reason text,
    refund_amount numeric(12,2) DEFAULT 0 NOT NULL,
    refund_method character varying(30),
    status character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT return_record_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text])))
);

CREATE SEQUENCE public.return_record_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.return_record_id_seq OWNED BY public.return_record.id;

CREATE TABLE public.sale (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    bill_session_id integer,
    customer_id integer,
    staff_id integer NOT NULL,
    bill_type character varying(10) DEFAULT 'sale'::character varying NOT NULL,
    sold_at timestamp with time zone DEFAULT now() NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) NOT NULL,
    payment_status character varying(20) NOT NULL,
    CONSTRAINT sale_bill_type_check CHECK (((bill_type)::text = ANY (ARRAY[('sale'::character varying)::text, ('rental'::character varying)::text]))),
    CONSTRAINT sale_payment_status_check CHECK (((payment_status)::text = ANY (ARRAY[('paid'::character varying)::text, ('partial'::character varying)::text, ('pending'::character varying)::text, ('refunded'::character varying)::text])))
);

CREATE SEQUENCE public.sale_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.sale_id_seq OWNED BY public.sale.id;

CREATE TABLE public.sale_item (
    id integer NOT NULL,
    sale_id integer NOT NULL,
    variant_id integer NOT NULL,
    quantity_unit_id integer,
    quantity_sold numeric(14,4) DEFAULT 1 NOT NULL,
    quantity_in_base numeric(14,4),
    unit_price numeric(12,2) NOT NULL,
    discount_applied numeric(12,2) DEFAULT 0 NOT NULL,
    discount_id integer,
    discount_source character varying(20),
    line_total numeric(12,2) NOT NULL,
    CONSTRAINT sale_item_discount_source_check CHECK (((discount_source)::text = ANY (ARRAY[('seasonal'::character varying)::text, ('bulk'::character varying)::text, ('shop'::character varying)::text, ('none'::character varying)::text])))
);

CREATE SEQUENCE public.sale_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.sale_item_id_seq OWNED BY public.sale_item.id;

CREATE TABLE public.seasonal_discount (
    id integer NOT NULL,
    discount_id integer NOT NULL,
    brand_id integer NOT NULL,
    condition_min_price numeric(12,2),
    condition_value numeric(10,2)
);

CREATE SEQUENCE public.seasonal_discount_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.seasonal_discount_id_seq OWNED BY public.seasonal_discount.id;

CREATE TABLE public.sku_sequence (
    branch_id integer NOT NULL,
    brand_prefix character varying(5) NOT NULL,
    cat_prefix character varying(5) NOT NULL,
    next_seq integer DEFAULT 1 NOT NULL
);

CREATE TABLE public.staff (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    name character varying(100) NOT NULL,
    role character varying(20) NOT NULL,
    email character varying(150),
    password_hash character varying(255),
    pin_hash character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by integer,
    CONSTRAINT staff_role_check CHECK (((role)::text = ANY (ARRAY[('owner'::character varying)::text, ('manager'::character varying)::text, ('cashier'::character varying)::text])))
);

CREATE SEQUENCE public.staff_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.staff_id_seq OWNED BY public.staff.id;

CREATE TABLE public.stock_adjustment (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    variant_id integer NOT NULL,
    adjusted_by integer NOT NULL,
    reason character varying(40) NOT NULL,
    quantity_change numeric(14,4) NOT NULL,
    reference_type character varying(30),
    reference_id integer,
    notes text,
    adjusted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_adjustment_reason_check CHECK (((reason)::text = ANY (ARRAY[('grn_receipt'::character varying)::text, ('sale'::character varying)::text, ('rental'::character varying)::text, ('return'::character varying)::text, ('damage'::character varying)::text, ('manual'::character varying)::text, ('correction'::character varying)::text])))
);

CREATE SEQUENCE public.stock_adjustment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.stock_adjustment_id_seq OWNED BY public.stock_adjustment.id;

CREATE TABLE public.subscription (
    id integer NOT NULL,
    owner_id integer NOT NULL,
    plan_id integer NOT NULL,
    start_date date NOT NULL,
    end_date date,
    status character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscription_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('expired'::character varying)::text, ('cancelled'::character varying)::text, ('pending'::character varying)::text])))
);

CREATE SEQUENCE public.subscription_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.subscription_id_seq OWNED BY public.subscription.id;

CREATE TABLE public.subscription_plan (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    billing_cycle character varying(20) NOT NULL,
    amount numeric(12,2) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscription_plan_billing_cycle_check CHECK (((billing_cycle)::text = ANY (ARRAY[('one_time'::character varying)::text, ('monthly'::character varying)::text, ('annual'::character varying)::text])))
);

CREATE SEQUENCE public.subscription_plan_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.subscription_plan_id_seq OWNED BY public.subscription_plan.id;

CREATE TABLE public.supplier (
    id integer NOT NULL,
    branch_id integer NOT NULL,
    name character varying(150) NOT NULL,
    contact_name character varying(100),
    phone character varying(20),
    email character varying(150),
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE public.supplier_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.supplier_id_seq OWNED BY public.supplier.id;

CREATE TABLE public.unit_of_measure (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    symbol character varying(10) NOT NULL,
    dimension character varying(30),
    to_base_factor numeric(18,10) DEFAULT 1 NOT NULL
);

CREATE SEQUENCE public.unit_of_measure_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.unit_of_measure_id_seq OWNED BY public.unit_of_measure.id;

CREATE TABLE public.variant_attribute (
    variant_id integer NOT NULL,
    attribute_value_id integer NOT NULL
);

ALTER TABLE ONLY public.attribute_type ALTER COLUMN id SET DEFAULT nextval('public.attribute_type_id_seq'::regclass);

ALTER TABLE ONLY public.attribute_value ALTER COLUMN id SET DEFAULT nextval('public.attribute_value_id_seq'::regclass);

ALTER TABLE ONLY public.barcode ALTER COLUMN id SET DEFAULT nextval('public.barcode_id_seq'::regclass);

ALTER TABLE ONLY public.bill_session ALTER COLUMN id SET DEFAULT nextval('public.bill_session_id_seq'::regclass);

ALTER TABLE ONLY public.bill_session_item ALTER COLUMN id SET DEFAULT nextval('public.bill_session_item_id_seq'::regclass);

ALTER TABLE ONLY public.branch ALTER COLUMN id SET DEFAULT nextval('public.branch_id_seq'::regclass);

ALTER TABLE ONLY public.branch_settings ALTER COLUMN id SET DEFAULT nextval('public.branch_settings_id_seq'::regclass);

ALTER TABLE ONLY public.brand ALTER COLUMN id SET DEFAULT nextval('public.brand_id_seq'::regclass);

ALTER TABLE ONLY public.bulk_discount ALTER COLUMN id SET DEFAULT nextval('public.bulk_discount_id_seq'::regclass);

ALTER TABLE ONLY public.category ALTER COLUMN id SET DEFAULT nextval('public.category_id_seq'::regclass);

ALTER TABLE ONLY public.customer ALTER COLUMN id SET DEFAULT nextval('public.customer_id_seq'::regclass);

ALTER TABLE ONLY public.device_config ALTER COLUMN id SET DEFAULT nextval('public.device_config_id_seq'::regclass);

ALTER TABLE ONLY public.discount ALTER COLUMN id SET DEFAULT nextval('public.discount_id_seq'::regclass);

ALTER TABLE ONLY public.expense ALTER COLUMN id SET DEFAULT nextval('public.expense_id_seq'::regclass);

ALTER TABLE ONLY public.expense_category ALTER COLUMN id SET DEFAULT nextval('public.expense_category_id_seq'::regclass);

ALTER TABLE ONLY public.grn ALTER COLUMN id SET DEFAULT nextval('public.grn_id_seq'::regclass);

ALTER TABLE ONLY public.grn_item ALTER COLUMN id SET DEFAULT nextval('public.grn_item_id_seq'::regclass);

ALTER TABLE ONLY public.loyalty_event ALTER COLUMN id SET DEFAULT nextval('public.loyalty_event_id_seq'::regclass);

ALTER TABLE ONLY public.measurable_stock ALTER COLUMN id SET DEFAULT nextval('public.measurable_stock_id_seq'::regclass);

ALTER TABLE ONLY public.notification ALTER COLUMN id SET DEFAULT nextval('public.notification_id_seq'::regclass);

ALTER TABLE ONLY public.notification_rule ALTER COLUMN id SET DEFAULT nextval('public.notification_rule_id_seq'::regclass);

ALTER TABLE ONLY public.owner ALTER COLUMN id SET DEFAULT nextval('public.owner_id_seq'::regclass);

ALTER TABLE ONLY public.payment ALTER COLUMN id SET DEFAULT nextval('public.payment_id_seq'::regclass);

ALTER TABLE ONLY public.payment_record ALTER COLUMN id SET DEFAULT nextval('public.payment_record_id_seq'::regclass);

ALTER TABLE ONLY public.platform_user ALTER COLUMN id SET DEFAULT nextval('public.platform_user_id_seq'::regclass);

ALTER TABLE ONLY public.product ALTER COLUMN id SET DEFAULT nextval('public.product_id_seq'::regclass);

ALTER TABLE ONLY public.product_type ALTER COLUMN id SET DEFAULT nextval('public.product_type_id_seq'::regclass);

ALTER TABLE ONLY public.product_variant ALTER COLUMN id SET DEFAULT nextval('public.product_variant_id_seq'::regclass);

ALTER TABLE ONLY public.purchase_order ALTER COLUMN id SET DEFAULT nextval('public.purchase_order_id_seq'::regclass);

ALTER TABLE ONLY public.purchase_order_item ALTER COLUMN id SET DEFAULT nextval('public.purchase_order_item_id_seq'::regclass);

ALTER TABLE ONLY public.rental ALTER COLUMN id SET DEFAULT nextval('public.rental_id_seq'::regclass);

ALTER TABLE ONLY public.rental_charge ALTER COLUMN id SET DEFAULT nextval('public.rental_charge_id_seq'::regclass);

ALTER TABLE ONLY public.rental_payment ALTER COLUMN id SET DEFAULT nextval('public.rental_payment_id_seq'::regclass);

ALTER TABLE ONLY public.return_item ALTER COLUMN id SET DEFAULT nextval('public.return_item_id_seq'::regclass);

ALTER TABLE ONLY public.return_record ALTER COLUMN id SET DEFAULT nextval('public.return_record_id_seq'::regclass);

ALTER TABLE ONLY public.sale ALTER COLUMN id SET DEFAULT nextval('public.sale_id_seq'::regclass);

ALTER TABLE ONLY public.sale_item ALTER COLUMN id SET DEFAULT nextval('public.sale_item_id_seq'::regclass);

ALTER TABLE ONLY public.seasonal_discount ALTER COLUMN id SET DEFAULT nextval('public.seasonal_discount_id_seq'::regclass);

ALTER TABLE ONLY public.staff ALTER COLUMN id SET DEFAULT nextval('public.staff_id_seq'::regclass);

ALTER TABLE ONLY public.stock_adjustment ALTER COLUMN id SET DEFAULT nextval('public.stock_adjustment_id_seq'::regclass);

ALTER TABLE ONLY public.subscription ALTER COLUMN id SET DEFAULT nextval('public.subscription_id_seq'::regclass);

ALTER TABLE ONLY public.subscription_plan ALTER COLUMN id SET DEFAULT nextval('public.subscription_plan_id_seq'::regclass);

ALTER TABLE ONLY public.supplier ALTER COLUMN id SET DEFAULT nextval('public.supplier_id_seq'::regclass);

ALTER TABLE ONLY public.unit_of_measure ALTER COLUMN id SET DEFAULT nextval('public.unit_of_measure_id_seq'::regclass);

ALTER TABLE ONLY public.attribute_type
    ADD CONSTRAINT attribute_type_branch_id_name_key UNIQUE (branch_id, name);

ALTER TABLE ONLY public.attribute_type
    ADD CONSTRAINT attribute_type_branch_name_key UNIQUE (branch_id, name);

ALTER TABLE ONLY public.attribute_type
    ADD CONSTRAINT attribute_type_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.attribute_value
    ADD CONSTRAINT attribute_value_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.attribute_value
    ADD CONSTRAINT attribute_value_type_value_key UNIQUE (attribute_type_id, value);

ALTER TABLE ONLY public.barcode
    ADD CONSTRAINT barcode_barcode_value_key UNIQUE (barcode_value);

ALTER TABLE ONLY public.barcode
    ADD CONSTRAINT barcode_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bill_session_item
    ADD CONSTRAINT bill_session_item_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bill_session
    ADD CONSTRAINT bill_session_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bill_session
    ADD CONSTRAINT bill_session_staff_id_session_key_status_key UNIQUE (staff_id, session_key, status);

ALTER TABLE ONLY public.branch
    ADD CONSTRAINT branch_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.branch_settings
    ADD CONSTRAINT branch_settings_branch_id_key UNIQUE (branch_id);

ALTER TABLE ONLY public.branch_settings
    ADD CONSTRAINT branch_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.brand
    ADD CONSTRAINT brand_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bulk_discount
    ADD CONSTRAINT bulk_discount_discount_id_key UNIQUE (discount_id);

ALTER TABLE ONLY public.bulk_discount
    ADD CONSTRAINT bulk_discount_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.device_config
    ADD CONSTRAINT device_config_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.discount
    ADD CONSTRAINT discount_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.expense_category
    ADD CONSTRAINT expense_category_branch_id_name_key UNIQUE (branch_id, name);

ALTER TABLE ONLY public.expense_category
    ADD CONSTRAINT expense_category_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.expense
    ADD CONSTRAINT expense_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.grn
    ADD CONSTRAINT grn_branch_id_grn_no_key UNIQUE (branch_id, grn_no);

ALTER TABLE ONLY public.grn_item
    ADD CONSTRAINT grn_item_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.grn
    ADD CONSTRAINT grn_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.loyalty_event
    ADD CONSTRAINT loyalty_event_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.measurable_stock
    ADD CONSTRAINT measurable_stock_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.measurable_stock
    ADD CONSTRAINT measurable_stock_variant_id_key UNIQUE (variant_id);

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notification_rule
    ADD CONSTRAINT notification_rule_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.owner
    ADD CONSTRAINT owner_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.owner
    ADD CONSTRAINT owner_platform_user_id_key UNIQUE (platform_user_id);

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payment_record
    ADD CONSTRAINT payment_record_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.platform_user
    ADD CONSTRAINT platform_user_email_key UNIQUE (email);

ALTER TABLE ONLY public.platform_user
    ADD CONSTRAINT platform_user_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.platform_user
    ADD CONSTRAINT platform_user_username_key UNIQUE (username);

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_branch_id_sku_key UNIQUE (branch_id, sku);

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_type
    ADD CONSTRAINT product_type_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_variant
    ADD CONSTRAINT product_variant_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.product_variant
    ADD CONSTRAINT product_variant_sku_key UNIQUE (sku);

ALTER TABLE ONLY public.purchase_order
    ADD CONSTRAINT purchase_order_branch_id_po_number_key UNIQUE (branch_id, po_number);

ALTER TABLE ONLY public.purchase_order_item
    ADD CONSTRAINT purchase_order_item_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.purchase_order
    ADD CONSTRAINT purchase_order_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rental_charge
    ADD CONSTRAINT rental_charge_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rental_payment
    ADD CONSTRAINT rental_payment_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rental
    ADD CONSTRAINT rental_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.return_item
    ADD CONSTRAINT return_item_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.return_record
    ADD CONSTRAINT return_record_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sale_item
    ADD CONSTRAINT sale_item_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sale
    ADD CONSTRAINT sale_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.seasonal_discount
    ADD CONSTRAINT seasonal_discount_discount_id_key UNIQUE (discount_id);

ALTER TABLE ONLY public.seasonal_discount
    ADD CONSTRAINT seasonal_discount_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sku_sequence
    ADD CONSTRAINT sku_sequence_pkey PRIMARY KEY (branch_id, brand_prefix, cat_prefix);

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_email_key UNIQUE (email);

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.stock_adjustment
    ADD CONSTRAINT stock_adjustment_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.subscription_plan
    ADD CONSTRAINT subscription_plan_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.supplier
    ADD CONSTRAINT supplier_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.unit_of_measure
    ADD CONSTRAINT unit_of_measure_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.variant_attribute
    ADD CONSTRAINT variant_attribute_pkey PRIMARY KEY (variant_id, attribute_value_id);

CREATE INDEX idx_barcode_grn_item ON public.barcode USING btree (grn_item_id);

CREATE INDEX idx_barcode_label ON public.barcode USING btree (label_text);

CREATE INDEX idx_barcode_sold ON public.barcode USING btree (is_sold);

CREATE INDEX idx_barcode_value ON public.barcode USING btree (barcode_value);

CREATE INDEX idx_branch_owner ON public.branch USING btree (owner_id);

CREATE INDEX idx_brand_branch ON public.brand USING btree (branch_id);

CREATE INDEX idx_bulk_grn ON public.bulk_discount USING btree (grn_id);

CREATE INDEX idx_category_branch ON public.category USING btree (branch_id);

CREATE INDEX idx_customer_branch ON public.customer USING btree (branch_id);

CREATE INDEX idx_customer_nic ON public.customer USING btree (nic);

CREATE INDEX idx_customer_phone ON public.customer USING btree (phone);

CREATE INDEX idx_device_branch ON public.device_config USING btree (branch_id);

CREATE INDEX idx_discount_branch ON public.discount USING btree (branch_id);

CREATE INDEX idx_expense_approval ON public.expense USING btree (approval_status);

CREATE INDEX idx_expense_branch ON public.expense USING btree (branch_id);

CREATE INDEX idx_expense_category ON public.expense USING btree (category_id);

CREATE INDEX idx_expense_date ON public.expense USING btree (expense_date);

CREATE INDEX idx_expense_staff ON public.expense USING btree (staff_id);

CREATE INDEX idx_grn_branch ON public.grn USING btree (branch_id);

CREATE INDEX idx_grn_item_grn ON public.grn_item USING btree (grn_id);

CREATE INDEX idx_grn_po ON public.grn USING btree (purchase_order_id);

CREATE INDEX idx_loyalty_event_cust ON public.loyalty_event USING btree (customer_id);

CREATE INDEX idx_notif_branch ON public.notification USING btree (branch_id);

CREATE INDEX idx_notif_owner ON public.notification USING btree (owner_id);

CREATE INDEX idx_notif_type ON public.notification USING btree (type);

CREATE INDEX idx_notif_unread ON public.notification USING btree (is_read) WHERE (is_read = false);

CREATE INDEX idx_owner_platform_user ON public.owner USING btree (platform_user_id);

CREATE INDEX idx_payment_record_sub ON public.payment_record USING btree (subscription_id);

CREATE INDEX idx_payment_sale ON public.payment USING btree (sale_id);

CREATE INDEX idx_po_branch ON public.purchase_order USING btree (branch_id);

CREATE INDEX idx_po_item_po ON public.purchase_order_item USING btree (po_id);

CREATE INDEX idx_po_supplier ON public.purchase_order USING btree (supplier_id);

CREATE INDEX idx_product_branch ON public.product USING btree (branch_id);

CREATE INDEX idx_product_brand ON public.product USING btree (brand_id);

CREATE INDEX idx_product_category ON public.product USING btree (category_id);

CREATE INDEX idx_product_name_trgm ON public.product USING gin (name public.gin_trgm_ops);

CREATE INDEX idx_product_sku ON public.product USING btree (sku);

CREATE INDEX idx_rental_branch ON public.rental USING btree (branch_id);

CREATE INDEX idx_rental_customer ON public.rental USING btree (customer_id);

CREATE INDEX idx_rental_due_date ON public.rental USING btree (due_date);

CREATE INDEX idx_rental_payment_rental ON public.rental_payment USING btree (rental_id);

CREATE INDEX idx_rental_status ON public.rental USING btree (status);

CREATE INDEX idx_rental_variant ON public.rental USING btree (variant_id);

CREATE INDEX idx_return_branch ON public.return_record USING btree (branch_id);

CREATE INDEX idx_return_original_sale ON public.return_record USING btree (original_sale_id);

CREATE INDEX idx_sale_branch ON public.sale USING btree (branch_id);

CREATE INDEX idx_sale_customer ON public.sale USING btree (customer_id);

CREATE INDEX idx_sale_item_sale ON public.sale_item USING btree (sale_id);

CREATE INDEX idx_sale_item_variant ON public.sale_item USING btree (variant_id);

CREATE INDEX idx_sale_sold_at ON public.sale USING btree (sold_at);

CREATE INDEX idx_sale_staff ON public.sale USING btree (staff_id);

CREATE INDEX idx_seasonal_brand ON public.seasonal_discount USING btree (brand_id);

CREATE INDEX idx_session_branch ON public.bill_session USING btree (branch_id);

CREATE INDEX idx_session_item_session ON public.bill_session_item USING btree (session_id);

CREATE INDEX idx_session_staff ON public.bill_session USING btree (staff_id);

CREATE INDEX idx_session_status ON public.bill_session USING btree (status);

CREATE INDEX idx_staff_branch ON public.staff USING btree (branch_id);

CREATE INDEX idx_stock_adj_at ON public.stock_adjustment USING btree (adjusted_at);

CREATE INDEX idx_stock_adj_branch ON public.stock_adjustment USING btree (branch_id);

CREATE INDEX idx_stock_adj_variant ON public.stock_adjustment USING btree (variant_id);

CREATE INDEX idx_subscription_owner ON public.subscription USING btree (owner_id);

CREATE INDEX idx_supplier_branch ON public.supplier USING btree (branch_id);

CREATE INDEX idx_variant_product ON public.product_variant USING btree (product_id);

CREATE INDEX idx_variant_sku ON public.product_variant USING btree (sku);

CREATE INDEX idx_variant_sku_trgm ON public.product_variant USING gin (sku public.gin_trgm_ops);

ALTER TABLE ONLY public.attribute_type
    ADD CONSTRAINT attribute_type_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.attribute_value
    ADD CONSTRAINT attribute_value_attribute_type_id_fkey FOREIGN KEY (attribute_type_id) REFERENCES public.attribute_type(id);

ALTER TABLE ONLY public.barcode
    ADD CONSTRAINT barcode_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.grn(id);

ALTER TABLE ONLY public.barcode
    ADD CONSTRAINT barcode_grn_item_id_fkey FOREIGN KEY (grn_item_id) REFERENCES public.grn_item(id);

ALTER TABLE ONLY public.bill_session
    ADD CONSTRAINT bill_session_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.bill_session
    ADD CONSTRAINT bill_session_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id);

ALTER TABLE ONLY public.bill_session_item
    ADD CONSTRAINT bill_session_item_discount_id_fkey FOREIGN KEY (discount_id) REFERENCES public.discount(id);

ALTER TABLE ONLY public.bill_session_item
    ADD CONSTRAINT bill_session_item_quantity_unit_id_fkey FOREIGN KEY (quantity_unit_id) REFERENCES public.unit_of_measure(id);

ALTER TABLE ONLY public.bill_session_item
    ADD CONSTRAINT bill_session_item_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.bill_session(id);

ALTER TABLE ONLY public.bill_session_item
    ADD CONSTRAINT bill_session_item_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variant(id);

ALTER TABLE ONLY public.bill_session
    ADD CONSTRAINT bill_session_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);

ALTER TABLE ONLY public.branch
    ADD CONSTRAINT branch_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owner(id);

ALTER TABLE ONLY public.branch_settings
    ADD CONSTRAINT branch_settings_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.branch_settings
    ADD CONSTRAINT branch_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.staff(id);

ALTER TABLE ONLY public.brand
    ADD CONSTRAINT brand_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.bulk_discount
    ADD CONSTRAINT bulk_discount_discount_id_fkey FOREIGN KEY (discount_id) REFERENCES public.discount(id);

ALTER TABLE ONLY public.bulk_discount
    ADD CONSTRAINT bulk_discount_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.grn(id);

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.category(id);

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.device_config
    ADD CONSTRAINT device_config_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.device_config
    ADD CONSTRAINT device_config_configured_by_fkey FOREIGN KEY (configured_by) REFERENCES public.staff(id);

ALTER TABLE ONLY public.discount
    ADD CONSTRAINT discount_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.discount
    ADD CONSTRAINT discount_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE ONLY public.expense
    ADD CONSTRAINT expense_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.staff(id);

ALTER TABLE ONLY public.expense
    ADD CONSTRAINT expense_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.expense_category
    ADD CONSTRAINT expense_category_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.expense
    ADD CONSTRAINT expense_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.expense_category(id);

ALTER TABLE ONLY public.expense
    ADD CONSTRAINT expense_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);

ALTER TABLE ONLY public.grn
    ADD CONSTRAINT grn_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.grn_item
    ADD CONSTRAINT grn_item_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.grn(id);

ALTER TABLE ONLY public.grn_item
    ADD CONSTRAINT grn_item_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variant(id);

ALTER TABLE ONLY public.grn
    ADD CONSTRAINT grn_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_order(id);

ALTER TABLE ONLY public.grn
    ADD CONSTRAINT grn_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.staff(id);

ALTER TABLE ONLY public.grn
    ADD CONSTRAINT grn_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.staff(id);

ALTER TABLE ONLY public.loyalty_event
    ADD CONSTRAINT loyalty_event_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE ONLY public.loyalty_event
    ADD CONSTRAINT loyalty_event_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id);

ALTER TABLE ONLY public.measurable_stock
    ADD CONSTRAINT measurable_stock_uom_id_fkey FOREIGN KEY (uom_id) REFERENCES public.unit_of_measure(id);

ALTER TABLE ONLY public.measurable_stock
    ADD CONSTRAINT measurable_stock_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variant(id);

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owner(id);

ALTER TABLE ONLY public.notification_rule
    ADD CONSTRAINT notification_rule_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.owner
    ADD CONSTRAINT owner_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.platform_user(id);

ALTER TABLE ONLY public.owner
    ADD CONSTRAINT owner_platform_user_id_fkey FOREIGN KEY (platform_user_id) REFERENCES public.platform_user(id);

ALTER TABLE ONLY public.payment_record
    ADD CONSTRAINT payment_record_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.platform_user(id);

ALTER TABLE ONLY public.payment_record
    ADD CONSTRAINT payment_record_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscription(id);

ALTER TABLE ONLY public.payment
    ADD CONSTRAINT payment_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sale(id);

ALTER TABLE ONLY public.platform_user
    ADD CONSTRAINT platform_user_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.platform_user(id);

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brand(id);

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.category(id);

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_product_type_id_fkey FOREIGN KEY (product_type_id) REFERENCES public.product_type(id);

ALTER TABLE ONLY public.product_variant
    ADD CONSTRAINT product_variant_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id);

ALTER TABLE ONLY public.purchase_order
    ADD CONSTRAINT purchase_order_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.purchase_order
    ADD CONSTRAINT purchase_order_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE ONLY public.purchase_order_item
    ADD CONSTRAINT purchase_order_item_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_order(id);

ALTER TABLE ONLY public.purchase_order_item
    ADD CONSTRAINT purchase_order_item_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variant(id);

ALTER TABLE ONLY public.purchase_order
    ADD CONSTRAINT purchase_order_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.supplier(id);

ALTER TABLE ONLY public.purchase_order
    ADD CONSTRAINT purchase_order_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.staff(id);

ALTER TABLE ONLY public.rental
    ADD CONSTRAINT rental_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.rental_charge
    ADD CONSTRAINT rental_charge_charged_by_fkey FOREIGN KEY (charged_by) REFERENCES public.staff(id);

ALTER TABLE ONLY public.rental_charge
    ADD CONSTRAINT rental_charge_rental_id_fkey FOREIGN KEY (rental_id) REFERENCES public.rental(id);

ALTER TABLE ONLY public.rental
    ADD CONSTRAINT rental_converted_sale_id_fkey FOREIGN KEY (converted_sale_id) REFERENCES public.sale(id);

ALTER TABLE ONLY public.rental
    ADD CONSTRAINT rental_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id);

ALTER TABLE ONLY public.rental_payment
    ADD CONSTRAINT rental_payment_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.staff(id);

ALTER TABLE ONLY public.rental_payment
    ADD CONSTRAINT rental_payment_rental_id_fkey FOREIGN KEY (rental_id) REFERENCES public.rental(id);

ALTER TABLE ONLY public.rental
    ADD CONSTRAINT rental_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);

ALTER TABLE ONLY public.rental
    ADD CONSTRAINT rental_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variant(id);

ALTER TABLE ONLY public.return_item
    ADD CONSTRAINT return_item_return_id_fkey FOREIGN KEY (return_id) REFERENCES public.return_record(id);

ALTER TABLE ONLY public.return_item
    ADD CONSTRAINT return_item_sale_item_id_fkey FOREIGN KEY (sale_item_id) REFERENCES public.sale_item(id);

ALTER TABLE ONLY public.return_item
    ADD CONSTRAINT return_item_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variant(id);

ALTER TABLE ONLY public.return_record
    ADD CONSTRAINT return_record_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.return_record
    ADD CONSTRAINT return_record_original_sale_id_fkey FOREIGN KEY (original_sale_id) REFERENCES public.sale(id);

ALTER TABLE ONLY public.return_record
    ADD CONSTRAINT return_record_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);

ALTER TABLE ONLY public.sale
    ADD CONSTRAINT sale_bill_session_id_fkey FOREIGN KEY (bill_session_id) REFERENCES public.bill_session(id);

ALTER TABLE ONLY public.sale
    ADD CONSTRAINT sale_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.sale
    ADD CONSTRAINT sale_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id);

ALTER TABLE ONLY public.sale_item
    ADD CONSTRAINT sale_item_discount_id_fkey FOREIGN KEY (discount_id) REFERENCES public.discount(id);

ALTER TABLE ONLY public.sale_item
    ADD CONSTRAINT sale_item_quantity_unit_id_fkey FOREIGN KEY (quantity_unit_id) REFERENCES public.unit_of_measure(id);

ALTER TABLE ONLY public.sale_item
    ADD CONSTRAINT sale_item_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sale(id);

ALTER TABLE ONLY public.sale_item
    ADD CONSTRAINT sale_item_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variant(id);

ALTER TABLE ONLY public.sale
    ADD CONSTRAINT sale_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);

ALTER TABLE ONLY public.seasonal_discount
    ADD CONSTRAINT seasonal_discount_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brand(id);

ALTER TABLE ONLY public.seasonal_discount
    ADD CONSTRAINT seasonal_discount_discount_id_fkey FOREIGN KEY (discount_id) REFERENCES public.discount(id);

ALTER TABLE ONLY public.sku_sequence
    ADD CONSTRAINT sku_sequence_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff(id);

ALTER TABLE ONLY public.stock_adjustment
    ADD CONSTRAINT stock_adjustment_adjusted_by_fkey FOREIGN KEY (adjusted_by) REFERENCES public.staff(id);

ALTER TABLE ONLY public.stock_adjustment
    ADD CONSTRAINT stock_adjustment_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.stock_adjustment
    ADD CONSTRAINT stock_adjustment_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variant(id);

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owner(id);

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plan(id);

ALTER TABLE ONLY public.supplier
    ADD CONSTRAINT supplier_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);

ALTER TABLE ONLY public.variant_attribute
    ADD CONSTRAINT variant_attribute_attribute_value_id_fkey FOREIGN KEY (attribute_value_id) REFERENCES public.attribute_value(id);

ALTER TABLE ONLY public.variant_attribute
    ADD CONSTRAINT variant_attribute_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variant(id);

-- -----------------------------------------------------------------------------
-- Unique constraints required by ON CONFLICT upserts in the API
-- (device settings and notification rules)
-- -----------------------------------------------------------------------------
ALTER TABLE ONLY public.device_config
    ADD CONSTRAINT uq_device_branch_type UNIQUE (branch_id, device_type);

ALTER TABLE ONLY public.notification_rule
    ADD CONSTRAINT uq_notif_rule_branch_type UNIQUE (branch_id, type);
