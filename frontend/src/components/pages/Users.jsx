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
  EmptyState,
  StatCard,
} from '../ui';
import { useAuth } from '../../context/AuthContext';
import { branchApi, platformApi } from '../../api';

// ════════════════════════════════════════════════════════════════════════════
// PLATFORM VIEW — Super Admin + Admin manage Owners and Admins
// ════════════════════════════════════════════════════════════════════════════

function PlatformUsers() {
  const { user, isSA } = useAuth();
  const [tab, setTab] = useState('owners');

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="Users" />
      <Flex gap={6}>
        <TabPill label="Owners" active={tab === 'owners'} onClick={() => setTab('owners')} />
        {isSA && (
          <TabPill label="Admins" active={tab === 'admins'} onClick={() => setTab('admins')} />
        )}
      </Flex>
      {tab === 'owners' && <OwnersTab actorRole={user.role} />}
      {tab === 'admins' && isSA && <AdminsTab />}
    </div>
  );
}

function TabPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 18px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        border: 'none',
        background: active ? 'var(--col-accent)' : 'rgba(255,255,255,.06)',
        color: active ? '#fff' : 'var(--col-text-2)',
        transition: 'all var(--transition)',
      }}
    >
      {label}
    </button>
  );
}

// ── Owners tab ────────────────────────────────────────────────────────────────
const blankOwner = {
  username: '',
  email: '',
  password: '',
  businessName: '',
  businessLogoUrl: '',
  ownerContactNo: '',
  branchName: '',
  branchAddress: '',
  branchPhone: '',
  maxBranches: 1,
};

function OwnersTab({ actorRole }) {
  const isSA = actorRole === 'super_admin';
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankOwner);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfDel] = useState(null);
  const [showReset, setShowReset] = useState(null);
  const [newPwd, setNewPwd] = useState('');
  const f = (p) => setForm((prev) => ({ ...prev, ...p }));

  const load = async () => {
    try {
      const data = await platformApi.listOwners();
      setOwners(data.items || data.rows || data || []);
    } catch {
      toast.error('Failed to load owners');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(blankOwner);
    setModal(true);
  };
  const openEdit = (o) => {
    setEditing(o);
    setForm({
      username: o.username || '',
      email: o.email || '',
      businessName: o.business_name || '',
      businessLogoUrl: o.business_logo_url || '',
      ownerContactNo: o.owner_contact_no || '',
      branchName: o.name || '',
      branchAddress: o.default_branch_address || '',
      branchPhone: o.default_branch_contact_no || '',
      maxBranches: o.max_branches || 1,
      password: '',
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.username || !form.email || !form.businessName) {
      toast.error('Username, email and business name are required');
      return;
    }
    if (!editing && !form.password) {
      toast.error('Password is required');
      return;
    }
    if (!editing && !form.branchName) {
      toast.error('First branch name is required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await platformApi.updateOwner(editing.id, {
          businessName: form.businessName,
          businessLogoUrl: form.businessLogoUrl,
          ownerContactNo: form.ownerContactNo,
          defaultBranchAddress: form.branchAddress,
          defaultBranchContactNo: form.branchPhone,
          ...(isSA ? { maxBranches: parseInt(form.maxBranches) } : {}),
        });
        toast.success('Owner updated');
      } else {
        await platformApi.createOwner({
          username: form.username,
          email: form.email,
          password: form.password,
          businessName: form.businessName,
          businessLogoUrl: form.businessLogoUrl,
          ownerContactNo: form.ownerContactNo,
          branchName: form.branchName,
          branchAddress: form.branchAddress,
          branchPhone: form.branchPhone,
          maxBranches: isSA ? parseInt(form.maxBranches) : 1,
        });
        toast.success('Owner and first branch created');
      }
      await load();
      setModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    try {
      await platformApi.deleteOwner(id);
      await load();
      setConfDel(null);
      toast.success('Owner deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const resetPwd = async () => {
    if (!newPwd || newPwd.length < 6) {
      toast.error('Min 6 characters');
      return;
    }
    try {
      await platformApi.resetOwnerPwd(showReset.id, { password: newPwd });
      toast.success('Password reset');
      setShowReset(null);
      setNewPwd('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  if (loading)
    return (
      <div style={{ color: 'var(--col-text-2)', padding: '2rem', textAlign: 'center' }}>
        Loading owners…
      </div>
    );

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn onClick={openAdd}>+ Add owner</Btn>
      </div>
      <Card flush>
        {owners.length === 0 ? (
          <EmptyState icon="🏪" title="No owners yet" sub="Create the first business owner" />
        ) : (
          <Table
            columns={[
              {
                key: 'business',
                label: 'Business',
                render: (r) => (
                  <div>
                    <div style={{ fontWeight: 500 }}>{r.business_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--col-text-3)' }}>{r.username}</div>
                  </div>
                ),
              },
              {
                key: 'email',
                label: 'Email',
                render: (r) => (
                  <span style={{ fontSize: 12, color: 'var(--col-text-2)' }}>{r.email}</span>
                ),
              },
              { key: 'contact', label: 'Contact', render: (r) => r.owner_contact_no || '—' },
              {
                key: 'branches',
                label: 'Branches',
                render: (r) => (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {r.max_branches === 1 ? '1' : `0–${r.max_branches}`}
                  </span>
                ),
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
                    <Btn variant="ghost" size="sm" onClick={() => openEdit(r)}>
                      Edit
                    </Btn>
                    <Btn
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setShowReset(r);
                        setNewPwd('');
                      }}
                    >
                      Reset pwd
                    </Btn>
                    {isSA && (
                      <Btn variant="danger" size="sm" onClick={() => setConfDel(r)}>
                        Del
                      </Btn>
                    )}
                  </Flex>
                ),
              },
            ]}
            rows={owners}
          />
        )}
      </Card>

      {showModal && (
        <Modal
          title={editing ? `Edit — ${editing.business_name}` : 'Add Owner'}
          onClose={() => setModal(false)}
          width={540}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--col-text-2)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                padding: '6px 0 4px',
                borderBottom: '0.5px solid var(--col-border)',
              }}
            >
              Business information
            </div>
            <Input
              label="Business name *"
              value={form.businessName}
              onChange={(v) => f({ businessName: v })}
              placeholder="Emerald Fashion"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input
                label="Owner contact no."
                value={form.ownerContactNo}
                onChange={(v) => f({ ownerContactNo: v })}
                placeholder="077 123 4567"
              />
              <Input
                label="Business logo URL"
                value={form.businessLogoUrl}
                onChange={(v) => f({ businessLogoUrl: v })}
                placeholder="https://..."
              />
            </div>

            {!editing && (
              <>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--col-text-2)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    padding: '6px 0 4px',
                    borderBottom: '0.5px solid var(--col-border)',
                  }}
                >
                  First branch
                </div>
                <Input
                  label="Branch name *"
                  value={form.branchName}
                  onChange={(v) => f({ branchName: v })}
                  placeholder="Emerald Kandy"
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Input
                    label="Branch address"
                    value={form.branchAddress}
                    onChange={(v) => f({ branchAddress: v })}
                    placeholder="45 Dalada Veediya, Kandy"
                  />
                  <Input
                    label="Branch phone"
                    value={form.branchPhone}
                    onChange={(v) => f({ branchPhone: v })}
                    placeholder="081 234 5678"
                  />
                </div>
              </>
            )}

            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--col-text-2)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                padding: '6px 0 4px',
                borderBottom: '0.5px solid var(--col-border)',
              }}
            >
              Login & permissions
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input
                label="Username *"
                value={form.username}
                onChange={(v) => f({ username: v })}
                placeholder="owner_emerald"
              />
              <Input
                label="Email *"
                value={form.email}
                onChange={(v) => f({ email: v })}
                placeholder="owner@emerald.lk"
              />
            </div>
            {!editing && (
              <Input
                label="Password *"
                type="password"
                value={form.password}
                onChange={(v) => f({ password: v })}
                placeholder="Min 8 characters"
              />
            )}
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
                Max branches{' '}
                {!isSA && <span style={{ opacity: 0.5 }}>(only Super Admin can change)</span>}
              </span>
              <input
                type="number"
                min={1}
                max={20}
                value={form.maxBranches}
                onChange={(e) => f({ maxBranches: parseInt(e.target.value) || 1 })}
                disabled={!isSA}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '0.5px solid var(--col-border-2)',
                  background: isSA ? 'var(--col-bg-3)' : 'rgba(255,255,255,.02)',
                  color: 'var(--col-text)',
                  fontSize: 13,
                  outline: 'none',
                  opacity: isSA ? 1 : 0.6,
                }}
              />
            </label>
            <Flex gap={10} justify="flex-end" style={{ marginTop: 4 }}>
              <Btn variant="secondary" onClick={() => setModal(false)}>
                Cancel
              </Btn>
              <Btn onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Update owner' : 'Create owner'}
              </Btn>
            </Flex>
          </div>
        </Modal>
      )}

      {showReset && (
        <Modal
          title={`Reset password — ${showReset.business_name}`}
          onClose={() => setShowReset(null)}
          width={380}
        >
          <Input
            label="New password"
            type="password"
            value={newPwd}
            onChange={setNewPwd}
            placeholder="Min 6 characters"
          />
          <Flex gap={10} justify="flex-end" style={{ marginTop: 12 }}>
            <Btn variant="secondary" onClick={() => setShowReset(null)}>
              Cancel
            </Btn>
            <Btn onClick={resetPwd}>Reset password</Btn>
          </Flex>
        </Modal>
      )}

      {confirmDel && (
        <Modal title="Delete owner" onClose={() => setConfDel(null)} width={380}>
          <p style={{ fontSize: 13, color: 'var(--col-text-2)', marginBottom: 16 }}>
            Delete <strong style={{ color: 'var(--col-text)' }}>{confirmDel.business_name}</strong>?
            This will remove all branches and associated data.
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
    </>
  );
}

// ── Admins tab ────────────────────────────────────────────────────────────────
function AdminsTab() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfDel] = useState(null);
  const [showReset, setShowReset] = useState(null);
  const [newPwd, setNewPwd] = useState('');
  const f = (p) => setForm((prev) => ({ ...prev, ...p }));

  const load = async () => {
    try {
      const data = await platformApi.listAdmins();
      setAdmins(data || []);
    } catch {
      toast.error('Failed to load admins');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!form.username || !form.email) {
      toast.error('Username and email required');
      return;
    }
    if (!editing && !form.password) {
      toast.error('Password required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await platformApi.updateAdmin(editing.id, { username: form.username, email: form.email });
        toast.success('Admin updated');
      } else {
        await platformApi.createAdmin({
          username: form.username,
          email: form.email,
          password: form.password,
        });
        toast.success('Admin created');
      }
      await load();
      setModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div style={{ color: 'var(--col-text-2)', padding: '2rem', textAlign: 'center' }}>
        Loading admins…
      </div>
    );

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Btn
          onClick={() => {
            setEditing(null);
            setForm({ username: '', email: '', password: '' });
            setModal(true);
          }}
        >
          + Add admin
        </Btn>
      </div>
      <Card flush>
        {admins.length === 0 ? (
          <EmptyState icon="👤" title="No admins yet" />
        ) : (
          <Table
            columns={[
              {
                key: 'username',
                label: 'Username',
                render: (r) => <span style={{ fontWeight: 500 }}>{r.username}</span>,
              },
              {
                key: 'email',
                label: 'Email',
                render: (r) => (
                  <span style={{ fontSize: 12, color: 'var(--col-text-2)' }}>{r.email}</span>
                ),
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
                    <Btn
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(r);
                        setForm({ username: r.username, email: r.email, password: '' });
                        setModal(true);
                      }}
                    >
                      Edit
                    </Btn>
                    <Btn
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setShowReset(r);
                        setNewPwd('');
                      }}
                    >
                      Reset pwd
                    </Btn>
                    <Btn variant="danger" size="sm" onClick={() => setConfDel(r)}>
                      Del
                    </Btn>
                  </Flex>
                ),
              },
            ]}
            rows={admins}
          />
        )}
      </Card>
      {showModal && (
        <Modal
          title={editing ? 'Edit admin' : 'Add admin'}
          onClose={() => setModal(false)}
          width={400}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label="Username *" value={form.username} onChange={(v) => f({ username: v })} />
            <Input label="Email *" value={form.email} onChange={(v) => f({ email: v })} />
            {!editing && (
              <Input
                label="Password *"
                type="password"
                value={form.password}
                onChange={(v) => f({ password: v })}
              />
            )}
            <Flex gap={10} justify="flex-end">
              <Btn variant="secondary" onClick={() => setModal(false)}>
                Cancel
              </Btn>
              <Btn onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
              </Btn>
            </Flex>
          </div>
        </Modal>
      )}
      {showReset && (
        <Modal
          title={`Reset — ${showReset.username}`}
          onClose={() => setShowReset(null)}
          width={360}
        >
          <Input label="New password" type="password" value={newPwd} onChange={setNewPwd} />
          <Flex gap={10} justify="flex-end" style={{ marginTop: 12 }}>
            <Btn variant="secondary" onClick={() => setShowReset(null)}>
              Cancel
            </Btn>
            <Btn
              onClick={async () => {
                if (!newPwd || newPwd.length < 6) return toast.error('Min 6 chars');
                await platformApi.resetAdminPwd(showReset.id, { password: newPwd });
                toast.success('Password reset');
                setShowReset(null);
              }}
            >
              Reset
            </Btn>
          </Flex>
        </Modal>
      )}
      {confirmDel && (
        <Modal title="Delete admin" onClose={() => setConfDel(null)} width={360}>
          <p style={{ fontSize: 13, color: 'var(--col-text-2)', marginBottom: 16 }}>
            Delete <strong>{confirmDel.username}</strong>?
          </p>
          <Flex gap={10} justify="flex-end">
            <Btn variant="secondary" onClick={() => setConfDel(null)}>
              Cancel
            </Btn>
            <Btn
              variant="danger"
              onClick={async () => {
                await platformApi.deleteAdmin(confirmDel.id);
                await load();
                setConfDel(null);
                toast.success('Deleted');
              }}
            >
              Delete
            </Btn>
          </Flex>
        </Modal>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SHOP VIEW — Owner manages staff across their branches
// ════════════════════════════════════════════════════════════════════════════

const ROLE_OPTS = [
  { value: 'cashier', label: 'Cashier' },
  { value: 'manager', label: 'Manager' },
];
const ROLE_BADGE = { cashier: 'default', manager: 'teal', owner: 'purple' };
const blankStaff = { name: '', email: '', role: 'cashier', password: '', pin: '', branchId: '' };

function ShopUsers() {
  const { activeBranchId, branches } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState(activeBranchId || '');
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankStaff);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfDel] = useState(null);
  const [showReset, setShowReset] = useState(null);
  const [newPwd, setNewPwd] = useState('');
  const f = (p) => setForm((prev) => ({ ...prev, ...p }));

  useEffect(() => {
    if (activeBranchId && !selectedBranch) setSelectedBranch(activeBranchId);
  }, [activeBranchId]);

  useEffect(() => {
    if (!selectedBranch) return;
    setLoading(true);
    branchApi
      .listStaff(selectedBranch)
      .then((data) => setStaff((data || []).filter((s) => s.role !== 'owner')))
      .catch(() => toast.error('Failed to load staff'))
      .finally(() => setLoading(false));
  }, [selectedBranch]);

  const reload = () =>
    branchApi
      .listStaff(selectedBranch)
      .then((data) => setStaff((data || []).filter((s) => s.role !== 'owner')))
      .catch(() => {});

  const save = async () => {
    if (!form.name || !form.email) {
      toast.error('Name and email required');
      return;
    }
    if (!editing && !form.password) {
      toast.error('Password required');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await branchApi.updateStaff(editing.id, {
          name: form.name,
          email: form.email,
          isActive: true,
          branchId: form.branchId ? parseInt(form.branchId) : undefined,
        });
        toast.success('Staff updated');
      } else {
        await branchApi.createStaff(selectedBranch, {
          name: form.name,
          email: form.email,
          role: form.role,
          password: form.password,
          pin: form.pin || undefined,
        });
        toast.success(`${form.role} "${form.name}" added`);
      }
      await reload();
      setModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    try {
      await branchApi.deleteStaff(id);
      await reload();
      setConfDel(null);
      toast.success('Staff removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed — deactivate instead');
    }
  };

  const resetPwd = async () => {
    if (!newPwd || newPwd.length < 6) {
      toast.error('Min 6 characters');
      return;
    }
    try {
      await branchApi.resetPassword(showReset.id, { password: newPwd });
      toast.success('Password reset');
      setShowReset(null);
      setNewPwd('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const branchOpts = branches.map((b) => ({ value: String(b.id), label: b.shop_name || b.name }));
  const curBranch = branches.find((b) => b.id === parseInt(selectedBranch));

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader
        title="Users"
        action={
          <Btn
            onClick={() => {
              setEditing(null);
              setForm({ ...blankStaff, branchId: String(selectedBranch) });
              setModal(true);
            }}
          >
            + Add staff
          </Btn>
        }
      />

      {/* Branch selector for multi-branch owners */}
      {branches.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            background: 'rgba(0,180,216,.06)',
            borderRadius: 'var(--radius-md)',
            border: '0.5px solid rgba(0,180,216,.2)',
            fontSize: 12,
          }}
        >
          <span style={{ color: 'var(--col-teal)' }}>📍 Viewing branch:</span>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-md)',
              border: '0.5px solid var(--col-border-2)',
              background: 'var(--col-bg-3)',
              color: 'var(--col-text)',
              fontSize: 12,
            }}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.shop_name || b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <StatCard label="Total staff" value={staff.length} accent="var(--col-teal)" />
        <StatCard
          label="Active"
          value={staff.filter((s) => s.is_active).length}
          accent="var(--col-green)"
        />
        <StatCard
          label="Managers"
          value={staff.filter((s) => s.role === 'manager').length}
          accent="var(--col-accent)"
        />
      </div>

      {loading ? (
        <div style={{ color: 'var(--col-text-2)', textAlign: 'center', padding: '2rem' }}>
          Loading staff…
        </div>
      ) : (
        <Card flush>
          {staff.length === 0 ? (
            <EmptyState icon="👤" title="No staff yet" sub="Add your first cashier or manager" />
          ) : (
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
                        {r.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--col-text-3)' }}>
                          {r.email || '—'}
                        </div>
                      </div>
                    </Flex>
                  ),
                },
                {
                  key: 'role',
                  label: 'Role',
                  render: (r) => <Badge label={r.role} variant={ROLE_BADGE[r.role] || 'default'} />,
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
                      <Btn
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(r);
                          setForm({
                            name: r.name,
                            email: r.email,
                            role: r.role,
                            password: '',
                            pin: '',
                            branchId: String(r.branch_id || selectedBranch),
                          });
                          setModal(true);
                        }}
                      >
                        Edit
                      </Btn>
                      <Btn
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setShowReset(r);
                          setNewPwd('');
                        }}
                      >
                        Reset pwd
                      </Btn>
                      <Btn
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            await branchApi.updateStaff(r.id, { isActive: !r.is_active });
                            await reload();
                            toast.success(r.is_active ? 'Deactivated' : 'Activated');
                          } catch {
                            toast.error('Failed');
                          }
                        }}
                        style={{ color: r.is_active ? 'var(--col-amber)' : 'var(--col-green)' }}
                      >
                        {r.is_active ? 'Deactivate' : 'Activate'}
                      </Btn>
                      <Btn variant="danger" size="sm" onClick={() => setConfDel(r)}>
                        Del
                      </Btn>
                    </Flex>
                  ),
                },
              ]}
              rows={staff}
            />
          )}
        </Card>
      )}

      {showModal && (
        <Modal
          title={editing ? `Edit — ${editing.name}` : 'Add staff member'}
          onClose={() => setModal(false)}
          width={460}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input
              label="Full name *"
              value={form.name}
              onChange={(v) => f({ name: v })}
              placeholder="Kamal Perera"
            />
            <Input
              label="Email *"
              value={form.email}
              onChange={(v) => f({ email: v })}
              placeholder="kamal@emerald.lk"
            />
            {!editing && (
              <Select
                label="Role"
                value={form.role}
                onChange={(v) => f({ role: v })}
                options={ROLE_OPTS}
              />
            )}
            {!editing && (
              <>
                <Input
                  label="Password *"
                  type="password"
                  value={form.password}
                  onChange={(v) => f({ password: v })}
                  placeholder="Min 6 characters"
                />
                <Input
                  label="PIN (optional)"
                  type="password"
                  value={form.pin}
                  onChange={(v) => f({ pin: v })}
                  placeholder="4-digit PIN for POS counter"
                />
              </>
            )}
            {/* Branch reassignment for multi-branch owners when editing */}
            {editing && branches.length > 1 && (
              <Select
                label="Assign to branch"
                value={form.branchId}
                onChange={(v) => f({ branchId: v })}
                options={branchOpts}
              />
            )}
            <Flex gap={10} justify="flex-end" style={{ marginTop: 4 }}>
              <Btn variant="secondary" onClick={() => setModal(false)}>
                Cancel
              </Btn>
              <Btn onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Update' : 'Add staff'}
              </Btn>
            </Flex>
          </div>
        </Modal>
      )}

      {showReset && (
        <Modal title={`Reset — ${showReset.name}`} onClose={() => setShowReset(null)} width={380}>
          <Input
            label="New password"
            type="password"
            value={newPwd}
            onChange={setNewPwd}
            placeholder="Min 6 characters"
          />
          <Flex gap={10} justify="flex-end" style={{ marginTop: 12 }}>
            <Btn variant="secondary" onClick={() => setShowReset(null)}>
              Cancel
            </Btn>
            <Btn onClick={resetPwd}>Reset password</Btn>
          </Flex>
        </Modal>
      )}

      {confirmDel && (
        <Modal title="Remove staff" onClose={() => setConfDel(null)} width={380}>
          <p style={{ fontSize: 13, color: 'var(--col-text-2)', marginBottom: 16 }}>
            Remove <strong style={{ color: 'var(--col-text)' }}>{confirmDel.name}</strong>? This
            will fail if they have transaction history — deactivate instead.
          </p>
          <Flex gap={10} justify="flex-end">
            <Btn variant="secondary" onClick={() => setConfDel(null)}>
              Cancel
            </Btn>
            <Btn variant="danger" onClick={() => del(confirmDel.id)}>
              Remove
            </Btn>
          </Flex>
        </Modal>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ENTRY POINT — picks the right view based on role/layer
// ════════════════════════════════════════════════════════════════════════════
export default function Users() {
  const { user, isPlatform } = useAuth();
  if (!user) return null;
  // Platform users (super_admin, admin) see Owner/Admin management
  // Owner (shop layer) sees their staff
  if (isPlatform) return <PlatformUsers />;
  return <ShopUsers />;
}
