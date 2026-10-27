import React, { useState, useEffect } from 'react';
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
  StatCard,
} from '../ui';
import { useAuth } from '../../context/AuthContext';
import { expenseApi } from '../../api';

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'petty_cash', label: 'Petty Cash' },
];
const STATUS_VARIANT = { approved: 'green', pending: 'amber', rejected: 'red' };
const blank = { desc: '', amount: '', categoryId: '', method: 'cash', date: '', notes: '' };

export default function Expenses() {
  const { user, activeBranchId: branchId, branchSettings } = useAuth();

  const [expenses, setExpenses] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [confirmDel, setConfDel] = useState(null);
  const [filter, setFilter] = useState('all');
  const [saving, setSaving] = useState(false);

  const f = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    Promise.all([expenseApi.list(branchId), expenseApi.listCats(branchId)])
      .then(([expData, catData]) => {
        setExpenses(Array.isArray(expData) ? expData : expData.items || expData.rows || []);
        setCats(Array.isArray(catData) ? catData : catData.items || catData.rows || catData || []);
      })
      .catch(() => toast.error('Failed to load expenses'))
      .finally(() => setLoading(false));
  }, [branchId]);

  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  const filtered =
    filter === 'all' ? safeExpenses : safeExpenses.filter((e) => e.status === filter);

  const approve = async (id) => {
    try {
      const updated = await expenseApi.approve(id);
      setExpenses((p) =>
        p.map((e) => (e.id === id ? { ...e, ...updated, status: 'approved' } : e)),
      );
      toast.success('Expense approved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approve failed');
    }
  };

  const save = async () => {
    if (!form.desc || !form.amount) {
      toast.error('Description and amount required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        description: form.desc,
        amount: parseFloat(form.amount),
        expenseCategoryId: form.categoryId || null,
        paymentMethod: form.method,
        expenseDate: form.date || undefined,
        notes: form.notes || undefined,
      };
      if (editing) {
        const updated = await expenseApi.update(editing, payload);
        setExpenses((prev) => prev.map((e) => (e.id === editing ? { ...e, ...updated } : e)));
        toast.success('Expense updated');
      } else {
        const created = await expenseApi.create(branchId, payload);
        setExpenses((prev) => [created, ...prev]);
        toast.success('Expense submitted for approval');
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
      await expenseApi.delete(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      setConfDel(null);
      toast.success('Deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const totalApproved = expenses
    .filter((e) => e.status === 'approved')
    .reduce((a, e) => a + Number(e.amount || 0), 0);
  const totalPending = expenses
    .filter((e) => e.status === 'pending')
    .reduce((a, e) => a + Number(e.amount || 0), 0);

  const catOpts = [
    { value: '', label: 'Select category' },
    ...cats.map((c) => ({ value: String(c.id), label: c.name })),
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
        Loading expenses…
      </div>
    );

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        title="Expenses"
        action={
          <Btn
            onClick={() => {
              setEditing(null);
              setForm(blank);
              setModal(true);
            }}
          >
            + Log expense
          </Btn>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <StatCard label="Total expenses" value={expenses.length} accent="var(--col-teal)" />
        <StatCard
          label="Approved total"
          value={`Rs ${totalApproved.toLocaleString()}`}
          accent="var(--col-green)"
        />
        <StatCard
          label="Pending approval"
          value={expenses.filter((e) => e.status === 'pending').length}
          accent="var(--col-gold)"
        />
        <StatCard
          label="Pending amount"
          value={`Rs ${totalPending.toLocaleString()}`}
          accent="var(--col-accent)"
        />
      </div>

      <Flex gap={6}>
        {['all', 'pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: '4px 13px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              background: filter === s ? 'var(--col-accent)' : 'rgba(255,255,255,.06)',
              color: filter === s ? '#fff' : 'var(--col-text-2)',
              border: `0.5px solid ${filter === s ? 'var(--col-accent)' : 'var(--col-border-2)'}`,
              transition: 'all var(--transition)',
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </Flex>

      <Card flush>
        <Table
          columns={[
            {
              key: 'desc',
              label: 'Description',
              render: (r) => (
                <div>
                  <div style={{ fontWeight: 500 }}>{r.description || r.desc}</div>
                  <div style={{ fontSize: 11, color: 'var(--col-text-3)' }}>{r.notes}</div>
                </div>
              ),
            },
            { key: 'cat', label: 'Category', render: (r) => r.category_name || r.cat || '—' },
            {
              key: 'amount',
              label: 'Amount',
              render: (r) => (
                <span style={{ fontWeight: 600 }}>Rs {Number(r.amount).toLocaleString()}</span>
              ),
            },
            {
              key: 'method',
              label: 'Method',
              render: (r) => (
                <span style={{ fontSize: 12, color: 'var(--col-text-2)' }}>
                  {r.payment_method || r.method}
                </span>
              ),
            },
            {
              key: 'date',
              label: 'Date',
              render: (r) => (r.expense_date || r.date || '').slice(0, 10),
            },
            {
              key: 'status',
              label: 'Status',
              render: (r) => (
                <Badge label={r.status} variant={STATUS_VARIANT[r.status] || 'default'} />
              ),
            },
            {
              key: 'actions',
              label: '',
              render: (r) => (
                <Flex gap={6}>
                  {r.status === 'pending' && (
                    <>
                      <Btn variant="success" size="sm" onClick={() => approve(r.id)}>
                        Approve
                      </Btn>
                    </>
                  )}
                  {r.status !== 'approved' && (
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(r.id);
                        setForm({
                          desc: r.description || r.desc,
                          amount: r.amount,
                          categoryId: String(r.expense_category_id || ''),
                          method: r.payment_method || r.method,
                          date: (r.expense_date || r.date || '').slice(0, 10),
                          notes: r.notes || '',
                        });
                        setModal(true);
                      }}
                    >
                      Edit
                    </Btn>
                  )}
                  <Btn variant="danger" size="sm" onClick={() => setConfDel(r)}>
                    Del
                  </Btn>
                </Flex>
              ),
            },
          ]}
          rows={filtered}
          emptyMsg="No expenses in this category"
        />
      </Card>

      {showModal && (
        <Modal
          title={editing ? 'Edit expense' : 'Log expense'}
          onClose={() => setModal(false)}
          width={440}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input
              label="Description *"
              value={form.desc}
              onChange={(v) => f({ desc: v })}
              placeholder="e.g. Courier fee"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input
                label="Amount (Rs) *"
                type="number"
                value={form.amount}
                onChange={(v) => f({ amount: v })}
                placeholder="0"
              />
              <Select
                label="Category"
                value={form.categoryId}
                onChange={(v) => f({ categoryId: v })}
                options={catOpts}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Select
                label="Payment method"
                value={form.method}
                onChange={(v) => f({ method: v })}
                options={METHODS}
              />
              <Input label="Date" type="date" value={form.date} onChange={(v) => f({ date: v })} />
            </div>
            <Input
              label="Notes (optional)"
              value={form.notes}
              onChange={(v) => f({ notes: v })}
              placeholder="Additional details…"
            />
            <Flex gap={10} justify="flex-end">
              <Btn variant="secondary" onClick={() => setModal(false)}>
                Cancel
              </Btn>
              <Btn onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Update' : 'Submit for approval'}
              </Btn>
            </Flex>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <Modal title="Delete expense" onClose={() => setConfDel(null)} width={360}>
          <p style={{ fontSize: 13, color: 'var(--col-text-2)', marginBottom: 16 }}>
            Delete expense{' '}
            <strong style={{ color: 'var(--col-text)' }}>
              {confirmDel.description || confirmDel.desc}
            </strong>
            ?
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
