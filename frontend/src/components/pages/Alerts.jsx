import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Card, Btn, Flex, SectionHeader, StatCard } from '../ui';
import { notifApi, dashApi, rentalApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

const TYPE_META = {
  upcoming_rental: {
    icon: '📅',
    label: 'Upcoming rental',
    color: '#2196f3',
    bg: 'rgba(33,150,243,.10)',
    border: 'rgba(33,150,243,.35)',
  },
  low_stock: {
    icon: '⚠️',
    label: 'Low stock',
    color: 'var(--col-amber)',
    bg: 'rgba(245,166,35,.08)',
    border: 'rgba(245,166,35,.30)',
  },
  stock_out: {
    icon: '🚫',
    label: 'Out of stock',
    color: 'var(--col-red)',
    bg: 'rgba(233,69,96,.08)',
    border: 'rgba(233,69,96,.35)',
  },
  overdue_rental: {
    icon: '⏰',
    label: 'Overdue rental',
    color: 'var(--col-gold)',
    bg: 'rgba(245,166,35,.08)',
    border: 'rgba(245,166,35,.30)',
  },
  new_grn: {
    icon: '📋',
    label: 'New GRN',
    color: 'var(--col-teal)',
    bg: 'rgba(0,180,216,.08)',
    border: 'rgba(0,180,216,.25)',
  },
  expiring_sub: {
    icon: '⚡',
    label: 'Subscription',
    color: 'var(--col-accent)',
    bg: 'rgba(233,69,96,.06)',
    border: 'rgba(233,69,96,.25)',
  },
  manual: {
    icon: '🔔',
    label: 'Manual',
    color: 'var(--col-text-2)',
    bg: 'rgba(255,255,255,.03)',
    border: 'var(--col-border-2)',
  },
};

const getMeta = (type, stockQty) => {
  if (type === 'low_stock' && stockQty === 0) return TYPE_META.stock_out;
  return TYPE_META[type] || TYPE_META.manual;
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Alerts() {
  const { user, activeBranchId } = useAuth();
  const branchId = activeBranchId || user?.branchId || user?.branch_id;

  const [dbNotifs, setDbNotifs] = useState([]);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [upcomingAlerts, setUpcomingAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadAll = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const pad = (n) => String(n).padStart(2, '0');
      const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const today = new Date();
      const plus3 = new Date(today);
      plus3.setDate(plus3.getDate() + 3);
      const todayStr = toStr(today);
      const plus3Str = toStr(plus3);

      const [notifData, dashData, reservedData, activeData] = await Promise.all([
        notifApi.list().catch(() => []),
        dashApi.get(branchId).catch(() => null),
        rentalApi.list(branchId, { status: 'reserved', limit: 100 }).catch(() => null),
        rentalApi.list(branchId, { status: 'active', limit: 100 }).catch(() => null),
      ]);

      setDbNotifs(Array.isArray(notifData) ? notifData : notifData?.items || notifData?.rows || []);

      // Live low-stock alerts from dashboard
      if (dashData?.lowStock) {
        setLiveAlerts(
          dashData.lowStock.map((item) => {
            const isFabric = item.inventory_mode === 'continuous';
            const qty = isFabric
              ? Number(item.stock_qty_continuous || 0)
              : Number(item.stock_qty || 0);
            const unit = isFabric ? item.fabric_unit || 'm' : '';
            return {
              id: `live-${item.sku}`,
              type: qty === 0 ? 'stock_out' : 'low_stock',
              title: qty === 0 ? `Out of stock — ${item.name}` : `Low stock — ${item.name}`,
              message:
                qty === 0
                  ? `${item.sku} has 0 ${isFabric ? unit : 'units'} remaining`
                  : `${item.sku} has only ${qty}${unit} left (threshold: ${item.low_stock_threshold})`,
              is_read: false,
              created_at: new Date().toISOString(),
              isLive: true,
              stock_qty: qty,
            };
          }),
        );
      }

      // Upcoming rental alerts — rented_date or reserved_date within 3 days
      const allRentals = [
        ...(reservedData?.items || reservedData?.rows || []),
        ...(activeData?.items || activeData?.rows || []),
      ];
      const upcoming = allRentals.filter((r) => {
        const d = r.rented_date || r.reserved_date;
        return d && d >= todayStr && d <= plus3Str;
      });
      setUpcomingAlerts(
        upcoming.map((r) => ({
          id: `rental-${r.id}`,
          type: 'upcoming_rental',
          title: `Upcoming rental — ${r.product_name || r.sku || 'Item'}`,
          message: `${r.customer_name || 'Customer'} · ${r.rented_date || r.reserved_date} → ${r.due_date}`,
          is_read: false,
          created_at: new Date().toISOString(),
          isLive: true,
        })),
      );
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const markRead = async (id) => {
    if (String(id).startsWith('live-') || String(id).startsWith('rental-')) return;
    try {
      await notifApi.markRead(id);
      setDbNotifs((p) => p.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const markAllRead = async () => {
    try {
      await notifApi.markAllRead();
      setDbNotifs((p) => p.map((n) => ({ ...n, is_read: true })));
      toast.success('All marked as read');
    } catch {
      toast.error('Failed');
    }
  };

  const dismiss = (id) => {
    if (String(id).startsWith('live-')) {
      setLiveAlerts((p) => p.filter((n) => n.id !== id));
      return;
    }
    if (String(id).startsWith('rental-')) {
      setUpcomingAlerts((p) => p.filter((n) => n.id !== id));
      return;
    }
    setDbNotifs((p) => p.filter((n) => n.id !== id));
  };

  // Merge all — upcoming first (blue), then live stock, then DB
  const all = [...upcomingAlerts, ...liveAlerts, ...dbNotifs];
  const unread = all.filter((n) => !n.is_read).length;

  const FILTERS = [
    'all',
    'unread',
    'upcoming_rental',
    'stock_out',
    'low_stock',
    'overdue_rental',
    'new_grn',
  ];

  const filtered =
    filter === 'all'
      ? all
      : filter === 'unread'
        ? all.filter((n) => !n.is_read)
        : all.filter((n) => n.type === filter);

  const stockOutCount = liveAlerts.filter((n) => n.type === 'stock_out').length;
  const lowStockCount = liveAlerts.filter((n) => n.type === 'low_stock').length;
  const upcomingCount = upcomingAlerts.length;
  const overdueCount = dbNotifs.filter((n) => n.type === 'overdue_rental').length;

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
        Loading notifications…
      </div>
    );

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        title="Alerts & Notifications"
        action={
          <Flex gap={8}>
            <Btn variant="secondary" size="sm" onClick={loadAll}>
              ↻ Refresh
            </Btn>
            {unread > 0 && (
              <Btn variant="secondary" size="sm" onClick={markAllRead}>
                Mark all read
              </Btn>
            )}
          </Flex>
        }
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <StatCard label="Out of stock" value={stockOutCount} accent="var(--col-red)" />
        <StatCard label="Low stock" value={lowStockCount} accent="var(--col-amber)" />
        <StatCard label="Upcoming rentals" value={upcomingCount} accent="#2196f3" />
        <StatCard label="Overdue rentals" value={overdueCount} accent="var(--col-gold)" />
      </div>

      {/* Filter pills */}
      <Flex gap={6} wrap>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              background: filter === f ? 'var(--col-accent)' : 'rgba(255,255,255,.06)',
              color: filter === f ? '#fff' : 'var(--col-text-2)',
              border: `0.5px solid ${filter === f ? 'var(--col-accent)' : 'var(--col-border-2)'}`,
              transition: 'all var(--transition)',
            }}
          >
            {f === 'all' ? `All (${all.length})` : f.replace(/_/g, ' ')}
          </button>
        ))}
      </Flex>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--col-text-3)' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔕</div>
            <div>No notifications here</div>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((n) => {
            const meta = getMeta(n.type, n.stock_qty);
            return (
              <div
                key={n.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  padding: '14px 16px',
                  background: n.is_read ? 'var(--col-bg-2)' : meta.bg,
                  border: `0.5px solid ${n.is_read ? 'var(--col-border)' : meta.border}`,
                  borderLeft: `3.5px solid ${n.is_read ? 'var(--col-border)' : meta.color}`,
                  borderRadius: 'var(--radius-lg)',
                  opacity: n.is_read ? 0.65 : 1,
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{meta.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Flex justify="space-between" align="flex-start" gap={12}>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: n.is_read ? 400 : 600,
                          fontSize: 13,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span>{n.title}</span>
                        {!n.is_read && (
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: meta.color,
                              flexShrink: 0,
                              display: 'inline-block',
                            }}
                          />
                        )}
                        {n.isLive && (
                          <span
                            style={{
                              fontSize: 9,
                              background: 'rgba(255,255,255,.1)',
                              color: 'var(--col-text-3)',
                              padding: '1px 5px',
                              borderRadius: 8,
                              fontWeight: 400,
                            }}
                          >
                            LIVE
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--col-text-2)',
                          marginTop: 3,
                          lineHeight: 1.5,
                        }}
                      >
                        {n.message}
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: 6,
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{ fontSize: 10, color: 'var(--col-text-3)', whiteSpace: 'nowrap' }}
                      >
                        {timeAgo(n.created_at)}
                      </span>
                      <Flex gap={4} align="center">
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 10,
                            background: meta.bg,
                            color: meta.color,
                            border: `0.5px solid ${meta.border}`,
                          }}
                        >
                          {meta.label}
                        </span>
                        {!n.is_read && !n.isLive && (
                          <button
                            onClick={() => markRead(n.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 10,
                              color: 'var(--col-text-3)',
                              padding: '1px 5px',
                              borderRadius: 4,
                            }}
                          >
                            Mark read
                          </button>
                        )}
                        <button
                          onClick={() => dismiss(n.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 13,
                            color: 'var(--col-text-3)',
                            padding: '1px 4px',
                            lineHeight: 1,
                          }}
                        >
                          ✕
                        </button>
                      </Flex>
                    </div>
                  </Flex>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
