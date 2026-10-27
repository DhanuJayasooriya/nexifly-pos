import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Card, Btn, Input, Modal, Badge, Table, Flex, SectionHeader, StatCard } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { customerApi } from '../../api';

const TIER_VARIANT = { standard: 'default', silver: 'default', gold: 'gold', platinum: 'teal' };
const blank = { name: '', phone: '', email: '', notes: '' };

export default function Customers() {
  const { user, activeBranchId: branchId, branchSettings } = useAuth();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [confirmDel, setConfDel] = useState(null);
  const [saving, setSaving] = useState(false);

  const f = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    customerApi
      .list(branchId)
      .then((data) => setCustomers(Array.isArray(data) ? data : data?.items || data?.rows || []))
      .catch(() => toast.error('Failed to load customers'))
      .finally(() => setLoading(false));
  }, [branchId]);

  const filtered = customers.filter((c) => {
    const s = search.toLowerCase();
    return (
      !search ||
      (c.name || '').toLowerCase().includes(s) ||
      (c.phone || '').includes(s) ||
      (c.email || '').toLowerCase().includes(s)
    );
  });

  const openAdd = () => {
    setEditing(null);
    setForm(blank);
    setModal(true);
  };
  const openEdit = (c) => {
    setEditing(c.id);
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', notes: c.notes || '' });
    setModal(true);
  };

  const save = async () => {
    if (!form.name) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const updated = await customerApi.update(editing, form);
        setCustomers((prev) => prev.map((c) => (c.id === editing ? { ...c, ...updated } : c)));
        toast.success('Customer updated');
      } else {
        const created = await customerApi.create(branchId, form);
        setCustomers((prev) => [created, ...prev]);
        toast.success('Customer added');
      }
      setModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    try {
      await customerApi.delete(id);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      setConfDel(null);
      toast.success('Customer deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const stats = [
    { label: 'Total customers', value: customers.length, accent: 'var(--col-teal)' },
    {
      label: 'Gold members',
      value: customers.filter((c) => c.loyalty_tier === 'gold').length,
      accent: 'var(--col-gold)',
    },
    {
      label: 'Platinum',
      value: customers.filter((c) => c.loyalty_tier === 'platinum').length,
      accent: 'var(--col-accent)',
    },
    {
      label: 'Total points',
      value: customers.reduce((a, c) => a + (c.loyalty_points || 0), 0).toLocaleString(),
      accent: 'var(--col-green)',
    },
  ];

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
        Loading customers…
      </div>
    );

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader title="Customers" action={<Btn onClick={openAdd}>+ Add customer</Btn>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <Flex gap={10}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone or email…"
          style={{
            flex: 1,
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            border: '0.5px solid var(--col-border-2)',
            background: 'var(--col-bg-3)',
            color: 'var(--col-text)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--col-text-3)', alignSelf: 'center' }}>
          {filtered.length} customers
        </span>
      </Flex>

      <Card flush>
        <Table
          columns={[
            {
              key: 'name',
              label: 'Name',
              render: (r) => (
                <Flex gap={10}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg,var(--col-accent),var(--col-gold))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 12,
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {(r.name || '?').slice(0, 1)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--col-text-3)' }}>
                      Since {r.created_at?.slice(0, 7) || '—'}
                    </div>
                  </div>
                </Flex>
              ),
            },
            {
              key: 'phone',
              label: 'Phone',
              render: (r) => (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {r.phone || '—'}
                </span>
              ),
            },
            {
              key: 'email',
              label: 'Email',
              render: (r) => (
                <span style={{ fontSize: 12, color: 'var(--col-text-2)' }}>{r.email || '—'}</span>
              ),
            },
            {
              key: 'tier',
              label: 'Tier',
              render: (r) => (
                <Badge
                  label={r.loyalty_tier || 'standard'}
                  variant={TIER_VARIANT[r.loyalty_tier] || 'default'}
                />
              ),
            },
            {
              key: 'pts',
              label: 'Points',
              render: (r) => (
                <span style={{ fontWeight: 600, color: 'var(--col-gold)' }}>
                  {r.loyalty_points || 0} pts
                </span>
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (r) => (
                <Flex gap={6}>
                  <Btn variant="ghost" size="sm" onClick={() => openEdit(r)}>
                    Edit
                  </Btn>
                  <Btn variant="danger" size="sm" onClick={() => setConfDel(r)}>
                    Del
                  </Btn>
                </Flex>
              ),
            },
          ]}
          rows={filtered}
          emptyMsg="No customers found"
        />
      </Card>

      {showModal && (
        <Modal
          title={editing ? 'Edit customer' : 'Add customer'}
          onClose={() => setModal(false)}
          width={420}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input
              label="Full name *"
              value={form.name}
              onChange={(v) => f({ name: v })}
              placeholder="e.g. Amara Silva"
            />
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
                Phone (10 digits)
              </span>
              <input
                value={form.phone}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                  f({ phone: v });
                }}
                onKeyDown={(e) => {
                  if (
                    !/[0-9]/.test(e.key) &&
                    !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key) &&
                    !e.ctrlKey &&
                    !e.metaKey
                  )
                    e.preventDefault();
                  if (/[0-9]/.test(e.key) && form.phone.length >= 10) e.preventDefault();
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const v = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 10);
                  f({ phone: v });
                }}
                placeholder="0771234567"
                inputMode="numeric"
                maxLength={10}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '0.5px solid var(--col-border-2)',
                  background: 'var(--col-bg-3)',
                  color: 'var(--col-text)',
                  fontSize: 13,
                  outline: 'none',
                  width: '100%',
                }}
              />
            </div>
            <Input
              label="Email"
              value={form.email}
              onChange={(v) => f({ email: v })}
              placeholder="amara@mail.com"
            />
            <Input
              label="Notes"
              value={form.notes}
              onChange={(v) => f({ notes: v })}
              placeholder="Optional notes…"
            />
            <Flex gap={10} justify="flex-end">
              <Btn variant="secondary" onClick={() => setModal(false)}>
                Cancel
              </Btn>
              <Btn onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Update' : 'Add customer'}
              </Btn>
            </Flex>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <Modal title="Delete customer" onClose={() => setConfDel(null)} width={360}>
          <p style={{ fontSize: 13, color: 'var(--col-text-2)', marginBottom: 16 }}>
            Delete <strong style={{ color: 'var(--col-text)' }}>{confirmDel.name}</strong>?
          </p>
          <Flex gap={10} justify="flex-end">
            <Btn variant="secondary" onClick={() => setConfDel(null)}>
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
