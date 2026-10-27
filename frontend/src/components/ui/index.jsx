import React, { useRef, useEffect } from 'react';

/* ── Badge ─────────────────────────────────────────────────────────────────── */
export function Badge({ label, variant = 'default', size = 'md' }) {
  const variants = {
    default: { bg: 'rgba(255,255,255,.08)', color: '#8892a4' },
    purple: { bg: 'rgba(233,69,96,.15)', color: '#e94560' },
    teal: { bg: 'rgba(0,180,216,.15)', color: '#00b4d8' },
    green: { bg: 'rgba(6,214,160,.15)', color: '#06d6a0' },
    amber: { bg: 'rgba(245,166,35,.15)', color: '#f5a623' },
    red: { bg: 'rgba(239,35,60,.15)', color: '#ef233c' },
    gold: { bg: 'rgba(245,166,35,.18)', color: '#f5a623' },
    platinum: { bg: 'rgba(0,180,216,.18)', color: '#00b4d8' },
  };
  const { bg, color } = variants[variant] || variants.default;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: size === 'sm' ? '1px 6px' : '3px 9px',
        borderRadius: 20,
        background: bg,
        color,
        fontSize: size === 'sm' ? 10 : 11,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

/* ── Button ────────────────────────────────────────────────────────────────── */
export function Btn({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  full,
  icon,
  style = {},
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontWeight: 500,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 'var(--radius-md)',
    transition: 'var(--transition)',
    opacity: disabled ? 0.45 : 1,
    width: full ? '100%' : undefined,
    justifyContent: full ? 'center' : undefined,
    fontFamily: 'var(--font-sans)',
    fontSize: size === 'sm' ? 12 : 13,
    padding: size === 'sm' ? '5px 12px' : size === 'lg' ? '11px 22px' : '8px 16px',
  };
  const variants = {
    primary: { background: 'var(--col-accent)', color: '#fff' },
    secondary: {
      background: 'rgba(255,255,255,.07)',
      color: 'var(--col-text)',
      border: '0.5px solid var(--col-border-2)',
    },
    ghost: { background: 'transparent', color: 'var(--col-text-2)' },
    success: {
      background: 'rgba(6,214,160,.2)',
      color: '#06d6a0',
      border: '0.5px solid rgba(6,214,160,.3)',
    },
    danger: {
      background: 'rgba(239,35,60,.15)',
      color: '#ef233c',
      border: '0.5px solid rgba(239,35,60,.3)',
    },
    gold: {
      background: 'rgba(245,166,35,.2)',
      color: '#f5a623',
      border: '0.5px solid rgba(245,166,35,.3)',
    },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...(variants[variant] || variants.primary), ...style }}
    >
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      {children}
    </button>
  );
}

/* ── Input ─────────────────────────────────────────────────────────────────── */
export function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  full = true,
  style = {},
  mono,
}) {
  const inp = (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: full ? '100%' : undefined,
        padding: '8px 12px',
        borderRadius: 'var(--radius-md)',
        border: '0.5px solid var(--col-border-2)',
        background: 'var(--col-bg-3)',
        color: 'var(--col-text)',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
        fontSize: mono ? 12 : 13,
        outline: 'none',
        transition: 'border-color var(--transition)',
        ...style,
      }}
      onFocus={(e) => (e.target.style.borderColor = 'var(--col-accent)')}
      onBlur={(e) => (e.target.style.borderColor = 'var(--col-border-2)')}
    />
  );
  if (!label) return inp;
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
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
      {inp}
    </label>
  );
}

/* ── Select ────────────────────────────────────────────────────────────────── */
export function Select({ label, value, onChange, options }) {
  const sel = (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '8px 12px',
        borderRadius: 'var(--radius-md)',
        border: '0.5px solid var(--col-border-2)',
        background: 'var(--col-bg-3)',
        color: 'var(--col-text)',
        fontSize: 13,
        outline: 'none',
        cursor: 'pointer',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
  if (!label) return sel;
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
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
      {sel}
    </label>
  );
}

/* ── Card ──────────────────────────────────────────────────────────────────── */
export function Card({ children, style = {}, flush, accent }) {
  return (
    <div
      style={{
        background: 'var(--col-panel)',
        border: `0.5px solid ${accent ? 'var(--col-accent)' : 'var(--col-border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: flush ? 0 : '1rem 1.25rem',
        overflow: flush ? 'hidden' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Modal ─────────────────────────────────────────────────────────────────── */
/*
 * THE FIX:
 * The modal box is a flex-column container with overflow:hidden.
 *
 *   ┌─────────────────────────────────┐
 *   │  HEADER  (flex-shrink:0)        │  ← always visible, never scrolls away
 *   │  title                    [✕]  │
 *   ├─────────────────────────────────┤
 *   │  BODY  (flex:1, overflow:auto)  │  ← only this part scrolls
 *   │  ...content...                  │
 *   └─────────────────────────────────┘
 *
 * useRef + useEffect reset body.scrollTop = 0 every time the modal mounts,
 * so it always opens at the top even if previously scrolled.
 */
export function Modal({ title, onClose, children, width = 480 }) {
  const bodyRef = useRef(null);

  // Always open at the top
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, []);

  return (
    /* Overlay — click outside to close */
    <div
      style={{
        position: 'sticky',
        inset: 0,
        background: 'rgba(0,0,0,.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Modal box */}
      <div
        className="fade-in"
        style={{
          width,
          maxWidth: '95vw',
          maxHeight: '90vh',
          background: 'var(--col-panel)',
          borderRadius: 'var(--radius-xl)',
          border: '0.5px solid var(--col-border-2)',
          boxShadow: '0 24px 64px rgba(0,0,0,.7)',
          /* Flex column — header sits above scrollable body */
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden' /* clip rounded corners cleanly */,
        }}
      >
        {/* ── HEADER ─ flex-shrink:0 keeps it pinned at top ALWAYS ────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '15px 20px 14px',
            borderBottom: '0.5px solid var(--col-border)',
            flexShrink: 0 /* NEVER shrink — this is the key */,
            background: 'var(--col-panel)',
          }}
        >
          {/* Title */}
          <span
            style={{
              fontWeight: 600,
              fontSize: 15,
              color: 'var(--col-text)',
              letterSpacing: '-0.1px',
            }}
          >
            {title}
          </span>

          {/* ✕ Close button — circular pill matching Add supplier style */}
          <button
            onClick={onClose}
            title="Close"
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: '0.5px solid var(--col-border-2)',
              background: 'rgba(255,255,255,.07)',
              color: 'var(--col-text)',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all var(--transition)',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,35,60,.22)';
              e.currentTarget.style.borderColor = 'rgba(239,35,60,.45)';
              e.currentTarget.style.color = '#ef233c';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,.07)';
              e.currentTarget.style.borderColor = 'var(--col-border-2)';
              e.currentTarget.style.color = 'var(--col-text)';
            }}
          >
            ✕
          </button>
        </div>

        {/* ── BODY ─ the ONLY part that scrolls ───────────────────────────── */}
        <div
          ref={bodyRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 20px 24px',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Table ─────────────────────────────────────────────────────────────────── */
export function Table({ columns, rows, emptyMsg = 'No records found' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  padding: '10px 14px',
                  textAlign: 'left',
                  fontWeight: 500,
                  color: 'var(--col-text-2)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  borderBottom: '1px solid var(--col-border)',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--col-text-3)' }}
              >
                {emptyMsg}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: '0.5px solid var(--col-border)',
                  transition: 'background var(--transition)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.03)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={{
                      padding: '10px 14px',
                      color: 'var(--col-text)',
                      verticalAlign: 'middle',
                    }}
                  >
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ── Stat Card ─────────────────────────────────────────────────────────────── */
export function StatCard({ label, value, sub, icon, accent }) {
  return (
    <div
      style={{
        background: 'var(--col-panel)',
        border: '0.5px solid var(--col-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.1rem 1.25rem',
        borderLeft: accent ? `3px solid ${accent}` : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--col-text)', marginTop: 6 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--col-text-3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/* ── Spinner ────────────────────────────────────────────────────────────────── */
export function Spinner() {
  return (
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: '2px solid var(--col-border-2)',
        borderTopColor: 'var(--col-accent)',
        animation: 'spin .7s linear infinite',
        display: 'inline-block',
      }}
    />
  );
}

/* ── Section Header ─────────────────────────────────────────────────────────── */
export function SectionHeader({ title, action }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--col-text)' }}>{title}</h2>
      {action}
    </div>
  );
}

/* ── Empty State ────────────────────────────────────────────────────────────── */
export function EmptyState({ icon = '📦', title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--col-text-2)' }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontWeight: 500, marginBottom: 4 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--col-text-3)' }}>{sub}</div>}
    </div>
  );
}

/* ── Grid ──────────────────────────────────────────────────────────────────── */
export function Grid({ cols = 2, gap = 12, children, style = {} }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Flex ──────────────────────────────────────────────────────────────────── */
export function Flex({
  children,
  gap = 8,
  align = 'center',
  justify = 'flex-start',
  wrap,
  style = {},
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Divider ────────────────────────────────────────────────────────────────── */
export function Divider({ style = {} }) {
  return <div style={{ height: '.5px', background: 'var(--col-border)', ...style }} />;
}
