import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { dashApi } from './api';
import Dashboard from './components/pages/Dashboard';
import Billing from './components/pages/Billing';
import Inventory from './components/pages/Inventory';
import GRNPage from './components/pages/GRNPage';
import Customers from './components/pages/Customers';
import Alerts from './components/pages/Alerts';
import Expenses from './components/pages/Expenses';
import Discounts from './components/pages/Discounts';
import Users from './components/pages/Users';
import Settings from './components/pages/Settings';
import Rentals from './components/pages/Rentals';
import Login from './components/pages/Login';

// ── Nav definitions ───────────────────────────────────────────────────────────

// Platform users only see Users (Owners + Admins)
const PLATFORM_NAV = [{ to: '/users', label: 'Users', icon: UsersIcon }];

// Shop NAV — each item has optional `roles` array; if absent = all shop roles
const SHOP_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: DashIcon },
  { to: '/billing', label: 'Billing', icon: BillIcon },
  { to: '/inventory', label: 'Inventory', icon: InvIcon },
  { to: '/grn', label: 'GRN', icon: GrnIcon },
  { to: '/rentals', label: 'Rentals', icon: RentIcon },

  { to: '/discounts', label: 'Discounts', icon: DiscIcon },
  { to: '/customers', label: 'Customers', icon: CustIcon },
  { to: '/alerts', label: 'Alerts', icon: BellIcon, badge: true },
  { to: '/expenses', label: 'Expenses', icon: ExpIcon },
  { to: '/users', label: 'Users', icon: UsersIcon, roles: ['owner'] },
  { to: '/settings', label: 'Settings', icon: SettIcon },
];

// ── Error boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(err) {
    return { error: err };
  }
  render() {
    if (this.state.error)
      return (
        <div style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>⚠</div>
          <div style={{ fontWeight: 600, color: 'var(--col-text)', marginBottom: 6 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 12, color: 'var(--col-text-3)', marginBottom: 20 }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--col-accent)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Try again
          </button>
        </div>
      );
    return this.props.children;
  }
}

// ── AppShell ─────────────────────────────────────────────────────────────────
function AppShell() {
  const { user, loading, logout, isPlatform, activeBranchId, branches, switchBranch } = useAuth();

  if (loading)
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--col-bg)',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,.1)',
            borderTopColor: 'var(--col-accent)',
            animation: 'spin .7s linear infinite',
          }}
        />
        <div style={{ fontSize: 12, color: 'var(--col-text-3)' }}>Loading…</div>
      </div>
    );

  if (!user) return <Navigate to="/login" replace />;

  // Platform users who are pure admin/SA — no shop access
  const isPurePlatform = isPlatform && user.role !== 'owner';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar user={user} logout={logout} isPlatform={isPurePlatform} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar
          user={user}
          isPlatform={isPurePlatform}
          branches={branches}
          activeBranchId={activeBranchId}
          switchBranch={switchBranch}
        />
        <main
          style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', background: 'var(--col-bg)' }}
        >
          <ErrorBoundary>
            {isPurePlatform ? <PlatformRoutes /> : <ShopRoutes user={user} />}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function PlatformRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/users" replace />} />
      <Route path="/users" element={<Users />} />
      <Route path="/*" element={<Navigate to="/users" replace />} />
    </Routes>
  );
}

function ShopRoutes({ user }) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/billing" element={<Billing />} />
      <Route path="/inventory" element={<Inventory />} />
      <Route path="/grn" element={<GRNPage />} />
      <Route path="/rentals" element={<Rentals />} />
      <Route path="/discounts" element={<Discounts />} />
      <Route path="/customers" element={<Customers />} />
      <Route path="/alerts" element={<Alerts />} />
      <Route path="/expenses" element={<Expenses />} />
      <Route path="/settings" element={<Settings />} />
      {user.role === 'owner' && <Route path="/users" element={<Users />} />}
      <Route path="/*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ user, logout, isPlatform }) {
  const nav = isPlatform
    ? PLATFORM_NAV
    : SHOP_NAV.filter((item) => !item.roles || item.roles.includes(user.role));
  const brandLabel = isPlatform ? 'Nexifly Clothing System' : 'Retail POS';

  return (
    <nav
      style={{
        width: 'var(--sidebar-w)',
        background: 'var(--col-bg-2)',
        borderRight: '0.5px solid var(--col-border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <div style={{ padding: '20px 20px 16px', borderBottom: '0.5px solid var(--col-border)' }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '-0.3px',
            background: 'linear-gradient(135deg,#e94560,#f5a623)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Nexifly
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--col-text-3)',
            marginTop: 2,
            fontWeight: 500,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          {brandLabel}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflowY: 'auto',
        }}
      >
        {nav.map(({ to, label, icon: Icon, badge }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: 13,
              color: isActive ? '#fff' : 'var(--col-text-2)',
              background: isActive ? 'var(--col-accent)' : 'transparent',
              transition: 'all var(--transition)',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={16} active={isActive} />
                <span style={{ flex: 1 }}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      <div style={{ padding: '14px 16px', borderTop: '0.5px solid var(--col-border)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 10px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255,255,255,.04)',
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#e94560,#f5a623)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {(user?.username || user?.name || '?').slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--col-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.username || user?.name || 'User'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--col-text-3)', textTransform: 'capitalize' }}>
              {user?.role?.replace(/_/g, ' ')}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            marginTop: 8,
            width: '100%',
            padding: '7px',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            color: 'var(--col-text-3)',
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all var(--transition)',
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,35,60,.12)';
            e.currentTarget.style.color = '#ef233c';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--col-text-3)';
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l4-4-4-4M14 8H6"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Sign out
        </button>
      </div>
    </nav>
  );
}

// ── Notification Bell ─────────────────────────────────────────────────────────
function NotificationBell({ branchId }) {
  const [open, setOpen] = React.useState(false);
  const [lowStock, setLowStock] = React.useState([]);
  const [upcomingRentals, setUpcomingRentals] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const ref = React.useRef(null);

  // Load low stock from dashboard on mount and every 2 minutes
  const load = React.useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const { rentalApi } = await import('./api');
      const [dashData, reservedData, activeData] = await Promise.all([
        dashApi.get(branchId).catch(() => null),
        rentalApi.list(branchId, { status: 'reserved', limit: 100 }).catch(() => null),
        rentalApi.list(branchId, { status: 'active', limit: 100 }).catch(() => null),
      ]);

      const lowStockItems = dashData?.lowStock || [];

      // Use string comparison to avoid UTC timezone shift (Sri Lanka = UTC+5:30)
      const pad = (n) => String(n).padStart(2, '0');
      const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const today = new Date();
      const plus3 = new Date(today);
      plus3.setDate(plus3.getDate() + 3);
      const todayStr = toStr(today);
      const plus3Str = toStr(plus3);

      const allRentals = [
        ...(reservedData?.items || reservedData?.rows || []),
        ...(activeData?.items || activeData?.rows || []),
      ];

      // Show if rented_date OR reserved_date falls within today and next 3 days
      const upcomingRentals = allRentals.filter((r) => {
        const d = r.rented_date || r.reserved_date;
        return d && d >= todayStr && d <= plus3Str;
      });

      setLowStock(lowStockItems);
      setUpcomingRentals(upcomingRentals);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  React.useEffect(() => {
    load();
    const interval = setInterval(load, 120000);
    // Refresh when a GRN is created (stock levels change)
    window.addEventListener('nxf:stock-updated', load);
    return () => {
      clearInterval(interval);
      window.removeEventListener('nxf:stock-updated', load);
    };
  }, [load]);

  // Close on outside click
  React.useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const count = lowStock.length + upcomingRentals.length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: 'relative',
          width: 34,
          height: 34,
          borderRadius: '50%',
          border: '0.5px solid var(--col-border-2)',
          background: open ? 'rgba(233,69,96,.12)' : 'var(--col-bg-3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all var(--transition)',
        }}
      >
        <BellIcon size={16} />
        {count > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: 'var(--col-red)',
              color: '#fff',
              fontSize: 9,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              border: '1.5px solid var(--col-bg-2)',
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 42,
            right: 0,
            zIndex: 999,
            width: 320,
            maxHeight: 420,
            overflowY: 'auto',
            background: 'var(--col-bg-2)',
            border: '0.5px solid var(--col-border-2)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 12px 40px rgba(0,0,0,.5)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '0.5px solid var(--col-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 13 }}>Alerts</span>
            <span style={{ fontSize: 11, color: 'var(--col-text-3)' }}>
              {count} alert{count !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Content */}
          {loading ? (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--col-text-3)',
                fontSize: 12,
              }}
            >
              Loading…
            </div>
          ) : count === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--col-text-3)' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>✓</div>
              <div style={{ fontSize: 12 }}>All good — no alerts</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Upcoming rentals — blue */}
              {upcomingRentals.length > 0 && (
                <>
                  <div
                    style={{
                      padding: '5px 16px',
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#2196f3',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      background: 'rgba(33,150,243,.06)',
                      borderBottom: '0.5px solid var(--col-border)',
                    }}
                  >
                    📅 Upcoming rentals — within 3 days
                  </div>
                  {upcomingRentals.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        padding: '10px 16px',
                        borderBottom: '0.5px solid var(--col-border)',
                        background: 'rgba(33,150,243,.05)',
                        borderLeft: '3px solid #2196f3',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 12 }}>
                        {r.product_name || r.variant_sku || 'Rental item'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--col-text-3)', marginTop: 2 }}>
                        {r.customer_name || 'Customer'} · {r.rented_date || r.reserved_date}
                      </div>
                    </div>
                  ))}
                </>
              )}
              {/* Low stock — red/yellow */}
              {lowStock.length > 0 && (
                <>
                  <div
                    style={{
                      padding: '5px 16px',
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--col-amber)',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      background: 'rgba(245,166,35,.06)',
                      borderBottom: '0.5px solid var(--col-border)',
                    }}
                  >
                    ⚠ Low stock
                  </div>
                  {lowStock.map((item, i) => (
                    <div
                      key={item.sku || i}
                      style={{
                        padding: '10px 16px',
                        borderBottom:
                          i < lowStock.length - 1 ? '0.5px solid var(--col-border)' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: item.stock_qty === 0 ? 'rgba(233,69,96,.05)' : 'transparent',
                        borderLeft: `3px solid ${item.stock_qty === 0 ? 'var(--col-red)' : 'var(--col-amber)'}`,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 12,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 180,
                          }}
                        >
                          {item.name}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: 'var(--col-text-3)',
                            fontFamily: 'var(--font-mono)',
                            marginTop: 2,
                          }}
                        >
                          {item.sku}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                        {(() => {
                          const isFabric = item.inventory_mode === 'continuous';
                          const qty = isFabric
                            ? Number(item.stock_qty_continuous || 0)
                            : Number(item.stock_qty || 0);
                          const unit = isFabric ? item.fabric_unit || 'm' : '';
                          return (
                            <>
                              <div
                                style={{
                                  fontWeight: 700,
                                  fontSize: 13,
                                  color: qty === 0 ? 'var(--col-red)' : 'var(--col-amber)',
                                }}
                              >
                                {qty === 0 ? 'OUT' : `${qty}${unit}`}
                              </div>
                              <div
                                style={{ fontSize: 9, color: 'var(--col-text-3)', marginTop: 1 }}
                              >
                                {qty === 0 ? 'out of stock' : 'remaining'}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Footer */}
          {count > 0 && (
            <div
              style={{
                padding: '10px 16px',
                borderTop: '0.5px solid var(--col-border)',
                textAlign: 'center',
              }}
            >
              <a
                href="/alerts"
                onClick={() => setOpen(false)}
                style={{
                  fontSize: 11,
                  color: 'var(--col-accent)',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                View all alerts →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function Topbar({ user, isPlatform, branches, activeBranchId, switchBranch }) {
  const activeBranch = branches.find((b) => b.id === activeBranchId);
  const displayName = isPlatform
    ? 'Nexifly Clothing System'
    : activeBranch?.shop_name ||
      activeBranch?.name ||
      user?.shopName ||
      user?.businessName ||
      'Shop';

  return (
    <div
      style={{
        height: 'var(--topbar-h)',
        background: 'var(--col-bg-2)',
        borderBottom: '0.5px solid var(--col-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: 'var(--col-text)', fontWeight: 500, fontSize: 13 }}>
          {displayName}
        </span>

        {/* Branch switcher — only for owners with multiple branches */}
        {!isPlatform && branches.length > 1 && (
          <select
            value={activeBranchId || ''}
            onChange={(e) => switchBranch(parseInt(e.target.value))}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-md)',
              border: '0.5px solid var(--col-border-2)',
              background: 'var(--col-bg-3)',
              color: 'var(--col-text)',
              fontSize: 12,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.shop_name || b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {!isPlatform && <NotificationBell branchId={activeBranchId} />}
        <div style={{ fontSize: 12, color: 'var(--col-text-3)' }}>
          {new Date().toLocaleDateString('en-LK', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </div>
      </div>
    </div>
  );
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function DashIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".7" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".7" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".7" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".7" />
    </svg>
  );
}
function BillIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect
        x="2"
        y="1"
        width="12"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity=".7"
      />
      <path
        d="M5 5h6M5 8h6M5 11h4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".7"
      />
    </svg>
  );
}
function InvIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect
        x="1"
        y="4"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity=".7"
      />
      <path
        d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity=".7"
      />
      <path d="M5 9h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}
function GrnIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity=".7"
      />
      <path
        d="M8 1V15M2 4.5L14 11.5M14 4.5L2 11.5"
        stroke="currentColor"
        strokeWidth="1"
        opacity=".4"
      />
    </svg>
  );
}
function RentIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" opacity=".7" />
      <path
        d="M8 5v3l2 2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity=".7"
      />
    </svg>
  );
}
function DiscIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="5.5" cy="5.5" r="2" stroke="currentColor" strokeWidth="1.2" opacity=".7" />
      <circle cx="10.5" cy="10.5" r="2" stroke="currentColor" strokeWidth="1.2" opacity=".7" />
      <path
        d="M13 3L3 13"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".7"
      />
    </svg>
  );
}
function CustIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.2" opacity=".7" />
      <path
        d="M2 14c0-2.8 2.7-5 6-5s6 2.2 6 5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".7"
      />
    </svg>
  );
}
function BellIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1a5 5 0 0 1 5 5v3l1 2H2L3 9V6a5 5 0 0 1 5-5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity=".7"
      />
      <path d="M6.5 13a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.2" opacity=".7" />
    </svg>
  );
}
function ExpIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <rect
        x="1"
        y="3"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity=".7"
      />
      <path d="M1 7h14" stroke="currentColor" strokeWidth="1.2" opacity=".5" />
      <circle cx="5" cy="10" r="1" fill="currentColor" opacity=".7" />
    </svg>
  );
}
function UsersIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" opacity=".7" />
      <path
        d="M1 13c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".7"
      />
      <path
        d="M11 8a2.5 2.5 0 1 0 0-5M15 13c0-2.5-2-4.5-4-4.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".7"
      />
    </svg>
  );
}
function SettIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" opacity=".7" />
      <path
        d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".7"
      />
    </svg>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--col-panel)',
              color: 'var(--col-text)',
              border: '0.5px solid var(--col-border-2)',
              fontSize: 13,
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<AppShell />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
