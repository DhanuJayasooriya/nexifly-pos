import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { StatCard, Card, Table, Badge } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { dashApi } from '../../api';

const TOOLTIP = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--col-bg-3)',
        border: '0.5px solid var(--col-border-2)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
      }}
    >
      <div style={{ color: 'var(--col-text-2)', marginBottom: 2 }}>{label}</div>
      <div style={{ color: 'var(--col-accent)', fontWeight: 600 }}>
        Rs {Number(payload[0].value).toLocaleString()}
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { user, activeBranchId: branchId, branchSettings } = useAuth();

  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    dashApi
      .get(branchId)
      .then((data) => setDash(data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [branchId]);

  const daily = dash?.daily || {};
  const stats = [
    {
      label: "Today's revenue",
      value: `Rs ${Number(daily.daily_total || 0).toLocaleString()}`,
      sub: `${daily.daily_count || 0} transactions`,
      icon: '📈',
      accent: 'var(--col-accent)',
    },
    {
      label: 'Monthly total',
      value: `Rs ${Number(daily.monthly_total || 0).toLocaleString()}`,
      sub: 'Current month',
      icon: '💰',
      accent: 'var(--col-gold)',
    },
    {
      label: 'Low stock items',
      value: (dash?.lowStock || []).length,
      sub:
        (dash?.lowStock || [])
          .map((p) => p.name)
          .slice(0, 2)
          .join(', ') || '—',
      icon: '⚠️',
      accent: 'var(--col-red)',
    },
    {
      label: 'Active rentals',
      value: dash?.activeRentals || 0,
      sub: `${dash?.overdueRentals || 0} overdue`,
      icon: '⏱️',
      accent: 'var(--col-teal)',
    },
  ];

  // Build hourly data from API, fill gaps with 0
  const HOURLY = Array.from({ length: 10 }, (_, i) => {
    const h = 8 + i;
    const found = (dash?.hourly || []).find((r) => parseInt(r.hour) === h);
    return { hour: `${h}:00`, sales: found ? parseFloat(found.total) : 0 };
  });

  // Weekly — fill all 7 days, use real data where available
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyMap = {};
  (dash?.weekly || []).forEach((r) => {
    weeklyMap[r.day] = parseFloat(r.revenue);
  });
  const WEEKLY = DAYS.map((day) => ({ day, revenue: weeklyMap[day] || 0 }));

  const recentSales = (dash?.recentSales || []).map((s) => ({
    id: s.id,
    customer: s.customer_name || 'Walk-in',
    total: s.total_amount ?? s.total,
    time: new Date(s.created_at).toLocaleTimeString('en-LK', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    status: s.status || 'paid',
    items: s.item_count || 0,
  }));

  const recentGRNs = (dash?.recentGRNs || []).map((g) => ({
    id: g.id,
    no: g.grn_no,
    supplier: g.supplier_name || '—',
    type: g.grn_type,
    date: g.received_at?.slice(0, 10),
    items: g.item_count || 0,
    status: g.status,
  }));

  if (loading)
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '50vh',
          flexDirection: 'column',
          gap: 12,
          color: 'var(--col-text-2)',
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: '2px solid var(--col-border-2)',
            borderTopColor: 'var(--col-accent)',
            animation: 'spin .7s linear infinite',
          }}
        />
        Loading dashboard…
      </div>
    );

  if (error)
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--col-red)' }}>
        ⚠ {error}
        {!branchId && (
          <div style={{ color: 'var(--col-text-3)', marginTop: 8, fontSize: 13 }}>
            No branch assigned to your account.
          </div>
        )}
      </div>
    );

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              marginBottom: 16,
              color: 'var(--col-text-2)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Hourly sales today
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={HOURLY} barSize={18}>
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fill: 'var(--col-text-3)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<TOOLTIP />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
              <Bar dataKey="sales" fill="var(--col-accent)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              marginBottom: 16,
              color: 'var(--col-text-2)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Weekly revenue
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={WEEKLY}>
              <defs>
                <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--col-accent)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--col-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: 'var(--col-text-3)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<TOOLTIP />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--col-accent)"
                strokeWidth={2}
                fill="url(#gr)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card flush>
          <div
            style={{
              padding: '12px 16px',
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--col-text-2)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              borderBottom: '0.5px solid var(--col-border)',
            }}
          >
            Recent sales{' '}
            {recentSales.length === 0 && (
              <span style={{ fontWeight: 400, fontSize: 11, textTransform: 'none' }}>
                — no data yet
              </span>
            )}
          </div>
          <Table
            columns={[
              {
                key: 'id',
                label: '#',
                render: (r) => (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--col-text-3)',
                    }}
                  >
                    #{r.id}
                  </span>
                ),
              },
              { key: 'customer', label: 'Customer' },
              {
                key: 'total',
                label: 'Total',
                render: (r) => (
                  <span style={{ fontWeight: 600 }}>Rs {Number(r.total).toLocaleString()}</span>
                ),
              },
              {
                key: 'status',
                label: '',
                render: (r) => <Badge label={r.status} variant="green" size="sm" />,
              },
            ]}
            rows={recentSales}
            emptyMsg="No sales today yet"
          />
        </Card>

        <Card flush>
          <div
            style={{
              padding: '12px 16px',
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--col-text-2)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              borderBottom: '0.5px solid var(--col-border)',
            }}
          >
            Recent GRNs{' '}
            {recentGRNs.length === 0 && (
              <span style={{ fontWeight: 400, fontSize: 11, textTransform: 'none' }}>
                — no data yet
              </span>
            )}
          </div>
          <Table
            columns={[
              {
                key: 'no',
                label: 'GRN No.',
                render: (r) => (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--col-teal)',
                    }}
                  >
                    {r.no}
                  </span>
                ),
              },
              { key: 'supplier', label: 'Supplier' },
              {
                key: 'type',
                label: 'Type',
                render: (r) => (
                  <Badge label={r.type} variant={r.type === 'bulk' ? 'amber' : 'teal'} size="sm" />
                ),
              },
              { key: 'items', label: 'Items' },
            ]}
            rows={recentGRNs}
            emptyMsg="No GRNs yet"
          />
        </Card>
      </div>
    </div>
  );
}
