import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Card,
  Btn,
  Input,
  Select,
  Modal,
  Badge,
  Table,
  Flex,
  SectionHeader,
  EmptyState,
} from '../ui';
import { useAuth } from '../../context/AuthContext';
import { productApi, skuApi } from '../../api';

// ─── constants ────────────────────────────────────────────────────────────────
const TYPE_OPTS = [
  { value: 'standard', label: 'Standard clothing' },
  { value: 'rental', label: 'Rental item' },
  { value: 'fabric', label: 'Fabric roll' },
  { value: 'accessories', label: 'Accessories' },
];
const TYPE_ID_MAP = { standard: 1, rental: 2, fabric: 3, accessories: 4 };

const DEFAULT_SIZES = [
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  'Collar 14"',
  'Collar 15"',
  'Collar 16"',
  'Collar 17"',
  '28W',
  '30W',
  '32W',
  '34W',
  '36W',
  '38W',
  '40W',
  '42W',
  '44W',
  '46W',
];
const DEFAULT_COLORS = [
  'White',
  'Powder Blue',
  'Sky Blue',
  'Black',
  'Navy',
  'Olive Green',
  'Magenta',
  'Charcoal',
  'Cream',
  'Red',
  'Brown',
  'Grey',
];
const DEFAULT_MATERIALS = [
  'Cotton',
  'Silk',
  'Polyester',
  'Poplin',
  'Linen',
  'Denim',
  'Wool',
  'Rayon',
];
const DEFAULT_STYLES = ['Regular Fit', 'Slim Fit', 'Tight Fit', 'Relaxed Fit'];

const loadCustom = (key) => {
  try {
    return JSON.parse(localStorage.getItem('nxf_attr_' + key) || '[]');
  } catch {
    return [];
  }
};
const saveCustom = (key, arr) => localStorage.setItem('nxf_attr_' + key, JSON.stringify(arr));

function AttributePicker({ label, attrKey, defaults, value, onChange, onSkuReset }) {
  const [custom, setCustom] = React.useState(() => loadCustom(attrKey));
  const [search, setSearch] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [newVal, setNewVal] = React.useState('');
  const ref = React.useRef(null);

  const all = [...defaults, ...custom.filter((c) => !defaults.includes(c))];
  const filtered = search.trim()
    ? all.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
    : all;

  // Close on outside click
  React.useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const select = (v) => {
    onChange(v);
    if (onSkuReset) onSkuReset();
    setOpen(false);
    setSearch('');
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange('');
    if (onSkuReset) onSkuReset();
  };

  const confirmAdd = () => {
    const t = (adding ? newVal : search).trim();
    if (!t) {
      setAdding(false);
      setNewVal('');
      return;
    }
    let updated = custom;
    if (!custom.includes(t) && !defaults.includes(t)) {
      updated = [...custom, t];
      setCustom(updated);
      saveCustom(attrKey, updated);
    }
    select(t);
    setAdding(false);
    setNewVal('');
  };

  const removeCustom = (val, e) => {
    e.stopPropagation();
    const u = custom.filter((c) => c !== val);
    setCustom(u);
    saveCustom(attrKey, u);
    if (value === val) onChange('');
  };

  return (
    <div
      ref={ref}
      style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: 'var(--col-text-2)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </span>

      {/* Trigger input — shows selected value or search query */}
      <div style={{ position: 'relative' }}>
        <input
          value={open ? search : value || ''}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setSearch('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              setSearch('');
            }
            if (e.key === 'Enter' && search.trim() && filtered.length === 0) confirmAdd();
            if (e.key === 'Enter' && filtered.length === 1) select(filtered[0]);
          }}
          placeholder={value ? value : `Search ${label.toLowerCase()}…`}
          style={{
            width: '100%',
            padding: '7px 30px 7px 10px',
            borderRadius: 'var(--radius-md)',
            border: open ? '1px solid var(--col-accent)' : '0.5px solid var(--col-border-2)',
            background: 'var(--col-bg-3)',
            color: value && !open ? 'var(--col-text)' : 'var(--col-text-2)',
            fontSize: 12,
            outline: 'none',
            cursor: 'text',
            boxSizing: 'border-box',
          }}
        />
        {value && !open && (
          <button
            onClick={clear}
            style={{
              position: 'absolute',
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--col-text-3)',
              fontSize: 14,
              lineHeight: 1,
              padding: 2,
            }}
          >
            ×
          </button>
        )}
        {!value && (
          <span
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--col-text-3)',
              fontSize: 10,
              pointerEvents: 'none',
            }}
          >
            ▾
          </span>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 500,
            marginTop: 2,
            background: 'var(--col-bg-2)',
            border: '0.5px solid var(--col-border-2)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,.5)',
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          {filtered.length === 0 && !search.trim() && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--col-text-3)' }}>
              Type to search…
            </div>
          )}
          {filtered.map((v) => (
            <div
              key={v}
              onMouseDown={(e) => {
                e.preventDefault();
                select(v);
              }}
              style={{
                padding: '8px 12px',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: value === v ? 'rgba(233,69,96,.1)' : 'transparent',
                borderBottom: '0.5px solid var(--col-border)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--col-bg-3)')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  value === v ? 'rgba(233,69,96,.1)' : 'transparent')
              }
            >
              <span>
                {v} {value === v && '✓'}
              </span>
              {custom.includes(v) && (
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    removeCustom(v, e);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--col-red)',
                    fontSize: 12,
                    padding: '0 2px',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {/* Add custom option */}
          {search.trim() && !all.some((v) => v.toLowerCase() === search.toLowerCase()) && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                confirmAdd();
              }}
              style={{
                padding: '8px 12px',
                fontSize: 12,
                cursor: 'pointer',
                color: 'var(--col-accent)',
                fontWeight: 500,
                borderTop: '0.5px solid var(--col-border)',
                background: 'rgba(233,69,96,.04)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(233,69,96,.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(233,69,96,.04)')}
            >
              ＋ Add "{search.trim()}" as custom {label.toLowerCase()}
            </div>
          )}
          {!search.trim() && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setAdding(true);
                setOpen(false);
              }}
              style={{
                padding: '8px 12px',
                fontSize: 12,
                cursor: 'pointer',
                color: 'var(--col-accent)',
                fontWeight: 500,
                borderTop: '0.5px solid var(--col-border)',
                background: 'rgba(233,69,96,.04)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(233,69,96,.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(233,69,96,.04)')}
            >
              ＋ Add custom {label.toLowerCase()}
            </div>
          )}
        </div>
      )}

      {/* Manual add input (when clicking + Add custom without typing) */}
      {adding && !open && (
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            autoFocus
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmAdd();
              if (e.key === 'Escape') {
                setAdding(false);
                setNewVal('');
              }
            }}
            placeholder={'New ' + label.toLowerCase() + '…'}
            style={{
              flex: 1,
              padding: '7px 10px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--col-accent)',
              background: 'var(--col-bg-3)',
              color: 'var(--col-text)',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <button
            onClick={confirmAdd}
            style={{
              padding: '7px 10px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--col-accent)',
              border: 'none',
              color: '#fff',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Add
          </button>
          <button
            onClick={() => {
              setAdding(false);
              setNewVal('');
            }}
            style={{
              padding: '7px 8px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255,255,255,.08)',
              border: 'none',
              color: 'var(--col-text-2)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ─── SearchablePicker — searchable dropdown for brands/categories ─────────────
function SearchablePicker({ label, value, onChange, options, placeholder, action }) {
  const [search, setSearch] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  const filtered = search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const selected = options.find((o) => o.value === value);

  React.useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const select = (o) => {
    onChange(o.value);
    setOpen(false);
    setSearch('');
  };
  const clear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div
      ref={ref}
      style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--col-text-2)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {label}
        </span>
        {action}
      </div>
      <div style={{ position: 'relative' }}>
        <input
          value={open ? search : selected?.label || ''}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setSearch('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              setSearch('');
            }
            if (e.key === 'Enter' && filtered.length === 1) select(filtered[0]);
          }}
          placeholder={placeholder || `Search ${label.toLowerCase()}…`}
          style={{
            width: '100%',
            padding: '8px 28px 8px 12px',
            borderRadius: 'var(--radius-md)',
            border: open ? '1px solid var(--col-accent)' : '0.5px solid var(--col-border-2)',
            background: 'var(--col-bg-3)',
            color: selected && !open ? 'var(--col-text)' : 'var(--col-text-2)',
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {value && !open ? (
          <button
            onClick={clear}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--col-text-3)',
              fontSize: 15,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        ) : (
          <span
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--col-text-3)',
              fontSize: 10,
              pointerEvents: 'none',
            }}
          >
            ▾
          </span>
        )}
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 500,
            marginTop: 2,
            background: 'var(--col-bg-2)',
            border: '0.5px solid var(--col-border-2)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,.5)',
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--col-text-3)' }}>
              No results for "{search}"
            </div>
          ) : (
            filtered.map((o) => (
              <div
                key={o.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(o);
                }}
                style={{
                  padding: '8px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                  background: value === o.value ? 'rgba(233,69,96,.1)' : 'transparent',
                  borderBottom: '0.5px solid var(--col-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--col-bg-3)')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background =
                    value === o.value ? 'rgba(233,69,96,.1)' : 'transparent')
                }
              >
                <span>{o.label}</span>
                {value === o.value && (
                  <span style={{ color: 'var(--col-accent)', fontSize: 11 }}>✓</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const blank = {
  name: '',
  sku: '',
  brandId: '',
  categoryId: '',
  type: 'standard',
  price: '',
  cost: '',
  stock: '',
  threshold: '5',
  rentalRate: '',
  size: '',
  color: '',
  material: '',
  style: '',
  fabricWidth: '',
  fabricUnit: 'm',
  fabricDesign: '',
};

// ─── Variant row ──────────────────────────────────────────────────────────────
function VariantRow({ variant, onDelete }) {
  const attrs = variant.attributes?.map((a) => a.value).join(' · ') || '—';
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr 100px 100px 60px 28px',
        gap: 8,
        padding: '8px 10px',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(255,255,255,.03)',
        border: '0.5px solid var(--col-border)',
        alignItems: 'center',
        fontSize: 12,
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--col-teal)' }}>
        {variant.sku || '—'}
      </span>
      <span style={{ color: 'var(--col-text-2)', fontSize: 11 }}>{attrs}</span>
      <span>Rs {Number(variant.price || 0).toLocaleString()}</span>
      <span style={{ color: 'var(--col-text-3)' }}>
        Cost Rs {Number(variant.cost_price || 0).toLocaleString()}
      </span>
      <span
        style={{
          color:
            (variant.stock_qty_continuous > 0 ? variant.stock_qty_continuous : variant.stock_qty) <=
            (variant.low_stock_threshold || 5)
              ? 'var(--col-red)'
              : 'var(--col-text)',
        }}
      >
        {variant.stock_qty_continuous > 0
          ? `${Number(variant.stock_qty_continuous).toLocaleString()}${variant.fabric_unit || 'm'}`
          : (variant.stock_qty ?? 0)}
      </span>
      <button
        onClick={() => onDelete(variant.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--col-red)',
          fontSize: 14,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── QuickAdd brand/category ──────────────────────────────────────────────────
function QuickAddModal({ type, branchId, onSaved, onClose, parentCats = [] }) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) {
      toast.error(`${type} name is required`);
      return;
    }
    setSaving(true);
    try {
      const created =
        type === 'Brand'
          ? await productApi.createBrand(branchId, name.trim())
          : await productApi.createCategory(branchId, {
              name: name.trim(),
              parentId: parentId || null,
            });
      toast.success(`${type} "${name}" added`);
      onSaved(created);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={`Quick add ${type.toLowerCase()}`} onClose={onClose} width={360}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input
          label={`${type} name *`}
          value={name}
          onChange={setName}
          placeholder={type === 'Brand' ? 'e.g. Vantage, Ebony' : 'e.g. Shirts, Jeans'}
        />
        {type === 'Category' && parentCats.length > 0 && (
          <Select
            label="Parent category (optional)"
            value={parentId}
            onChange={setParentId}
            options={[
              { value: '', label: 'No parent (top level)' },
              ...parentCats.map((c) => ({ value: String(c.id), label: c.name })),
            ]}
          />
        )}
        <Flex gap={10} justify="flex-end">
          <Btn variant="secondary" onClick={onClose}>
            Cancel
          </Btn>
          <Btn onClick={save} disabled={saving}>
            {saving ? 'Adding…' : `Add ${type.toLowerCase()}`}
          </Btn>
        </Flex>
      </div>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Inventory() {
  const { activeBranchId: branchId } = useAuth();

  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fBrand, setFBrand] = useState('all');
  const [fType, setFType] = useState('all');

  // product modal
  const [showModal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfDel] = useState(null);

  // SKU — explicit generate button
  const [skuGenerating, setSkuGenerating] = useState(false);
  const [skuDuplicate, setSkuDuplicate] = useState(null); // null | existing variant object

  // quick-add brand/category
  const [quickAdd, setQuickAdd] = useState(null);

  // variant management
  const [variants, setVariants] = useState([]);
  const [loadingVars, setLoadingVars] = useState(false);
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [varForm, setVarForm] = useState({
    sku: '',
    price: '',
    cost: '',
    stock: '',
    size: '',
    color: '',
    material: '',
    style: '',
  });
  const [varSkuGenerating, setVarSkuGenerating] = useState(false);
  const [varSkuDuplicate, setVarSkuDuplicate] = useState(null);
  const [savingVar, setSavingVar] = useState(false);

  const f = (patch) => setForm((p) => ({ ...p, ...patch }));
  const vf = (patch) => setVarForm((p) => ({ ...p, ...patch }));

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    Promise.all([
      productApi.list(branchId, { limit: 200, page: 1 }),
      productApi.listBrands(branchId),
      productApi.listCategories(branchId),
    ])
      .then(([p, b, c]) => {
        setProducts(p.items || p.rows || p || []);
        setBrands(b || []);
        setCats(c || []);
      })
      .catch(() => toast.error('Failed to load inventory'))
      .finally(() => setLoading(false));
  }, [branchId]);

  // ── Generate SKU (explicit button click — no auto-trigger) ──────────────────
  const generateSku = async () => {
    const brand = brands.find((b) => String(b.id) === form.brandId);
    const cat = cats.find((c) => String(c.id) === form.categoryId);
    if (!brand || !cat) {
      toast.error('Select a Brand and Category first');
      return;
    }

    setSkuGenerating(true);
    setSkuDuplicate(null);
    f({ sku: '' });

    try {
      // 1. Get suggested SKU from backend
      const { suggestedSku } = await skuApi.suggest(branchId, {
        brandName: brand.name,
        categoryName: cat.name,
        productType: form.type,
        size: form.size || undefined,
        color: form.color || undefined,
        material: form.material || undefined,
      });

      // 2. Check if it already exists in this branch
      const { exists, variant } = await skuApi.check(branchId, suggestedSku);

      if (exists) {
        setSkuDuplicate(variant);
        f({ sku: '' });
        toast.error(
          `SKU "${suggestedSku}" already exists (${variant.product_name}). ` +
            `Change size/color/material to get a unique SKU, or add stock via GRN.`,
          { duration: 6000 },
        );
      } else {
        f({ sku: suggestedSku });
        toast.success(`SKU generated: ${suggestedSku}`);
      }
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message || 'Failed to generate SKU';
      console.error('[generateSku] error:', status, message, err.response?.data);
      toast.error(`SKU error ${status || ''}: ${message}`, { duration: 8000 });
    } finally {
      setSkuGenerating(false);
    }
  };

  // ── Generate variant SKU (explicit button inside variant panel) ───────────
  const generateVarSku = async () => {
    const product = products.find((p) => p.id === editing);
    const brand = brands.find((b) => String(b.id) === String(product?.brand_id || form.brandId));
    const cat = cats.find((c) => String(c.id) === String(product?.category_id || form.categoryId));
    if (!brand || !cat) {
      toast.error('Cannot resolve brand/category for this product');
      return;
    }

    setVarSkuGenerating(true);
    setVarSkuDuplicate(null);
    vf({ sku: '' });

    try {
      const { suggestedSku } = await skuApi.suggest(branchId, {
        brandName: brand.name,
        categoryName: cat.name,
        productType: form.type || 'standard',
        size: varForm.size || undefined,
        color: varForm.color || undefined,
        material: varForm.material || undefined,
      });

      const { exists, variant } = await skuApi.check(branchId, suggestedSku);

      if (exists) {
        setVarSkuDuplicate(variant);
        vf({ sku: '' });
        toast.error(
          `SKU "${suggestedSku}" already exists (${variant.product_name}). ` +
            `Change size/color/material.`,
          { duration: 6000 },
        );
      } else {
        vf({ sku: suggestedSku });
        toast.success(`Variant SKU generated: ${suggestedSku}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate SKU');
    } finally {
      setVarSkuGenerating(false);
    }
  };

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = products.filter((p) => {
    const s = search.toLowerCase();
    const ms =
      !search ||
      (p.name || '').toLowerCase().includes(s) ||
      (p.sku || '').toLowerCase().includes(s) ||
      (p.brand_name || '').toLowerCase().includes(s);
    const mb = fBrand === 'all' || String(p.brand_id) === fBrand;
    const mt =
      fType === 'all' ||
      (p.type_name || p.inventory_mode || '').toLowerCase().includes(fType.toLowerCase());
    return ms && mb && mt;
  });

  // ── Open add ──────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm(blank);
    setVariants([]);
    setShowAddVariant(false);
    setSkuDuplicate(null);
    setModal(true);
  };

  // ── Open edit ─────────────────────────────────────────────────────────────
  const openEdit = async (p) => {
    setEditing(p.id);
    const type = p.is_rentable
      ? 'rental'
      : p.inventory_mode === 'continuous'
        ? 'fabric'
        : 'standard';
    setForm({
      name: p.name || '',
      sku: p.sku || '',
      brandId: String(p.brand_id || ''),
      categoryId: String(p.category_id || ''),
      type,
      price: String(p.base_selling_price || p.price || ''),
      cost: String(p.cost_price || ''),
      stock: '',
      threshold: String(p.low_stock_threshold || 5),
      rentalRate: String(p.rental_day_rate || p.rental_price_per_day || ''),
      size: '',
      color: '',
      material: '',
      style: '',
      fabricUnit: p.fabric_unit || 'm',
      fabricWidth: String(p.fabric_width || ''),
      fabricDesign: p.fabric_design || '',
    });
    setVariants([]);
    setShowAddVariant(false);
    setSkuDuplicate(null);
    setVarSkuDuplicate(null);
    setModal(true);
    setLoadingVars(true);
    try {
      const v = await productApi.listVariants(p.id);
      setVariants(v || []);
    } catch {
      toast.error('Could not load variants');
    } finally {
      setLoadingVars(false);
    }
  };

  // ── Save product ──────────────────────────────────────────────────────────
  const saveProduct = async () => {
    if (!form.name.trim()) {
      toast.error('Product name is required');
      return;
    }

    if (!editing) {
      // SKU is mandatory — must be generated before saving
      if (!form.sku.trim()) {
        toast.error('Select a Brand and Category first — SKU is auto-generated from them');
        return;
      }
      // Block duplicate
      if (skuDuplicate) {
        toast.error('This SKU already exists — change the attributes or brand/category');
        return;
      }
    }

    setSaving(true);
    try {
      if (editing) {
        await productApi.update(editing, {
          name: form.name,
          brandId: form.brandId || null,
          categoryId: form.categoryId || null,
          description: '',
          isActive: true,
        });
        setProducts((prev) => prev.map((p) => (p.id === editing ? { ...p, name: form.name } : p)));
        toast.success('Product updated');
        setModal(false);
      } else {
        const finalSku = form.sku.trim(); // guaranteed non-empty from check above

        const created = await productApi.create(branchId, {
          name: form.name,
          sku: finalSku,
          brandId: form.brandId || null,
          categoryId: form.categoryId || null,
          productTypeId: TYPE_ID_MAP[form.type] || 1,
          description: '',
        });

        await productApi.createVariant(created.id, {
          sku: finalSku,
          price: parseFloat(form.price) || 0,
          costPrice: parseFloat(form.cost) || 0,
          rentalPricePerDay: form.type === 'rental' ? parseFloat(form.rentalRate) || null : null,
          stockQty: form.type === 'fabric' ? 0 : parseFloat(form.stock) || 0,
          stockQtyContinuous: form.type === 'fabric' ? parseFloat(form.stock) || 0 : 0,
          lowStockThreshold: parseInt(form.threshold) || 5,
          attributeValueIds: [],
          size: form.size || null,
          color: form.color || null,
          material: form.material || null,
          style: form.style || null,
          fabricWidth: form.type === 'fabric' ? parseFloat(form.fabricWidth) || null : null,
          fabricUnit: form.type === 'fabric' ? form.fabricUnit || 'm' : null,
          fabricDesign: form.type === 'fabric' ? form.fabricDesign || null : null,
        });

        const refreshed = await productApi.list(branchId, { limit: 200, page: 1 });
        setProducts(refreshed.items || refreshed.rows || refreshed || []);
        toast.success(`"${form.name}" added — SKU: ${finalSku}`);
        setModal(false);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Save failed';
      // Postgres unique violation on SKU
      if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplicate')) {
        toast.error(`SKU "${form.sku}" already exists in this branch`);
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Save variant ──────────────────────────────────────────────────────────
  const saveVariant = async () => {
    if (!varForm.price) {
      toast.error('Selling price is required');
      return;
    }
    if (varSkuDuplicate) {
      toast.error('This variant SKU already exists — change the attributes');
      return;
    }
    setSavingVar(true);
    try {
      let finalSku = varForm.sku.trim();
      if (!finalSku) {
        const product = products.find((p) => p.id === editing);
        const brand = brands.find((b) => String(b.id) === String(product?.brand_id));
        const cat = cats.find((c) => String(c.id) === String(product?.category_id));
        if (brand && cat) {
          try {
            const res = await skuApi.suggest(branchId, {
              brandName: brand.name,
              categoryName: cat.name,
              productType: form.type || 'standard',
              size: varForm.size || undefined,
              color: varForm.color || undefined,
              material: varForm.material || undefined,
            });
            finalSku = res.suggestedSku;
          } catch {
            /* leave blank */
          }
        }
      }
      const newVar = await productApi.createVariant(editing, {
        sku: finalSku || undefined,
        price: parseFloat(varForm.price) || 0,
        costPrice: parseFloat(varForm.cost) || 0,
        stockQty: parseFloat(varForm.stock) || 0,
        lowStockThreshold: parseInt(form.threshold) || 5,
        rentalPricePerDay: null,
        attributeValueIds: [],
        size: varForm.size || null,
        color: varForm.color || null,
        material: varForm.material || null,
        style: varForm.style || null,
      });
      setVariants((prev) => [...prev, newVar]);
      setVarForm({
        sku: '',
        price: '',
        cost: '',
        stock: '',
        size: '',
        color: '',
        material: '',
        style: '',
      });
      setVarSkuDuplicate(null);
      setShowAddVariant(false);
      toast.success(finalSku ? `Variant added — ${finalSku}` : 'Variant added');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to add variant';
      if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplicate')) {
        toast.error(`SKU "${varForm.sku}" already exists`);
      } else {
        toast.error(msg);
      }
    } finally {
      setSavingVar(false);
    }
  };

  const deleteVariant = async (id) => {
    try {
      await productApi.deleteVariant(id);
      setVariants((prev) => prev.filter((v) => v.id !== id));
      toast.success('Variant removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot delete — variant has sales history');
    }
  };

  const deleteProduct = async (id) => {
    try {
      await productApi.delete(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setConfDel(null);
      toast.success('Product deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const brandOpts = [
    { value: '', label: 'Select brand' },
    ...brands.map((b) => ({ value: String(b.id), label: b.name })),
  ];
  const catOpts = [
    { value: '', label: 'Select category' },
    ...cats.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  const getBadgeVariant = (p) =>
    p.is_rentable ? 'amber' : p.inventory_mode === 'continuous' ? 'teal' : 'default';
  const getTypeLabel = (p) =>
    p.is_rentable ? 'rental' : p.inventory_mode === 'continuous' ? 'fabric' : 'standard';

  const addNewLinkStyle = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--col-accent)',
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 4px',
    textDecoration: 'underline',
  };

  if (loading)
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '40vh',
          color: 'var(--col-text-2)',
        }}
      >
        Loading inventory…
      </div>
    );

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader title="Inventory" action={<Btn onClick={openAdd}>+ Add product</Btn>} />

      <Flex gap={10} align="center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, SKU or brand…"
          style={{
            flex: 1,
            minWidth: 180,
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            border: '0.5px solid var(--col-border-2)',
            background: 'var(--col-bg-3)',
            color: 'var(--col-text)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <select
          value={fBrand}
          onChange={(e) => setFBrand(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            border: '0.5px solid var(--col-border-2)',
            background: 'var(--col-bg-3)',
            color: 'var(--col-text)',
            fontSize: 12,
          }}
        >
          <option value="all">All brands</option>
          {brands.map((b) => (
            <option key={b.id} value={String(b.id)}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={fType}
          onChange={(e) => setFType(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            border: '0.5px solid var(--col-border-2)',
            background: 'var(--col-bg-3)',
            color: 'var(--col-text)',
            fontSize: 12,
          }}
        >
          <option value="all">All types</option>
          {TYPE_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: 'var(--col-text-3)' }}>{filtered.length} products</span>
      </Flex>

      <Card flush>
        {filtered.length === 0 ? (
          <EmptyState
            icon="👕"
            title="No products found"
            sub="Add your first product or adjust filters"
          />
        ) : (
          <Table
            columns={[
              {
                key: 'sku',
                label: 'SKU',
                render: (r) => (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--col-teal)',
                    }}
                  >
                    {r.sku || '—'}
                  </span>
                ),
              },
              {
                key: 'name',
                label: 'Product',
                render: (r) => (
                  <div>
                    <div style={{ fontWeight: 500 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--col-text-3)' }}>
                      {r.category_name || '—'}
                    </div>
                  </div>
                ),
              },
              { key: 'brand', label: 'Brand', render: (r) => r.brand_name || '—' },
              {
                key: 'type',
                label: 'Type',
                render: (r) => (
                  <Badge label={getTypeLabel(r)} variant={getBadgeVariant(r)} size="sm" />
                ),
              },
              {
                key: 'price',
                label: 'Price',
                render: (r) =>
                  r.is_rentable ? (
                    <Badge
                      label={`Rs ${r.rental_price_per_day || 0}/day`}
                      variant="amber"
                      size="sm"
                    />
                  ) : (
                    `Rs ${Number(r.price || r.base_selling_price || 0).toLocaleString()}`
                  ),
              },
              {
                key: 'stock',
                label: 'Stock',
                render: (r) => {
                  const isFabric = r.inventory_mode === 'continuous';
                  const meters = Number(r.total_stock_continuous ?? 0);
                  const rolls = Number(r.total_stock ?? 0); // rolls = discrete stock_qty still used for roll count via GRN barcodes
                  const qty = isFabric ? meters : Number(r.total_stock ?? r.stock_qty ?? 0);
                  const unit = isFabric ? r.fabric_unit || 'm' : '';
                  const low = qty <= (r.low_stock_threshold || 5);
                  return (
                    <span style={{ color: low ? 'var(--col-red)' : 'var(--col-text)' }}>
                      {isFabric ? `${meters}${unit}` : qty}
                      {low && <Badge label="Low" variant="red" size="sm" />}
                    </span>
                  );
                },
              },
              {
                key: 'actions',
                label: '',
                render: (r) => (
                  <Flex gap={6}>
                    <Btn variant="ghost" size="sm" onClick={() => openEdit(r)}>
                      Edit / Variants
                    </Btn>
                    <Btn variant="danger" size="sm" onClick={() => setConfDel(r)}>
                      Del
                    </Btn>
                  </Flex>
                ),
              },
            ]}
            rows={filtered}
          />
        )}
      </Card>

      {/* ════ PRODUCT MODAL ════ */}
      {showModal && (
        <Modal
          title={editing ? 'Edit product — variants' : 'Add product'}
          onClose={() => setModal(false)}
          width={640}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Select
              label="Product type"
              value={form.type}
              onChange={(v) => {
                const patch = { type: v };
                if (v === 'fabric') {
                  // Auto-set category to a "Fabric" category if one exists
                  const fabricCat = cats.find((c) => c.name.toLowerCase().includes('fabric'));
                  if (fabricCat) patch.categoryId = String(fabricCat.id);
                }
                f(patch);
                setSkuDuplicate(null);
              }}
              options={TYPE_OPTS}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input
                label="Product name *"
                value={form.name}
                onChange={(v) => f({ name: v })}
                placeholder="e.g. Ultra Slim Fit Jeans"
              />

              {/* SKU field + Generate button */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--col-text-2)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  SKU
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={form.sku}
                    onChange={(e) => {
                      f({ sku: e.target.value });
                      setSkuDuplicate(null);
                    }}
                    readOnly={!!editing}
                    placeholder={editing ? '—' : 'Click Generate SKU →'}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: skuDuplicate
                        ? '1.5px solid var(--col-amber)'
                        : form.sku
                          ? '1px solid var(--col-teal)'
                          : '0.5px solid var(--col-border-2)',
                      background: 'var(--col-bg-3)',
                      color: 'var(--col-text)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                  {!editing && (
                    <button
                      onClick={generateSku}
                      disabled={skuGenerating || !form.brandId || !form.categoryId}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background:
                          !form.brandId || !form.categoryId
                            ? 'rgba(255,255,255,.06)'
                            : 'var(--col-accent)',
                        color: !form.brandId || !form.categoryId ? 'var(--col-text-3)' : '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: !form.brandId || !form.categoryId ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all .15s',
                        opacity: skuGenerating ? 0.7 : 1,
                      }}
                    >
                      {skuGenerating ? '…' : '⚡ Generate SKU'}
                    </button>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    color: skuDuplicate
                      ? 'var(--col-amber)'
                      : form.sku
                        ? 'var(--col-teal)'
                        : 'var(--col-text-3)',
                  }}
                >
                  {skuDuplicate
                    ? `⚠ Already exists — change size/color/material`
                    : form.sku
                      ? `✓ SKU ready`
                      : `Select Brand + Category, then click Generate SKU`}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <SearchablePicker
                label="Brand"
                value={form.brandId}
                onChange={(v) => {
                  f({ brandId: v });
                  setSkuDuplicate(null);
                  f({ sku: '' });
                }}
                options={brands.map((b) => ({ value: String(b.id), label: b.name }))}
                placeholder="Search brand…"
                action={
                  <button style={addNewLinkStyle} onClick={() => setQuickAdd('Brand')}>
                    + New brand
                  </button>
                }
              />
              <SearchablePicker
                label="Category"
                value={form.categoryId}
                onChange={(v) => {
                  f({ categoryId: v });
                  setSkuDuplicate(null);
                  f({ sku: '' });
                }}
                options={cats.map((c) => ({ value: String(c.id), label: c.name }))}
                placeholder="Search category…"
                action={
                  <button style={addNewLinkStyle} onClick={() => setQuickAdd('Category')}>
                    + New category
                  </button>
                }
              />
            </div>

            {/* ADD mode: first variant */}
            {!editing && (
              <>
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(233,69,96,.06)',
                    border: '0.5px solid rgba(233,69,96,.15)',
                    fontSize: 11,
                    color: 'var(--col-text-2)',
                  }}
                >
                  These fields create the{' '}
                  <strong style={{ color: 'var(--col-text)' }}>first variant</strong>. Add more
                  sizes/colours via Edit → Add variant after saving.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {form.type === 'rental' ? (
                    <Input
                      label="Rental rate / day (Rs)"
                      type="number"
                      value={form.rentalRate}
                      onChange={(v) => f({ rentalRate: v })}
                      placeholder="500"
                    />
                  ) : form.type === 'fabric' ? (
                    <Input
                      label="Selling price per meter/yard (Rs)"
                      type="number"
                      value={form.price}
                      onChange={(v) => f({ price: v })}
                      placeholder="0"
                    />
                  ) : (
                    <Input
                      label="Selling price (Rs)"
                      type="number"
                      value={form.price}
                      onChange={(v) => f({ price: v })}
                      placeholder="0"
                    />
                  )}
                  <Input
                    label="Cost price (Rs)"
                    type="number"
                    value={form.cost}
                    onChange={(v) => f({ cost: v })}
                    placeholder="0"
                  />
                </div>

                {/* Fabric-specific fields */}
                {form.type === 'fabric' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            color: 'var(--col-text-2)',
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                          }}
                        >
                          Unit
                        </span>
                        <select
                          value={form.fabricUnit || 'm'}
                          onChange={(e) => f({ fabricUnit: e.target.value })}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: '0.5px solid var(--col-border-2)',
                            background: 'var(--col-bg-3)',
                            color: 'var(--col-text)',
                            fontSize: 13,
                            outline: 'none',
                          }}
                        >
                          <option value="m">Meters (m)</option>
                          <option value="yd">Yards (yd)</option>
                        </select>
                      </div>
                      <Input
                        label={`Width (${form.fabricUnit || 'm'})`}
                        type="number"
                        value={form.fabricWidth || ''}
                        onChange={(v) => f({ fabricWidth: v })}
                        placeholder="1.5"
                      />
                      <Input
                        label="Opening length"
                        type="number"
                        value={form.stock}
                        onChange={(v) => f({ stock: v })}
                        placeholder="0"
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <Input
                        label="Design / pattern"
                        value={form.fabricDesign || ''}
                        onChange={(v) => f({ fabricDesign: v })}
                        placeholder="e.g. Floral, Stripes"
                      />
                      <Input
                        label="Low stock threshold"
                        type="number"
                        value={form.threshold}
                        onChange={(v) => f({ threshold: v })}
                        placeholder="5"
                      />
                    </div>
                  </>
                )}

                {/* Non-fabric stock fields */}
                {form.type !== 'fabric' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Input
                      label="Opening stock (units)"
                      type="number"
                      value={form.stock}
                      onChange={(v) => f({ stock: v })}
                      placeholder="0"
                    />
                    <Input
                      label="Low stock threshold"
                      type="number"
                      value={form.threshold}
                      onChange={(v) => f({ threshold: v })}
                      placeholder="5"
                    />
                  </div>
                )}

                <div style={{ paddingTop: 8, borderTop: '0.5px solid var(--col-border)' }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: 'var(--col-text-2)',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 10,
                    }}
                  >
                    Variant attributes
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 10,
                        fontWeight: 400,
                        color: 'var(--col-teal)',
                        textTransform: 'none',
                      }}
                    >
                      — changing these updates the SKU
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {form.type !== 'fabric' && (
                      <AttributePicker
                        label="Size"
                        attrKey="size"
                        defaults={DEFAULT_SIZES}
                        value={form.size}
                        onChange={(v) => f({ size: v })}
                        onSkuReset={() => {
                          setSkuDuplicate(null);
                          f({ sku: '' });
                        }}
                      />
                    )}
                    <AttributePicker
                      label="Color"
                      attrKey="color"
                      defaults={DEFAULT_COLORS}
                      value={form.color}
                      onChange={(v) => f({ color: v })}
                      onSkuReset={() => {
                        setSkuDuplicate(null);
                        f({ sku: '' });
                      }}
                    />
                    <AttributePicker
                      label="Material"
                      attrKey="material"
                      defaults={DEFAULT_MATERIALS}
                      value={form.material}
                      onChange={(v) => f({ material: v })}
                      onSkuReset={() => {
                        setSkuDuplicate(null);
                        f({ sku: '' });
                      }}
                    />
                    {form.type !== 'fabric' && (
                      <AttributePicker
                        label="Style"
                        attrKey="style"
                        defaults={DEFAULT_STYLES}
                        value={form.style}
                        onChange={(v) => f({ style: v })}
                      />
                    )}
                  </div>
                </div>
              </>
            )}

            {/* EDIT mode: variant list */}
            {editing && (
              <div>
                <Flex justify="space-between" align="center" style={{ marginBottom: 10 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: 'var(--col-text-2)',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Variants ({loadingVars ? '…' : variants.length})
                  </span>
                  <Btn
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setShowAddVariant((v) => !v);
                      setVarSkuDuplicate(null);
                      setVarForm({
                        sku: '',
                        price: '',
                        cost: '',
                        stock: '',
                        size: '',
                        color: '',
                        material: '',
                        style: '',
                      });
                    }}
                  >
                    {showAddVariant ? '− Cancel' : '+ Add variant'}
                  </Btn>
                </Flex>

                {loadingVars ? (
                  <div
                    style={{
                      padding: '1rem',
                      textAlign: 'center',
                      color: 'var(--col-text-3)',
                      fontSize: 12,
                    }}
                  >
                    Loading…
                  </div>
                ) : variants.length === 0 ? (
                  <div
                    style={{
                      padding: '1rem',
                      textAlign: 'center',
                      color: 'var(--col-text-3)',
                      fontSize: 12,
                    }}
                  >
                    No variants yet.
                  </div>
                ) : (
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.4fr 1fr 100px 100px 60px 28px',
                        gap: 8,
                        padding: '0 10px',
                      }}
                    >
                      {['SKU', 'Attributes', 'Price', 'Cost', 'Stock', ''].map((h) => (
                        <span
                          key={h}
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            color: 'var(--col-text-3)',
                            textTransform: 'uppercase',
                            letterSpacing: 0.4,
                          }}
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                    {variants.map((v) => (
                      <VariantRow key={v.id} variant={v} onDelete={deleteVariant} />
                    ))}
                  </div>
                )}

                {showAddVariant && (
                  <div
                    style={{
                      padding: '14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(233,69,96,.05)',
                      border: '0.5px solid rgba(233,69,96,.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      marginTop: 8,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--col-accent)' }}>
                      New variant
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: 'var(--col-text-2)',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        Variant SKU
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          value={varForm.sku}
                          onChange={(e) => {
                            vf({ sku: e.target.value });
                            setVarSkuDuplicate(null);
                          }}
                          placeholder="Click Generate SKU →"
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: varSkuDuplicate
                              ? '1.5px solid var(--col-amber)'
                              : varForm.sku
                                ? '1px solid var(--col-teal)'
                                : '0.5px solid var(--col-border-2)',
                            background: 'var(--col-bg-3)',
                            color: 'var(--col-text)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 12,
                            outline: 'none',
                          }}
                        />
                        <button
                          onClick={generateVarSku}
                          disabled={varSkuGenerating}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            background: 'var(--col-accent)',
                            color: '#fff',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            opacity: varSkuGenerating ? 0.7 : 1,
                          }}
                        >
                          {varSkuGenerating ? '…' : '⚡ Generate'}
                        </button>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          color: varSkuDuplicate
                            ? 'var(--col-amber)'
                            : varForm.sku
                              ? 'var(--col-teal)'
                              : 'var(--col-text-3)',
                        }}
                      >
                        {varSkuDuplicate
                          ? '⚠ Already exists — change size/color/material'
                          : varForm.sku
                            ? '✓ SKU ready'
                            : 'Pick attributes then click Generate'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <Input
                        label="Selling price *"
                        type="number"
                        value={varForm.price}
                        onChange={(v) => vf({ price: v })}
                        placeholder="0"
                      />
                      <Input
                        label="Cost price"
                        type="number"
                        value={varForm.cost}
                        onChange={(v) => vf({ cost: v })}
                        placeholder="0"
                      />
                      <Input
                        label="Opening stock"
                        type="number"
                        value={varForm.stock}
                        onChange={(v) => vf({ stock: v })}
                        placeholder="0"
                      />
                    </div>
                    <div
                      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}
                    >
                      <AttributePicker
                        label="Size"
                        attrKey="size"
                        defaults={DEFAULT_SIZES}
                        value={varForm.size}
                        onChange={(v) => vf({ size: v })}
                        onSkuReset={() => {
                          setVarSkuDuplicate(null);
                          vf({ sku: '' });
                        }}
                      />
                      <AttributePicker
                        label="Color"
                        attrKey="color"
                        defaults={DEFAULT_COLORS}
                        value={varForm.color}
                        onChange={(v) => vf({ color: v })}
                        onSkuReset={() => {
                          setVarSkuDuplicate(null);
                          vf({ sku: '' });
                        }}
                      />
                      <AttributePicker
                        label="Material"
                        attrKey="material"
                        defaults={DEFAULT_MATERIALS}
                        value={varForm.material}
                        onChange={(v) => vf({ material: v })}
                        onSkuReset={() => {
                          setVarSkuDuplicate(null);
                          vf({ sku: '' });
                        }}
                      />
                      <AttributePicker
                        label="Style"
                        attrKey="style"
                        defaults={DEFAULT_STYLES}
                        value={varForm.style}
                        onChange={(v) => vf({ style: v })}
                      />
                    </div>
                    <Flex gap={8} justify="flex-end">
                      <Btn variant="secondary" size="sm" onClick={() => setShowAddVariant(false)}>
                        Cancel
                      </Btn>
                      <Btn
                        size="sm"
                        onClick={saveVariant}
                        disabled={savingVar || !varForm.sku.trim() || !!varSkuDuplicate}
                      >
                        {savingVar
                          ? 'Adding…'
                          : !varForm.sku.trim()
                            ? 'Generate SKU first'
                            : 'Add variant'}
                      </Btn>
                    </Flex>
                  </div>
                )}
              </div>
            )}

            <Flex
              gap={10}
              justify="flex-end"
              style={{ paddingTop: 10, borderTop: '0.5px solid var(--col-border)' }}
            >
              <Btn variant="secondary" onClick={() => setModal(false)}>
                {editing ? 'Close' : 'Cancel'}
              </Btn>
              {!editing && (
                <Btn onClick={saveProduct} disabled={saving || !form.sku.trim() || !!skuDuplicate}>
                  {saving ? 'Saving…' : !form.sku.trim() ? 'Generate SKU first' : 'Add product'}
                </Btn>
              )}
              {editing && (
                <Btn onClick={saveProduct} disabled={saving}>
                  {saving ? 'Updating…' : 'Update product'}
                </Btn>
              )}
            </Flex>
          </div>
        </Modal>
      )}

      {/* Quick-add Brand / Category */}
      {quickAdd && (
        <QuickAddModal
          type={quickAdd}
          branchId={branchId}
          parentCats={cats}
          onClose={() => setQuickAdd(null)}
          onSaved={(created) => {
            if (quickAdd === 'Brand') {
              setBrands((prev) => [...prev, created]);
              f({ brandId: String(created.id) });
            } else {
              setCats((prev) => [...prev, created]);
              f({ categoryId: String(created.id) });
            }
            setSkuDuplicate(null);
            f({ sku: '' });
            setQuickAdd(null);
          }}
        />
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <Modal title="Delete product" onClose={() => setConfDel(null)} width={380}>
          <p style={{ fontSize: 13, color: 'var(--col-text-2)', marginBottom: 16 }}>
            Delete <strong style={{ color: 'var(--col-text)' }}>{confirmDel.name}</strong> and all
            its variants?
          </p>
          <Flex gap={10} justify="flex-end">
            <Btn variant="secondary" onClick={() => setConfDel(null)}>
              Cancel
            </Btn>
            <Btn variant="danger" onClick={() => deleteProduct(confirmDel.id)}>
              Delete
            </Btn>
          </Flex>
        </Modal>
      )}
    </div>
  );
}
