import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { Btn, Input } from '../ui';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Enter email and password');
      return;
    }
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back!`);
      // Platform users (super_admin, admin) have no branchId — route them differently
      const isPlatform = ['super_admin', 'admin'].includes(user.role);
      navigate(isPlatform ? '/dashboard' : '/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--col-bg)',
        backgroundImage:
          'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(233,69,96,.18), transparent)',
      }}
    >
      <div
        className="fade-in"
        style={{
          width: 400,
          padding: '2.5rem',
          background: 'var(--col-panel)',
          borderRadius: 'var(--radius-xl)',
          border: '0.5px solid var(--col-border-2)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              background: 'linear-gradient(135deg,#e94560,#f5a623)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: 4,
            }}
          >
            Nexifly Systems
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--col-text-3)',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            Retail Clothing POS
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Email" value={email} onChange={setEmail} placeholder="you@example.com" />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
          />
          <Btn full size="lg" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Btn>
        </form>
      </div>
    </div>
  );
}
