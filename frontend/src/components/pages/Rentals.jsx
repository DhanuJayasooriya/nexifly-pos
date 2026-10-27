import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Divider,
  EmptyState,
} from '../ui';
import { useAuth } from '../../context/AuthContext';
import { rentalApi, customerApi } from '../../api';

// ─── helpers ──────────────────────────────────────────────────────────────────
const STATUS_META = {
  reserved: { label: 'Reserved', variant: 'teal' },
  active: { label: 'Active', variant: 'green' },
  overdue: { label: 'Overdue', variant: 'red' },
  returned: { label: 'Returned', variant: 'default' },
  item_received: { label: 'Item received', variant: 'default' },
  sold: { label: 'Sold', variant: 'amber' },
};

const METHOD_OPTS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_TYPE_OPTS = [
  { value: 'advance', label: 'Advance payment (on reserved date)' },
  { value: 'installment', label: 'Installment' },
  { value: 'final', label: 'Final payment' },
  { value: 'balance', label: 'Balance payment' },
];

function PaymentStatusBar({ total, paid }) {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  const balance = Math.max(0, total - paid);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: 'var(--col-border-2)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: pct >= 100 ? 'var(--col-green)' : 'var(--col-gold)',
            borderRadius: 3,
            transition: 'width .3s',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--col-text-3)',
        }}
      >
        <span style={{ color: 'var(--col-green)' }}>Paid: Rs {Number(paid).toLocaleString()}</span>
        {balance > 0 ? (
          <span style={{ color: 'var(--col-red)' }}>
            Balance: Rs {Number(balance).toLocaleString()}
          </span>
        ) : (
          <span style={{ color: 'var(--col-green)', fontWeight: 600 }}>✓ Fully paid</span>
        )}
      </div>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────
export default function Rentals() {
  const { user, activeBranchId } = useAuth();
  const branchId = activeBranchId || user?.branchId || user?.branch_id;

  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');

  // ── search (receive tab) ──
  const [searchQ, setSearchQ] = useState('');
  const [searchRes, setSearchRes] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  // ── selected rental for detail / payment / receive ──
  const [selected, setSelected] = useState(null); // full rental object
  const [payments, setPayments] = useState([]);
  const [loadingDet, setLoadingDet] = useState(false);

  // ── payment modal ──
  const [showPay, setShowPay] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: '',
    method: 'cash',
    paymentType: 'installment',
    notes: '',
  });
  const [savingPay, setSavingPay] = useState(false);

  // ── receive modal ──
  const [showReceive, setShowReceive] = useState(false);
  const [receiveForm, setReceiveForm] = useState({ condition: 'good', notes: '' });
  const [receiving, setReceiving] = useState(false);
  const [receiveResult, setReceiveResult] = useState(null); // { balance, fullyPaid }

  const pf = (v) => setPayForm((p) => ({ ...p, ...v }));

  // ── load rentals ────────────────────────────────────────────────────────────
  const loadRentals = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const params = { limit: 100, page: 1 };
      if (filterStatus !== 'all') params.status = filterStatus;
      const data = await rentalApi.list(branchId, params);
      setRentals(data.items || data.rows || data || []);
    } catch {
      toast.error('Failed to load rentals');
    } finally {
      setLoading(false);
    }
  }, [branchId, filterStatus]);

  useEffect(() => {
    loadRentals();
  }, [loadRentals]);

  // Reload when the tab becomes visible again (e.g. switching from Billing)
  useEffect(() => {
    const onFocus = () => loadRentals();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) loadRentals();
    });
    return () => window.removeEventListener('focus', onFocus);
  }, [loadRentals]);

  // ── open detail ─────────────────────────────────────────────────────────────
  const openDetail = async (rental) => {
    setSelected(rental);
    setPayments([]);
    setReceiveResult(null);
    setLoadingDet(true);
    try {
      const [full, pays] = await Promise.all([
        rentalApi.get(rental.id),
        rentalApi.listPayments(rental.id),
      ]);
      setSelected(full);
      setPayments(pays || []);
    } catch {
      toast.error('Could not load rental details');
    } finally {
      setLoadingDet(false);
    }
  };

  // ── search for receive tab ───────────────────────────────────────────────────
  const handleSearch = (val) => {
    setSearchQ(val);
    setSearchRes([]);
    if (!val.trim() || val.length < 2) return;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await rentalApi.search(branchId, val.trim());
        setSearchRes(res || []);
      } catch {
        setSearchRes([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  // ── add payment ──────────────────────────────────────────────────────────────
  const addPayment = async () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSavingPay(true);
    try {
      const result = await rentalApi.addPayment(selected.id, {
        amount: parseFloat(payForm.amount),
        method: payForm.method,
        paymentType: payForm.paymentType,
        notes: payForm.notes || undefined,
      });
      setPayments((prev) => [...prev, result.payment]);
      setSelected((prev) => ({ ...prev, paid_amount: result.paidAmount }));
      toast.success(`Payment of Rs ${Number(payForm.amount).toLocaleString()} recorded`);
      if (result.fullyPaid) toast.success('✓ Rental fully paid', { icon: '🎉' });
      setPayForm({ amount: '', method: 'cash', paymentType: 'installment', notes: '' });
      setShowPay(false);
      loadRentals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    } finally {
      setSavingPay(false);
    }
  };

  // ── receive item ─────────────────────────────────────────────────────────────
  const receiveItem = async () => {
    setReceiving(true);
    try {
      const result = await rentalApi.receive(selected.id, {
        condition: receiveForm.condition,
        notes: receiveForm.notes || undefined,
      });
      setReceiveResult(result);
      setSelected((prev) => ({ ...prev, status: result.rental.status }));
      toast.success(
        receiveForm.condition === 'damaged'
          ? 'Item received — marked as returned (damaged). Stock NOT restored.'
          : 'Item received — added back to inventory',
      );
      window.dispatchEvent(new CustomEvent('nxf:stock-updated'));
      loadRentals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Receive failed');
    } finally {
      setReceiving(false);
    }
  };

  // ── derived ──────────────────────────────────────────────────────────────────
  const stats = [
    {
      label: 'Active',
      value: rentals.filter((r) => r.status === 'active').length,
      accent: 'var(--col-green)',
    },
    {
      label: 'Reserved',
      value: rentals.filter((r) => r.status === 'reserved').length,
      accent: 'var(--col-teal)',
    },
    {
      label: 'Overdue',
      value: rentals.filter((r) => r.status === 'overdue').length,
      accent: 'var(--col-red)',
    },
    {
      label: 'Returned',
      value: rentals.filter((r) => ['returned', 'item_received'].includes(r.status)).length,
      accent: 'var(--col-text-3)',
    },
  ];

  const totalAmt = Number(selected?.total_rent_amount || selected?.deposit_amount || 0);
  const paidAmt = Number(
    selected?.paid_amount || payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0),
  );
  const balance = Math.max(0, totalAmt - paidAmt);
  const canReceive = selected && ['active', 'overdue', 'reserved'].includes(selected.status);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="Rentals" />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} accent={s.accent} />
        ))}
      </div>

      {/* ── SEARCH TO RECEIVE ──────────────────────────────────────────────── */}
      <Card>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--col-text-2)',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 12,
          }}
        >
          Receive rental item — search by customer NIC, name or phone
        </div>
        <div style={{ position: 'relative' }}>
          <input
            value={searchQ}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Type customer NIC, name or phone number…"
            style={{
              width: '100%',
              padding: '9px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--col-accent)',
              background: 'var(--col-bg-3)',
              color: 'var(--col-text)',
              fontSize: 13,
              outline: 'none',
              boxShadow: '0 0 0 3px rgba(233,69,96,.1)',
            }}
          />
          {searching && (
            <div
              style={{
                position: 'absolute',
                right: 12,
                top: 10,
                fontSize: 11,
                color: 'var(--col-text-3)',
              }}
            >
              Searching…
            </div>
          )}
        </div>

        {searchRes.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {searchRes.map((r) => {
              const tot = Number(r.total_amount || 0);
              const paid = Number(r.paid_amount || 0);
              const bal = Math.max(0, tot - paid);
              return (
                <div
                  key={r.id}
                  onClick={() => {
                    openDetail(r);
                    setSearchRes([]);
                    setSearchQ('');
                  }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,.04)',
                    border: '0.5px solid var(--col-border)',
                    transition: 'background var(--transition)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
                >
                  <Flex justify="space-between" align="flex-start">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.product_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--col-text-3)', marginTop: 2 }}>
                        {r.customer_name}
                        {r.customer_nic && <> · NIC: {r.customer_nic}</>}
                        {r.customer_phone && <> · {r.customer_phone}</>}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--col-text-3)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {r.sku} · Due: {r.due_date?.slice(0, 10)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <Badge
                        label={STATUS_META[r.status]?.label || r.status}
                        variant={STATUS_META[r.status]?.variant}
                        size="sm"
                      />
                      <div style={{ marginTop: 4, fontSize: 11 }}>
                        {bal > 0 ? (
                          <span style={{ color: 'var(--col-red)', fontWeight: 600 }}>
                            Balance: Rs {bal.toLocaleString()}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--col-green)', fontWeight: 600 }}>
                            ✓ Fully paid
                          </span>
                        )}
                      </div>
                    </div>
                  </Flex>
                </div>
              );
            })}
          </div>
        )}
        {searchQ.length >= 2 && !searching && searchRes.length === 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--col-text-3)' }}>
            No active rentals found for "{searchQ}"
          </div>
        )}
      </Card>

      {/* ── ONGOING RENTALS TABLE ──────────────────────────────────────────── */}
      <div>
        {/* Filter pills */}
        <Flex gap={6} style={{ marginBottom: 12 }}>
          {[
            { k: 'active', l: 'Active' },
            { k: 'reserved', l: 'Reserved' },
            { k: 'overdue', l: 'Overdue' },
            { k: 'returned', l: 'Returned' },
            { k: 'all', l: 'All' },
          ].map((f) => (
            <button
              key={f.k}
              onClick={() => setFilterStatus(f.k)}
              style={{
                padding: '5px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                background: filterStatus === f.k ? 'var(--col-accent)' : 'rgba(255,255,255,.06)',
                color: filterStatus === f.k ? '#fff' : 'var(--col-text-2)',
                transition: 'all var(--transition)',
              }}
            >
              {f.l}
            </button>
          ))}
        </Flex>

        <Card flush>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--col-text-3)' }}>
              Loading…
            </div>
          ) : rentals.length === 0 ? (
            <EmptyState icon="⏱️" title="No rentals" sub="No rentals in this status" />
          ) : (
            <Table
              columns={[
                {
                  key: 'product',
                  label: 'Item',
                  render: (r) => (
                    <div>
                      <div style={{ fontWeight: 500 }}>{r.product_name}</div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--col-text-3)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {r.sku}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'customer',
                  label: 'Customer',
                  render: (r) => (
                    <div>
                      <div style={{ fontWeight: 500 }}>{r.customer_name}</div>
                      {r.customer_nic && (
                        <div style={{ fontSize: 11, color: 'var(--col-text-3)' }}>
                          NIC: {r.customer_nic}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'dates',
                  label: 'Dates',
                  render: (r) => (
                    <div style={{ fontSize: 11 }}>
                      <div>Reserved: {r.reserved_date?.slice(0, 10) || '—'}</div>
                      <div>
                        Due:{' '}
                        <span
                          style={{
                            color:
                              new Date(r.due_date) < new Date() &&
                              !['returned', 'item_received', 'sold'].includes(r.status)
                                ? 'var(--col-red)'
                                : 'inherit',
                          }}
                        >
                          {r.due_date?.slice(0, 10)}
                        </span>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'payment',
                  label: 'Payment',
                  render: (r) => {
                    const tot = Number(r.total_rent_amount || r.deposit_amount || 0);
                    const paid = Number(r.paid_amount || 0);
                    return tot > 0 ? (
                      <div style={{ minWidth: 120 }}>
                        <PaymentStatusBar total={tot} paid={paid} />
                      </div>
                    ) : (
                      <span style={{ color: 'var(--col-text-3)', fontSize: 11 }}>—</span>
                    );
                  },
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => (
                    <Badge
                      label={STATUS_META[r.status]?.label || r.status}
                      variant={STATUS_META[r.status]?.variant}
                      size="sm"
                    />
                  ),
                },
                {
                  key: 'actions',
                  label: '',
                  render: (r) => (
                    <Btn variant="ghost" size="sm" onClick={() => openDetail(r)}>
                      View
                    </Btn>
                  ),
                },
              ]}
              rows={rentals}
            />
          )}
        </Card>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          DETAIL PANEL — shown as modal when rental selected
      ════════════════════════════════════════════════════════════════════ */}
      {selected && (
        <Modal
          title={`Rental — ${selected.product_name}`}
          onClose={() => {
            setSelected(null);
            setReceiveResult(null);
          }}
          width={580}
        >
          {loadingDet ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--col-text-3)' }}>
              Loading…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Status + item info */}
              <Flex gap={10} align="center">
                <Badge
                  label={STATUS_META[selected.status]?.label || selected.status}
                  variant={STATUS_META[selected.status]?.variant}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--col-text-3)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {selected.sku}
                </span>
              </Flex>

              {/* Customer + dates grid */}
              <div
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}
              >
                {[
                  ['Customer', selected.customer_name],
                  ['NIC', selected.customer_nic || '—'],
                  ['Phone', selected.customer_phone || '—'],
                  ['Reserved date', selected.reserved_date?.slice(0, 10) || '—'],
                  ['Rented date', selected.rented_date?.slice(0, 10) || '—'],
                  ['Due date', selected.due_date?.slice(0, 10) || '—'],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255,255,255,.03)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--col-text-3)',
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                        marginBottom: 2,
                      }}
                    >
                      {k}
                    </div>
                    <div style={{ fontWeight: 500 }}>{v}</div>
                  </div>
                ))}
              </div>

              <Divider />

              {/* Payment summary */}
              <div>
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
                  Payment status
                </div>
                <PaymentStatusBar total={totalAmt} paid={paidAmt} />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    marginTop: 6,
                  }}
                >
                  <span>
                    Total agreed: <strong>Rs {totalAmt.toLocaleString()}</strong>
                  </span>
                  <span>
                    Balance:{' '}
                    <strong style={{ color: balance > 0 ? 'var(--col-red)' : 'var(--col-green)' }}>
                      Rs {balance.toLocaleString()}
                    </strong>
                  </span>
                </div>

                {/* Payment history */}
                {payments.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'var(--col-text-3)',
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                        marginBottom: 4,
                      }}
                    >
                      Payment history
                    </div>
                    {payments.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 11,
                          padding: '5px 8px',
                          borderRadius: 'var(--radius-md)',
                          background: 'rgba(6,214,160,.06)',
                        }}
                      >
                        <span style={{ color: 'var(--col-text-2)' }}>
                          {p.payment_type} · {p.method} · {p.paid_at?.slice(0, 10)}
                          {p.recorded_by_name && (
                            <span style={{ color: 'var(--col-text-3)' }}>
                              {' '}
                              — {p.recorded_by_name}
                            </span>
                          )}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--col-green)' }}>
                          Rs {Number(p.amount).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Receive result (after receiving) */}
              {receiveResult && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: receiveResult.fullyPaid
                      ? 'rgba(6,214,160,.08)'
                      : 'rgba(239,35,60,.06)',
                    border: `0.5px solid ${receiveResult.fullyPaid ? 'rgba(6,214,160,.3)' : 'rgba(239,35,60,.2)'}`,
                    fontSize: 12,
                  }}
                >
                  {receiveResult.fullyPaid ? (
                    <div style={{ color: 'var(--col-green)', fontWeight: 600 }}>
                      ✓ Item received — fully paid. Added back to inventory.
                    </div>
                  ) : (
                    <div>
                      <div style={{ color: 'var(--col-red)', fontWeight: 600, marginBottom: 4 }}>
                        ⚠ Item received — outstanding balance: Rs{' '}
                        {Number(receiveResult.balance).toLocaleString()}
                      </div>
                      <div style={{ color: 'var(--col-text-2)' }}>
                        Item added back to inventory. Record the balance payment when received.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <Flex gap={8} justify="flex-end">
                {canReceive && !receiveResult && (
                  <Btn variant="gold" onClick={() => setShowReceive(true)}>
                    Receive item
                  </Btn>
                )}
                {canReceive && (
                  <Btn
                    variant="success"
                    onClick={() => {
                      setShowPay(true);
                      pf({ paymentType: canReceive ? 'advance' : 'balance' });
                    }}
                  >
                    + Add payment
                  </Btn>
                )}
                {balance > 0 && !canReceive && (
                  <Btn variant="success" onClick={() => setShowPay(true)}>
                    + Record balance payment
                  </Btn>
                )}
                <Btn
                  variant="secondary"
                  onClick={() => {
                    setSelected(null);
                    setReceiveResult(null);
                  }}
                >
                  Close
                </Btn>
              </Flex>
            </div>
          )}
        </Modal>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL: ADD PAYMENT
      ════════════════════════════════════════════════════════════════════ */}
      {showPay && (
        <Modal title="Record payment" onClose={() => setShowPay(false)} width={400}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255,255,255,.04)',
                fontSize: 12,
                color: 'var(--col-text-2)',
              }}
            >
              {selected?.product_name} · {selected?.customer_name}
              {balance > 0 && (
                <span style={{ float: 'right', color: 'var(--col-red)', fontWeight: 600 }}>
                  Balance: Rs {balance.toLocaleString()}
                </span>
              )}
            </div>
            <Select
              label="Payment type"
              value={payForm.paymentType}
              onChange={(v) => pf({ paymentType: v })}
              options={PAYMENT_TYPE_OPTS}
            />
            <Input
              label="Amount (Rs) *"
              type="number"
              value={payForm.amount}
              onChange={(v) => pf({ amount: v })}
              placeholder={balance > 0 ? `Balance: Rs ${balance.toLocaleString()}` : '0'}
            />
            <Select
              label="Payment method"
              value={payForm.method}
              onChange={(v) => pf({ method: v })}
              options={METHOD_OPTS}
            />
            <Input
              label="Notes"
              value={payForm.notes}
              onChange={(v) => pf({ notes: v })}
              placeholder="Optional"
            />
            <Flex gap={10} justify="flex-end">
              <Btn variant="secondary" onClick={() => setShowPay(false)}>
                Cancel
              </Btn>
              <Btn onClick={addPayment} disabled={savingPay}>
                {savingPay ? 'Saving…' : 'Record payment'}
              </Btn>
            </Flex>
          </div>
        </Modal>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL: RECEIVE ITEM
      ════════════════════════════════════════════════════════════════════ */}
      {showReceive && (
        <Modal title="Receive rental item" onClose={() => setShowReceive(false)} width={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(0,180,216,.08)',
                border: '0.5px solid rgba(0,180,216,.2)',
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--col-text)' }}>
                {selected?.product_name}
              </div>
              <div style={{ color: 'var(--col-text-2)', marginTop: 2 }}>
                {selected?.customer_name}
                {selected?.customer_nic && <> · NIC: {selected.customer_nic}</>}
              </div>
              {balance > 0 && (
                <div style={{ marginTop: 6, color: 'var(--col-red)', fontWeight: 600 }}>
                  Outstanding balance: Rs {balance.toLocaleString()}
                </div>
              )}
            </div>

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
                Item condition
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  {
                    v: 'good',
                    l: '✓ Good condition',
                    c: 'var(--col-green)',
                    bg: 'rgba(6,214,160,.12)',
                  },
                  { v: 'damaged', l: '⚠ Damaged', c: 'var(--col-red)', bg: 'rgba(239,35,60,.12)' },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => setReceiveForm((p) => ({ ...p, condition: opt.v }))}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontWeight: 500,
                      fontSize: 13,
                      background:
                        receiveForm.condition === opt.v ? opt.bg : 'rgba(255,255,255,.04)',
                      color: receiveForm.condition === opt.v ? opt.c : 'var(--col-text-2)',
                      border: `1px solid ${receiveForm.condition === opt.v ? opt.c : 'var(--col-border)'}`,
                      transition: 'all var(--transition)',
                    }}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
              {receiveForm.condition === 'good' && (
                <div style={{ fontSize: 11, color: 'var(--col-green)', marginTop: 2 }}>
                  Item will be added back to inventory and variant stock increased by 1.
                </div>
              )}
              {receiveForm.condition === 'damaged' && (
                <div style={{ fontSize: 11, color: 'var(--col-red)', marginTop: 2 }}>
                  Stock will NOT be restored. Consider adding a damage charge after receiving.
                </div>
              )}
            </div>

            <Input
              label="Notes"
              value={receiveForm.notes}
              onChange={(v) => setReceiveForm((p) => ({ ...p, notes: v }))}
              placeholder="Condition notes, damage details…"
            />

            {balance > 0 && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(245,166,35,.08)',
                  border: '0.5px solid rgba(245,166,35,.2)',
                  fontSize: 11,
                  color: 'var(--col-gold)',
                }}
              >
                ⚠ Balance of Rs {balance.toLocaleString()} still outstanding. You can record the
                balance payment after receiving the item.
              </div>
            )}

            <Flex gap={10} justify="flex-end">
              <Btn variant="secondary" onClick={() => setShowReceive(false)}>
                Cancel
              </Btn>
              <Btn
                variant={receiveForm.condition === 'good' ? 'success' : 'danger'}
                onClick={async () => {
                  await receiveItem();
                  setShowReceive(false);
                }}
                disabled={receiving}
              >
                {receiving
                  ? 'Processing…'
                  : receiveForm.condition === 'good'
                    ? '✓ Confirm receipt'
                    : '⚠ Confirm (damaged)'}
              </Btn>
            </Flex>
          </div>
        </Modal>
      )}
    </div>
  );
}
