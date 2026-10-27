import React, { useState, useEffect, useCallback } from 'react';
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
  Divider,
} from '../ui';
import { useAuth } from '../../context/AuthContext';
import { discountApi, productApi, grnApi } from '../../api';

// ─── helpers ─────────────────────────────────────────────────────────────────
const blank = {
  name: '',
  discountType: 'seasonal',
  valueType: 'percentage',
  value: '',
  validFrom: '',
  validUntil: '',
  // seasonal
  brandId: '',
  conditionMinPrice: '',
  conditionValue: '',
  // bulk
  grnNo: '',
  grnId: '',
};

function InfoBox({
  children,
  color = 'rgba(0,180,216,.08)',
  border = 'rgba(0,180,216,.2)',
  textColor = 'var(--col-teal)',
}) {
  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: color,
        border: `0.5px solid ${border}`,
        fontSize: 12,
        color: textColor,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function Discounts() {
  const { user } = useAuth();
  const { activeBranchId: branchId, branchSettings } = useAuth();
  const isOwner = user?.role === 'owner';

  const [discounts, setDiscounts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | seasonal | bulk

  const [showModal, setModal] = useState(false);
  const [editing, setEditing] = useState(null); // discount obj
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  // GRN lookup state (for bulk discounts)
  const [grnSearch, setGrnSearch] = useState('');
  const [grnLookup, setGrnLookup] = useState(null); // found GRN object
  const [lookingUp, setLookingUp] = useState(false);

  const f = (patch) => setForm((p) => ({ ...p, ...patch }));

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    Promise.all([discountApi.list(branchId), productApi.listBrands(branchId)])
      .then(([discData, brandData]) => {
        setDiscounts(discData || []);
        setBrands(brandData || []);
      })
      .catch(() => toast.error('Failed to load discounts'))
      .finally(() => setLoading(false));
  }, [branchId]);

  const reload = useCallback(async () => {
    if (!branchId) return;
    const data = await discountApi.list(branchId);
    setDiscounts(data || []);
  }, [branchId]);

  // ── GRN lookup (bulk discount) ────────────────────────────────────────────
  const lookupGRN = async () => {
    if (!grnSearch.trim()) {
      toast.error('Enter a GRN number');
      return;
    }
    setLookingUp(true);
    try {
      const found = await grnApi.lookupGRN(branchId, grnSearch.trim());
      setGrnLookup(found);
      f({ grnId: String(found.id), grnNo: found.grn_no });
      toast.success(`GRN found: ${found.grn_no}`);
    } catch {
      setGrnLookup(null);
      f({ grnId: '', grnNo: '' });
      toast.error(`GRN "${grnSearch}" not found`);
    } finally {
      setLookingUp(false);
    }
  };

  // ── Open add ──────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm(blank);
    setGrnSearch('');
    setGrnLookup(null);
    setModal(true);
  };

  // ── Open edit ─────────────────────────────────────────────────────────────
  const openEdit = (d) => {
    setEditing(d);
    setForm({
      name: d.name || '',
      discountType: d.discount_type || 'seasonal',
      valueType: d.value_type || 'percentage',
      value: String(d.value || ''),
      validFrom: d.valid_from ? d.valid_from.slice(0, 10) : '',
      validUntil: d.valid_until ? d.valid_until.slice(0, 10) : '',
      brandId: String(d.brand_id || ''),
      conditionMinPrice: String(d.condition_min_price || ''),
      conditionValue: String(d.condition_value || ''),
      grnNo: d.grn_no || '',
      grnId: String(d.grn_id || ''),
    });
    setGrnSearch(d.grn_no || '');
    setGrnLookup(d.grn_no ? { id: d.grn_id, grn_no: d.grn_no } : null);
    setModal(true);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Discount name is required');
      return;
    }
    if (!form.value) {
      toast.error('Discount value is required');
      return;
    }
    if (parseFloat(form.value) <= 0) {
      toast.error('Value must be greater than 0');
      return;
    }
    if (form.valueType === 'percentage' && parseFloat(form.value) > 100) {
      toast.error('Percentage cannot exceed 100');
      return;
    }
    if (form.discountType === 'seasonal' && !form.brandId) {
      toast.error('Select a brand for seasonal discount');
      return;
    }
    if (form.discountType === 'bulk' && !form.grnId) {
      toast.error('Search and select a GRN for bulk discount');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        discountType: form.discountType,
        valueType: form.valueType,
        value: parseFloat(form.value),
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        // seasonal
        brandId: form.discountType === 'seasonal' ? parseInt(form.brandId) || null : undefined,
        conditionMinPrice:
          form.discountType === 'seasonal' && form.conditionMinPrice
            ? parseFloat(form.conditionMinPrice)
            : null,
        conditionValue:
          form.discountType === 'seasonal' && form.conditionValue
            ? parseFloat(form.conditionValue)
            : null,
        // bulk
        grnId: form.discountType === 'bulk' ? parseInt(form.grnId) || null : undefined,
      };

      if (editing) {
        await discountApi.update(editing.id, {
          name: payload.name,
          valueType: payload.valueType,
          value: payload.value,
          validFrom: payload.validFrom,
          validUntil: payload.validUntil,
          isActive: true,
        });
        toast.success('Discount updated');
      } else {
        await discountApi.create(branchId, payload);
        toast.success('Discount created');
      }
      await reload();
      setModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const del = async (id) => {
    try {
      await discountApi.delete(id);
      await reload();
      setConfirmDel(null);
      toast.success('Discount deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  // ── Toggle active ─────────────────────────────────────────────────────────
  const toggleActive = async (d) => {
    try {
      await discountApi.update(d.id, { isActive: !d.is_active });
      await reload();
      toast.success(d.is_active ? 'Discount deactivated' : 'Discount activated');
    } catch (err) {
      toast.error('Update failed');
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const brandOpts = [
    { value: '', label: 'Select brand *' },
    ...brands.map((b) => ({ value: String(b.id), label: b.name })),
  ];

  const filtered =
    filter === 'all' ? discounts : discounts.filter((d) => d.discount_type === filter);

  const seasonalCount = discounts.filter(
    (d) => d.discount_type === 'seasonal' && d.is_active,
  ).length;
  const bulkCount = discounts.filter((d) => d.discount_type === 'bulk' && d.is_active).length;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
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
        Loading discounts…
      </div>
    );

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <SectionHeader title="Discounts" action={<Btn onClick={openAdd}>+ Add discount</Btn>} />

      {/* ── Priority rule notice ────────────────────────────────────────────── */}
      <InfoBox>
        <strong>Priority rule:</strong> If both a Seasonal and a Bulk discount apply to the same
        product, the <strong>Seasonal discount always wins</strong> and the Bulk discount is
        ignored. Discounts are never combined on a single item.
      </InfoBox>

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Total discounts', value: discounts.length, accent: 'var(--col-teal)' },
          {
            label: 'Active seasonal',
            value: seasonalCount,
            sub: 'Brand-level discounts',
            accent: 'var(--col-accent)',
          },
          {
            label: 'Active bulk',
            value: bulkCount,
            sub: 'GRN-linked discounts',
            accent: 'var(--col-gold)',
          },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: 'var(--col-panel)',
              border: '0.5px solid var(--col-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '12px 14px',
              borderLeft: `3px solid ${s.accent}`,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: 'var(--col-text-2)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: 5,
              }}
            >
              {s.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{s.value}</div>
            {s.sub && (
              <div style={{ fontSize: 10, color: 'var(--col-text-3)', marginTop: 3 }}>{s.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* ── Filter tabs ─────────────────────────────────────────────────────── */}
      <Flex gap={6}>
        {['all', 'seasonal', 'bulk'].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            style={{
              padding: '5px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              background: filter === t ? 'var(--col-accent)' : 'rgba(255,255,255,.06)',
              color: filter === t ? '#fff' : 'var(--col-text-2)',
              border: `0.5px solid ${filter === t ? 'var(--col-accent)' : 'var(--col-border-2)'}`,
              transition: 'all var(--transition)',
            }}
          >
            {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </Flex>

      {/* ── Discount table ──────────────────────────────────────────────────── */}
      <Card flush>
        {filtered.length === 0 ? (
          <EmptyState
            icon="🏷️"
            title="No discounts yet"
            sub={
              filter !== 'all'
                ? `No ${filter} discounts found`
                : 'Create your first seasonal or bulk discount'
            }
          />
        ) : (
          <Table
            columns={[
              {
                key: 'name',
                label: 'Name',
                render: (r) => (
                  <div>
                    <div style={{ fontWeight: 500 }}>{r.name}</div>
                    {r.discount_type === 'seasonal' && r.brand_name && (
                      <div style={{ fontSize: 11, color: 'var(--col-text-3)' }}>
                        Brand: {r.brand_name}
                      </div>
                    )}
                    {r.discount_type === 'bulk' && r.grn_no && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--col-text-3)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        GRN: {r.grn_no}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'discount_type',
                label: 'Type',
                render: (r) => (
                  <Badge
                    label={r.discount_type}
                    variant={r.discount_type === 'seasonal' ? 'purple' : 'amber'}
                  />
                ),
              },
              {
                key: 'value',
                label: 'Value',
                render: (r) => (
                  <span style={{ fontWeight: 600 }}>
                    {r.value_type === 'percentage'
                      ? `${r.value}%`
                      : `Rs ${Number(r.value).toLocaleString()} flat`}
                  </span>
                ),
              },
              {
                key: 'condition',
                label: 'Condition',
                render: (r) => {
                  if (r.discount_type !== 'seasonal')
                    return <span style={{ color: 'var(--col-text-3)' }}>—</span>;
                  if (!r.condition_min_price)
                    return <Badge label="Always applies" variant="green" size="sm" />;
                  return (
                    <span style={{ fontSize: 11, color: 'var(--col-text-2)' }}>
                      Price {'>'} Rs {Number(r.condition_min_price).toLocaleString()}
                      {r.condition_value && (
                        <> → Rs {Number(r.condition_value).toLocaleString()} off</>
                      )}
                    </span>
                  );
                },
              },
              {
                key: 'validity',
                label: 'Valid',
                render: (r) => {
                  if (!r.valid_from && !r.valid_until)
                    return <span style={{ color: 'var(--col-text-3)' }}>Always</span>;
                  return (
                    <span style={{ fontSize: 11, color: 'var(--col-text-2)' }}>
                      {r.valid_from?.slice(0, 10) || '—'} → {r.valid_until?.slice(0, 10) || '—'}
                    </span>
                  );
                },
              },
              {
                key: 'status',
                label: 'Status',
                render: (r) => (
                  <Badge
                    label={r.is_active ? 'Active' : 'Inactive'}
                    variant={r.is_active ? 'green' : 'default'}
                    size="sm"
                  />
                ),
              },
              {
                key: 'actions',
                label: '',
                render: (r) => (
                  <Flex gap={6}>
                    {isOwner && (
                      <Btn variant="ghost" size="sm" onClick={() => toggleActive(r)}>
                        {r.is_active ? 'Deactivate' : 'Activate'}
                      </Btn>
                    )}
                    {isOwner && (
                      <Btn variant="ghost" size="sm" onClick={() => openEdit(r)}>
                        Edit
                      </Btn>
                    )}
                    {isOwner && (
                      <Btn variant="danger" size="sm" onClick={() => setConfirmDel(r)}>
                        Del
                      </Btn>
                    )}
                    {!isOwner && (
                      <span style={{ fontSize: 11, color: 'var(--col-text-3)' }}>View only</span>
                    )}
                  </Flex>
                ),
              },
            ]}
            rows={filtered}
          />
        )}
      </Card>

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL: ADD / EDIT DISCOUNT
      ════════════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <Modal
          title={editing ? `Edit discount — ${editing.name}` : 'Add discount'}
          onClose={() => setModal(false)}
          width={520}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Discount name */}
            <Input
              label="Discount name *"
              value={form.name}
              onChange={(v) => f({ name: v })}
              placeholder="e.g. Emerald Mid-Season Sale"
            />

            {/* Type — only shown when adding, cannot change type on edit */}
            {!editing && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {['seasonal', 'bulk'].map((type) => (
                  <button
                    key={type}
                    onClick={() => f({ discountType: type })}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: 500,
                      fontSize: 13,
                      background:
                        form.discountType === type
                          ? type === 'seasonal'
                            ? 'rgba(233,69,96,.15)'
                            : 'rgba(245,166,35,.15)'
                          : 'rgba(255,255,255,.04)',
                      border:
                        form.discountType === type
                          ? type === 'seasonal'
                            ? '1px solid rgba(233,69,96,.4)'
                            : '1px solid rgba(245,166,35,.4)'
                          : '0.5px solid var(--col-border-2)',
                      color:
                        form.discountType === type
                          ? type === 'seasonal'
                            ? 'var(--col-accent)'
                            : 'var(--col-gold)'
                          : 'var(--col-text-2)',
                      transition: 'all var(--transition)',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>
                      {type === 'seasonal' ? '🏷 Seasonal' : '📦 Bulk'}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>
                      {type === 'seasonal'
                        ? 'Applies to a brand with optional conditions'
                        : 'Applies to items from a specific GRN'}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {editing && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,255,255,.04)',
                  fontSize: 12,
                  color: 'var(--col-text-2)',
                }}
              >
                Type:{' '}
                <Badge
                  label={form.discountType}
                  variant={form.discountType === 'seasonal' ? 'purple' : 'amber'}
                  size="sm"
                />
                &nbsp; — discount type cannot be changed after creation.
              </div>
            )}

            <Divider />

            {/* ── Value ─────────────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Select
                label="Discount type"
                value={form.valueType}
                onChange={(v) => f({ valueType: v })}
                options={[
                  { value: 'percentage', label: 'Percentage (%)' },
                  { value: 'flat', label: 'Flat amount (Rs)' },
                ]}
              />
              <Input
                label={form.valueType === 'percentage' ? 'Percentage *' : 'Flat amount (Rs) *'}
                type="number"
                value={form.value}
                onChange={(v) => f({ value: v })}
                placeholder={form.valueType === 'percentage' ? 'e.g. 10' : 'e.g. 500'}
              />
            </div>

            {/* ── Validity dates (optional) ─────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input
                label="Valid from (optional)"
                type="date"
                value={form.validFrom}
                onChange={(v) => f({ validFrom: v })}
              />
              <Input
                label="Valid until (optional)"
                type="date"
                value={form.validUntil}
                onChange={(v) => f({ validUntil: v })}
              />
            </div>

            <Divider />

            {/* ── SEASONAL: brand + condition ───────────────────────────────── */}
            {form.discountType === 'seasonal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--col-accent)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Seasonal discount settings
                </div>

                <Select
                  label="Apply to brand *"
                  value={form.brandId}
                  onChange={(v) => f({ brandId: v })}
                  options={brandOpts}
                />

                <InfoBox
                  color="rgba(233,69,96,.06)"
                  border="rgba(233,69,96,.15)"
                  textColor="var(--col-text-2)"
                >
                  <strong style={{ color: 'var(--col-text)' }}>Condition (optional):</strong> The
                  discount only applies when the item price exceeds the minimum price below. If left
                  blank, the discount applies to all items from this brand unconditionally.
                </InfoBox>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Input
                    label="Min price condition (Rs)"
                    type="number"
                    value={form.conditionMinPrice}
                    onChange={(v) => f({ conditionMinPrice: v })}
                    placeholder="e.g. 3000 (leave blank = no condition)"
                  />
                  <Input
                    label="Override value when condition met"
                    type="number"
                    value={form.conditionValue}
                    onChange={(v) => f({ conditionValue: v })}
                    placeholder="e.g. 500 (leave blank = use main value)"
                  />
                </div>

                {/* Live preview */}
                {form.brandId && form.value && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(233,69,96,.06)',
                      border: '0.5px solid rgba(233,69,96,.15)',
                      fontSize: 12,
                      color: 'var(--col-text-2)',
                    }}
                  >
                    <strong style={{ color: 'var(--col-text)' }}>Preview: </strong>
                    {brands.find((b) => String(b.id) === form.brandId)?.name ||
                      'Selected brand'}{' '}
                    items
                    {form.conditionMinPrice ? ` priced above Rs ${form.conditionMinPrice}` : ''}
                    {' → '}
                    {form.valueType === 'percentage'
                      ? `${form.conditionValue || form.value}% off`
                      : `Rs ${form.conditionValue || form.value} flat off`}
                  </div>
                )}
              </div>
            )}

            {/* ── BULK: GRN lookup ──────────────────────────────────────────── */}
            {form.discountType === 'bulk' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--col-gold)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Bulk discount settings
                </div>

                <InfoBox
                  color="rgba(245,166,35,.06)"
                  border="rgba(245,166,35,.2)"
                  textColor="var(--col-text-2)"
                >
                  A bulk discount applies to all items received in a specific GRN. Search by GRN
                  number to link the discount.
                </InfoBox>

                {/* GRN search */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <Input
                    label="Search GRN number *"
                    value={grnSearch}
                    onChange={(v) => {
                      setGrnSearch(v);
                      if (!v) {
                        setGrnLookup(null);
                        f({ grnId: '', grnNo: '' });
                      }
                    }}
                    placeholder="e.g. GRN-2026-001"
                    mono
                  />
                  <Btn
                    variant="secondary"
                    onClick={lookupGRN}
                    disabled={lookingUp || !grnSearch.trim()}
                    style={{ flexShrink: 0, marginBottom: 0 }}
                  >
                    {lookingUp ? 'Searching…' : 'Search'}
                  </Btn>
                </div>

                {/* GRN result */}
                {grnLookup && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(6,214,160,.08)',
                      border: '0.5px solid rgba(6,214,160,.25)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>✓</span>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>
                        GRN found:{' '}
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--col-teal)' }}>
                          {grnLookup.grn_no}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--col-text-3)' }}>
                        Received: {grnLookup.received_date?.slice(0, 10) || '—'}
                        {grnLookup.supplier_name ? ` · Supplier: ${grnLookup.supplier_name}` : ''}
                      </div>
                    </div>
                  </div>
                )}

                {!grnLookup && form.discountType === 'bulk' && (
                  <div style={{ fontSize: 12, color: 'var(--col-text-3)' }}>
                    No GRN selected yet. Search above to link this discount to a delivery.
                  </div>
                )}
              </div>
            )}

            {/* ── Footer ────────────────────────────────────────────────────── */}
            <Flex gap={10} justify="flex-end" style={{ marginTop: 4 }}>
              <Btn variant="secondary" onClick={() => setModal(false)}>
                Cancel
              </Btn>
              <Btn onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Update discount' : 'Create discount'}
              </Btn>
            </Flex>
          </div>
        </Modal>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL: CONFIRM DELETE
      ════════════════════════════════════════════════════════════════════════ */}
      {confirmDel && (
        <Modal title="Delete discount" onClose={() => setConfirmDel(null)} width={380}>
          <p style={{ fontSize: 13, color: 'var(--col-text-2)', marginBottom: 16 }}>
            Delete discount <strong style={{ color: 'var(--col-text)' }}>{confirmDel.name}</strong>?
            This will stop the discount being applied to new bills.
          </p>
          <Flex gap={10} justify="flex-end">
            <Btn variant="secondary" onClick={() => setConfirmDel(null)}>
              Cancel
            </Btn>
            <Btn variant="danger" onClick={() => del(confirmDel.id)}>
              Delete
            </Btn>
          </Flex>
        </Modal>
      )}
    </div>
  );
}
