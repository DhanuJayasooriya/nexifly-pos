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
  Divider,
} from '../ui';
import { useAuth } from '../../context/AuthContext';
import { branchApi, productApi } from '../../api';

// ─── tiny section heading ─────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--col-text-2)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        paddingBottom: 10,
        borderBottom: '0.5px solid var(--col-border)',
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

// ─── tab pill ─────────────────────────────────────────────────────────────────
function TabPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 16px',
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

const DEVICE_TYPES = [
  { value: 'bill_printer', label: 'Bill printer' },
  { value: 'barcode_printer', label: 'Barcode printer (Zebra GT800)' },
  { value: 'cash_drawer', label: 'Cash drawer' },
];

const blankBranch = { name: '', address: '', phone: '' };

// ─────────────────────────────────────────────────────────────────────────────
export default function Settings() {
  const { user } = useAuth();
  const { activeBranchId: branchId, branchSettings, switchBranch } = useAuth();

  // ── active tab ───────────────────────────────────────────────────────────
  const [tab, setTab] = useState('business'); // business | devices | branches | catalogue

  // ── business settings ────────────────────────────────────────────────────
  const [settings, setSettings] = useState({
    shopName: '',
    shopAddress: '',
    shopContact: '',
    shopContact2: '',
    logoUrl: '',
    purchaseBillNote: '',
    rentalBillNote: '',
  });
  const [loadingS, setLoadingS] = useState(true);
  const [savingS, setSavingS] = useState(false);

  // ── devices ──────────────────────────────────────────────────────────────
  const [devices, setDevices] = useState([]);
  const [deviceForm, setDeviceForm] = useState({
    deviceType: 'bill_printer',
    deviceName: '',
    connectionString: '',
  });
  const [savingD, setSavingD] = useState(false);

  // ── branches ─────────────────────────────────────────────────────────────
  const [branches, setBranches] = useState([]);
  const [loadingB, setLoadingB] = useState(true);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [branchForm, setBranchForm] = useState(blankBranch);
  const [savingB, setSavingB] = useState(false);
  const [confirmDelB, setConfirmDelB] = useState(null);

  // ── catalogue ─────────────────────────────────────────────────────────────
  const [brands, setBrands] = useState([]);
  const [cats, setCats] = useState([]);
  const [attrTypes, setAttrTypes] = useState([]); // [{id, name, values:[]}]
  const [loadingCat, setLoadingCat] = useState(false);

  // brand modal
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [brandName, setBrandName] = useState('');
  const [savingBrand, setSavingBrand] = useState(false);
  const [confirmDelBrand, setConfirmDelBrand] = useState(null);

  // category modal
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', parentId: '' });
  const [savingCat, setSavingCat] = useState(false);
  const [confirmDelCat, setConfirmDelCat] = useState(null);

  // attribute modal (add value to a type)
  const [showAttrModal, setShowAttrModal] = useState(false);
  const [attrTypeName, setAttrTypeName] = useState(''); // new type name
  const [selectedType, setSelectedType] = useState(null); // type obj for adding value
  const [newAttrValue, setNewAttrValue] = useState('');
  const [savingAttr, setSavingAttr] = useState(false);
  const [confirmDelVal, setConfirmDelVal] = useState(null);

  const sf = (p) => setSettings((prev) => ({ ...prev, ...p }));
  const df = (p) => setDeviceForm((prev) => ({ ...prev, ...p }));
  const bf = (p) => setBranchForm((prev) => ({ ...prev, ...p }));

  // ── load on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!branchId) {
      setLoadingS(false);
      setLoadingB(false);
      return;
    }
    // Reset settings when branch switches
    setLoadingS(true);
    setDevices([]);

    branchApi
      .get(branchId)
      .then((data) =>
        setSettings({
          shopName: data.shop_name || data.name || '',
          shopAddress: data.shop_address || data.address || '',
          shopContact: data.shop_contact || data.phone || '',
          shopContact2: data.shop_contact2 || '',
          logoUrl: localStorage.getItem('nxf_bill_logo') || data.logo_url || '',
          purchaseBillNote: data.purchase_bill_note || '',
          rentalBillNote: data.rental_bill_note || '',
        }),
      )
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoadingS(false));

    branchApi
      .listDevices(branchId)
      .then((d) => setDevices(Array.isArray(d) ? d : d?.items || d?.rows || []))
      .catch(() => {});

    branchApi
      .list()
      .then((d) => setBranches(Array.isArray(d) ? d : d?.items || d?.rows || []))
      .catch(() => toast.error('Failed to load branches'))
      .finally(() => setLoadingB(false));
  }, [branchId]);

  // load catalogue when that tab is opened
  useEffect(() => {
    if (tab !== 'catalogue' || !branchId) return;
    loadCatalogue();
  }, [tab, branchId]); // re-run when branch switches

  const loadCatalogue = async () => {
    setLoadingCat(true);
    try {
      const [b, c, at] = await Promise.all([
        productApi.listBrands(branchId),
        productApi.listCategories(branchId),
        productApi.listAttrTypes(branchId),
      ]);
      setBrands(Array.isArray(b) ? b : b?.items || b?.rows || []);
      setCats(Array.isArray(c) ? c : c?.items || c?.rows || []);
      setAttrTypes(Array.isArray(at) ? at : at?.items || at?.rows || []);
    } catch {
      toast.error('Failed to load catalogue data');
    } finally {
      setLoadingCat(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // BUSINESS SETTINGS
  // ─────────────────────────────────────────────────────────────────────────
  const saveSettings = async () => {
    setSavingS(true);
    try {
      await branchApi.updateSettings(branchId, {
        shopName: settings.shopName,
        shopAddress: settings.shopAddress,
        shopContact: settings.shopContact,
        shopContact2: settings.shopContact2,
        purchaseBillNote: settings.purchaseBillNote,
        rentalBillNote: settings.rentalBillNote,
      });
      // Refresh branchSettings in context so Topbar updates immediately
      await switchBranch(branchId);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSavingS(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DEVICES
  // ─────────────────────────────────────────────────────────────────────────
  const saveDevice = async () => {
    if (!deviceForm.deviceName.trim()) {
      toast.error('Device name is required');
      return;
    }
    setSavingD(true);
    try {
      const saved = await branchApi.upsertDevice(branchId, {
        deviceType: deviceForm.deviceType,
        deviceName: deviceForm.deviceName,
        connectionString: deviceForm.connectionString,
      });
      setDevices((prev) => {
        const idx = prev.findIndex((d) => d.device_type === saved.device_type);
        return idx >= 0 ? prev.map((d, i) => (i === idx ? saved : d)) : [...prev, saved];
      });
      toast.success('Device configured');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSavingD(false);
    }
  };

  const handleDeviceTypeChange = (v) => {
    const existing = devices.find((d) => d.device_type === v);
    df({
      deviceType: v,
      deviceName: existing?.device_name || '',
      connectionString: existing?.connection_string || '',
    });
  };

  useEffect(() => {
    if (devices.length > 0) {
      const bp = devices.find((d) => d.device_type === 'bill_printer');
      if (bp)
        df({ deviceName: bp.device_name || '', connectionString: bp.connection_string || '' });
    }
  }, [devices]);

  // ─────────────────────────────────────────────────────────────────────────
  // BRANCHES
  // ─────────────────────────────────────────────────────────────────────────
  const openAddBranch = () => {
    setEditingBranch(null);
    setBranchForm(blankBranch);
    setShowBranchModal(true);
  };
  const openEditBranch = (b) => {
    setEditingBranch(b);
    setBranchForm({ name: b.name || '', address: b.address || '', phone: b.phone || '' });
    setShowBranchModal(true);
  };

  const saveBranch = async () => {
    if (!branchForm.name.trim()) {
      toast.error('Branch name is required');
      return;
    }
    setSavingB(true);
    try {
      if (editingBranch) {
        await branchApi.update(editingBranch.id, branchForm);
        setBranches((prev) =>
          prev.map((b) => (b.id === editingBranch.id ? { ...b, ...branchForm } : b)),
        );
        toast.success('Branch updated');
      } else {
        const created = await branchApi.create(branchForm);
        setBranches((prev) => [...prev, created]);
        toast.success('Branch created');
      }
      setShowBranchModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSavingB(false);
    }
  };

  const deleteBranch = async (id) => {
    try {
      await branchApi.delete(id);
      setBranches((prev) => prev.filter((b) => b.id !== id));
      setConfirmDelB(null);
      toast.success('Branch deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot delete — branch has active data');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CATALOGUE — BRANDS
  // ─────────────────────────────────────────────────────────────────────────
  const openAddBrand = () => {
    setEditingBrand(null);
    setBrandName('');
    setShowBrandModal(true);
  };
  const openEditBrand = (b) => {
    setEditingBrand(b);
    setBrandName(b.name);
    setShowBrandModal(true);
  };

  const saveBrand = async () => {
    if (!brandName.trim()) {
      toast.error('Brand name is required');
      return;
    }
    setSavingBrand(true);
    try {
      if (editingBrand) {
        const updated = await productApi.updateBrand(editingBrand.id, { name: brandName });
        setBrands((prev) =>
          prev.map((b) => (b.id === editingBrand.id ? { ...b, ...updated, name: brandName } : b)),
        );
        toast.success('Brand updated');
      } else {
        const created = await productApi.createBrand(branchId, brandName);
        const freshB = await productApi.listBrands(branchId);
        setBrands(Array.isArray(freshB) ? freshB : freshB?.items || freshB?.rows || []);
        toast.success('Brand added');
      }
      setShowBrandModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSavingBrand(false);
    }
  };

  const deleteBrand = async (id) => {
    try {
      await productApi.deleteBrand(id);
      setBrands((prev) => prev.filter((b) => b.id !== id));
      setConfirmDelBrand(null);
      toast.success('Brand deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot delete — brand has products');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CATALOGUE — CATEGORIES
  // ─────────────────────────────────────────────────────────────────────────
  const openAddCat = () => {
    setEditingCat(null);
    setCatForm({ name: '', parentId: '' });
    setShowCatModal(true);
  };
  const openEditCat = (c) => {
    setEditingCat(c);
    setCatForm({ name: c.name || '', parentId: String(c.parent_id || '') });
    setShowCatModal(true);
  };

  const saveCat = async () => {
    if (!catForm.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    setSavingCat(true);
    try {
      if (editingCat) {
        const updated = await productApi.updateCategory(editingCat.id, {
          name: catForm.name,
          parentId: catForm.parentId || null,
        });
        setCats((prev) =>
          prev.map((c) => (c.id === editingCat.id ? { ...c, ...updated, name: catForm.name } : c)),
        );
        toast.success('Category updated');
      } else {
        const created = await productApi.createCategory(branchId, {
          name: catForm.name,
          parentId: catForm.parentId || null,
        });
        // reload full list to get parent_name resolved
        const fresh = await productApi.listCategories(branchId);
        setCats(Array.isArray(fresh) ? fresh : fresh?.items || fresh?.rows || []);
        toast.success('Category added');
      }
      setShowCatModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSavingCat(false);
    }
  };

  const deleteCat = async (id) => {
    try {
      await productApi.deleteCategory(id);
      setCats((prev) => prev.filter((c) => c.id !== id));
      setConfirmDelCat(null);
      toast.success('Category deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot delete — category has products');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CATALOGUE — ATTRIBUTE TYPES + VALUES (Sizes, Colors, Materials, etc.)
  // ─────────────────────────────────────────────────────────────────────────

  // Add a new attribute TYPE (e.g. "Pattern", "Fit")
  const addAttrType = async () => {
    if (!attrTypeName.trim()) {
      toast.error('Type name is required');
      return;
    }
    setSavingAttr(true);
    try {
      const created = await productApi.createAttrType(branchId, attrTypeName.trim());
      setAttrTypes((prev) => [...prev, { ...created, values: [] }]);
      setAttrTypeName('');
      toast.success(`Attribute type "${attrTypeName}" added`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add type');
    } finally {
      setSavingAttr(false);
    }
  };

  // Open modal to add a VALUE to an existing type
  const openAddValue = (type) => {
    setSelectedType(type);
    setNewAttrValue('');
    setShowAttrModal(true);
  };

  // Save new value
  const saveAttrValue = async () => {
    if (!newAttrValue.trim()) {
      toast.error('Value is required');
      return;
    }
    setSavingAttr(true);
    try {
      const created = await productApi.createAttrValue(selectedType.id, {
        value: newAttrValue.trim(),
        displayLabel: newAttrValue.trim(),
      });
      setAttrTypes((prev) =>
        prev.map((t) =>
          t.id === selectedType.id ? { ...t, values: [...(t.values || []), created] } : t,
        ),
      );
      setNewAttrValue('');
      toast.success(`"${newAttrValue}" added to ${selectedType.name}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add value');
    } finally {
      setSavingAttr(false);
    }
  };

  // Delete a value
  const deleteAttrValue = async (typeId, valueId) => {
    try {
      await productApi.deleteAttrValue(valueId);
      setAttrTypes((prev) =>
        prev.map((t) =>
          t.id === typeId ? { ...t, values: (t.values || []).filter((v) => v.id !== valueId) } : t,
        ),
      );
      setConfirmDelVal(null);
      toast.success('Value removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot delete — value may be in use');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  if (loadingS)
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
        Loading settings…
      </div>
    );

  const catOpts = [
    { value: '', label: 'No parent (top level)' },
    ...cats.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SectionHeader title="Settings" />

      {/* ── Tab navigation ────────────────────────────────────────────────── */}
      <Flex gap={6} wrap>
        {[
          { key: 'business', label: '🏪 Business' },
          { key: 'devices', label: '🖨 Devices' },
          { key: 'branches', label: '📍 Branches' },
          { key: 'catalogue', label: '📚 Catalogue' },
        ].map((t) => (
          <TabPill
            key={t.key}
            label={t.label}
            active={tab === t.key}
            onClick={() => setTab(t.key)}
          />
        ))}
      </Flex>

      {/* ════════════════════════════════════════════════════════════════════
          TAB: BUSINESS
      ════════════════════════════════════════════════════════════════════ */}
      {tab === 'business' && (
        <Card>
          <SectionTitle>Business information</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input
                label="Shop / business name"
                value={settings.shopName}
                onChange={(v) => sf({ shopName: v })}
                placeholder="e.g. Emerald Kandy"
              />
              <Input
                label="Contact number"
                value={settings.shopContact}
                onChange={(v) => sf({ shopContact: v })}
                placeholder="081 234 5678"
              />
              <Input
                label="Contact number 2 (optional)"
                value={settings.shopContact2 || ''}
                onChange={(v) => sf({ shopContact2: v })}
                placeholder="077 123 4567"
              />
            </div>
            <Input
              label="Address"
              value={settings.shopAddress}
              onChange={(v) => sf({ shopAddress: v })}
              placeholder="123 Main Street, Kandy"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: 'var(--col-text-2)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Business logo
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {settings.logoUrl && (
                  <img
                    src={settings.logoUrl}
                    alt="logo"
                    style={{
                      height: 52,
                      maxWidth: 120,
                      borderRadius: 8,
                      border: '0.5px solid var(--col-border)',
                      objectFit: 'contain',
                      background: '#fff',
                      padding: 4,
                    }}
                    onError={(e) => (e.target.style.display = 'none')}
                  />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255,255,255,.08)',
                      border: '0.5px solid var(--col-border-2)',
                      cursor: 'pointer',
                      fontSize: 12,
                      color: 'var(--col-text-2)',
                      fontWeight: 500,
                    }}
                  >
                    📁 Choose image
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        if (file.size > 500 * 1024) {
                          toast.error('Image must be under 500 KB');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          sf({ logoUrl: ev.target.result });
                          localStorage.setItem('nxf_bill_logo', ev.target.result);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {settings.logoUrl && (
                    <button
                      onClick={() => {
                        sf({ logoUrl: '' });
                        localStorage.removeItem('nxf_bill_logo');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 11,
                        color: 'var(--col-red)',
                        textAlign: 'left',
                        padding: 0,
                      }}
                    >
                      × Remove logo
                    </button>
                  )}
                  <span style={{ fontSize: 10, color: 'var(--col-text-3)' }}>
                    PNG, JPG — max 500 KB. Stored locally on this device.
                  </span>
                </div>
              </div>
            </div>
            <Divider />
            <SectionTitle>Bill footer notes</SectionTitle>
            <Input
              label="Purchase bill note"
              value={settings.purchaseBillNote}
              onChange={(v) => sf({ purchaseBillNote: v })}
              placeholder="Goods are exchangeable within 7 days of Purchase"
            />
            <Input
              label="Rental bill note"
              value={settings.rentalBillNote}
              onChange={(v) => sf({ rentalBillNote: v })}
              placeholder="Extra amount of Rs 500 is added on late returns."
            />
            <Flex justify="flex-end">
              <Btn onClick={saveSettings} disabled={savingS}>
                {savingS ? 'Saving…' : 'Save settings'}
              </Btn>
            </Flex>
          </div>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB: DEVICES
      ════════════════════════════════════════════════════════════════════ */}
      {tab === 'devices' && (
        <Card>
          <SectionTitle>Device configuration</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(0,180,216,.06)',
                border: '0.5px solid rgba(0,180,216,.2)',
                fontSize: 12,
                color: 'var(--col-teal)',
              }}
            >
              ℹ Enter the IP:port of your printer on the local network (e.g.{' '}
              <code style={{ fontFamily: 'var(--font-mono)' }}>192.168.1.100:9100</code>)
            </div>

            {devices.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--col-text-3)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    fontWeight: 500,
                  }}
                >
                  Currently configured
                </div>
                {devices.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(6,214,160,.06)',
                      border: '0.5px solid rgba(6,214,160,.2)',
                    }}
                  >
                    <Badge label={d.device_type.replace(/_/g, ' ')} variant="green" size="sm" />
                    <span style={{ fontWeight: 500 }}>{d.device_name}</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--col-text-3)',
                      }}
                    >
                      {d.connection_string || '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Select
                label="Device type"
                value={deviceForm.deviceType}
                onChange={handleDeviceTypeChange}
                options={DEVICE_TYPES}
              />
              <Input
                label="Device name"
                value={deviceForm.deviceName}
                onChange={(v) => df({ deviceName: v })}
                placeholder="e.g. Epson TM-T88, Zebra GT800"
              />
            </div>
            <Input
              label="Connection string (IP:port or USB path)"
              value={deviceForm.connectionString}
              onChange={(v) => df({ connectionString: v })}
              placeholder="192.168.1.105:9100"
              mono
            />
            <Flex justify="flex-end">
              <Btn onClick={saveDevice} disabled={savingD}>
                {savingD ? 'Saving…' : 'Configure device'}
              </Btn>
            </Flex>
          </div>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB: BRANCHES
      ════════════════════════════════════════════════════════════════════ */}
      {tab === 'branches' && (
        <Card>
          <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
            <SectionTitle>Branches</SectionTitle>
            <Btn
              size="sm"
              onClick={openAddBranch}
              disabled={user && branches.length >= (user.maxBranches || 1)}
              style={{ opacity: user && branches.length >= (user.maxBranches || 1) ? 0.45 : 1 }}
              title={
                user && branches.length >= (user.maxBranches || 1)
                  ? `Branch limit of ${user.maxBranches || 1} reached`
                  : 'Add new branch'
              }
            >
              + Add branch
            </Btn>
          </Flex>
          {loadingB ? (
            <div
              style={{
                textAlign: 'center',
                padding: '1.5rem',
                color: 'var(--col-text-3)',
                fontSize: 13,
              }}
            >
              Loading…
            </div>
          ) : branches.length === 0 ? (
            <EmptyState icon="🏪" title="No branches" sub="Add your first branch" />
          ) : (
            <Table
              columns={[
                {
                  key: 'name',
                  label: 'Name',
                  render: (r) => (
                    <div>
                      <div style={{ fontWeight: 500 }}>{r.name}</div>
                      {r.id === branchId && <Badge label="Current" variant="teal" size="sm" />}
                    </div>
                  ),
                },
                { key: 'address', label: 'Address', render: (r) => r.address || '—' },
                { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
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
                      <Btn variant="ghost" size="sm" onClick={() => openEditBranch(r)}>
                        Edit
                      </Btn>
                      {r.id !== branchId && (
                        <Btn variant="danger" size="sm" onClick={() => setConfirmDelB(r)}>
                          Del
                        </Btn>
                      )}
                    </Flex>
                  ),
                },
              ]}
              rows={branches}
            />
          )}
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB: CATALOGUE
      ════════════════════════════════════════════════════════════════════ */}
      {tab === 'catalogue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loadingCat && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--col-text-3)' }}>
              Loading catalogue…
            </div>
          )}

          {!loadingCat && (
            <>
              {/* ── BRANDS ─────────────────────────────────────────────────── */}
              <Card>
                <Flex justify="space-between" align="center" style={{ marginBottom: 14 }}>
                  <SectionTitle>Brands</SectionTitle>
                  <Btn size="sm" onClick={openAddBrand}>
                    + Add brand
                  </Btn>
                </Flex>
                {brands.length === 0 ? (
                  <EmptyState icon="🏷️" title="No brands yet" sub="Add your first brand" />
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {brands.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 10px',
                          borderRadius: 'var(--radius-md)',
                          background: 'rgba(255,255,255,.05)',
                          border: '0.5px solid var(--col-border)',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{b.name}</span>
                        <button
                          onClick={() => openEditBrand(b)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--col-text-3)',
                            fontSize: 11,
                            padding: '0 2px',
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => setConfirmDelBrand(b)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--col-red)',
                            fontSize: 11,
                            padding: '0 2px',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* ── CATEGORIES ──────────────────────────────────────────────── */}
              <Card>
                <Flex justify="space-between" align="center" style={{ marginBottom: 14 }}>
                  <SectionTitle>Categories</SectionTitle>
                  <Btn size="sm" onClick={openAddCat}>
                    + Add category
                  </Btn>
                </Flex>
                {cats.length === 0 ? (
                  <EmptyState
                    icon="📂"
                    title="No categories yet"
                    sub="e.g. Shirts, Jeans, Fabric"
                  />
                ) : (
                  <Table
                    columns={[
                      {
                        key: 'name',
                        label: 'Category',
                        render: (r) => <span style={{ fontWeight: 500 }}>{r.name}</span>,
                      },
                      {
                        key: 'parent_name',
                        label: 'Parent',
                        render: (r) =>
                          r.parent_name || (
                            <span style={{ color: 'var(--col-text-3)' }}>Top level</span>
                          ),
                      },
                      {
                        key: 'actions',
                        label: '',
                        render: (r) => (
                          <Flex gap={6}>
                            <Btn variant="ghost" size="sm" onClick={() => openEditCat(r)}>
                              Edit
                            </Btn>
                            <Btn variant="danger" size="sm" onClick={() => setConfirmDelCat(r)}>
                              Del
                            </Btn>
                          </Flex>
                        ),
                      },
                    ]}
                    rows={cats}
                  />
                )}
              </Card>

              {/* ── ATTRIBUTE TYPES + VALUES ─────────────────────────────────── */}
              <Card>
                <Flex justify="space-between" align="center" style={{ marginBottom: 14 }}>
                  <SectionTitle>Attribute types & values</SectionTitle>
                </Flex>

                <div style={{ fontSize: 12, color: 'var(--col-text-2)', marginBottom: 14 }}>
                  These are the properties used to describe variants — Size, Color, Material, Style,
                  Pattern, etc. Add new types below, then add values inside each type.
                </div>

                {/* Add new type */}
                <Flex gap={8} style={{ marginBottom: 20 }}>
                  <input
                    value={attrTypeName}
                    onChange={(e) => setAttrTypeName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addAttrType()}
                    placeholder="New attribute type — e.g. Pattern, Occasion, Season"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '0.5px solid var(--col-border-2)',
                      background: 'var(--col-bg-3)',
                      color: 'var(--col-text)',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                  <Btn onClick={addAttrType} disabled={savingAttr} variant="secondary">
                    + Add type
                  </Btn>
                </Flex>

                {/* Existing types */}
                {attrTypes.length === 0 ? (
                  <EmptyState
                    icon="🏷"
                    title="No attribute types yet"
                    sub="Add types above — the system will pre-create Size, Color, Material, Style on first product save"
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {attrTypes.map((type) => (
                      <div
                        key={type.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-md)',
                          background: 'rgba(255,255,255,.03)',
                          border: '0.5px solid var(--col-border)',
                        }}
                      >
                        <Flex justify="space-between" align="center" style={{ marginBottom: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--col-text)' }}>
                            {type.name}
                          </span>
                          <Btn size="sm" variant="secondary" onClick={() => openAddValue(type)}>
                            + Add value
                          </Btn>
                        </Flex>

                        {/* Values */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(type.values || []).length === 0 ? (
                            <span style={{ fontSize: 12, color: 'var(--col-text-3)' }}>
                              No values yet — click "+ Add value" to add
                            </span>
                          ) : (
                            (type.values || []).map((v) => (
                              <div
                                key={v.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '3px 10px',
                                  borderRadius: 20,
                                  background: 'rgba(0,180,216,.1)',
                                  border: '0.5px solid rgba(0,180,216,.2)',
                                }}
                              >
                                <span style={{ fontSize: 12, color: 'var(--col-teal)' }}>
                                  {v.value || v.display_label}
                                </span>
                                <button
                                  onClick={() => setConfirmDelVal({ typeId: type.id, value: v })}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--col-red)',
                                    fontSize: 12,
                                    lineHeight: 1,
                                    padding: '0 2px',
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════ */}

      {/* Branch add/edit */}
      {showBranchModal && (
        <Modal
          title={editingBranch ? 'Edit branch' : 'Add branch'}
          onClose={() => setShowBranchModal(false)}
          width={420}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input
              label="Branch name *"
              value={branchForm.name}
              onChange={(v) => bf({ name: v })}
              placeholder="e.g. Emerald Colombo"
            />
            <Input
              label="Address"
              value={branchForm.address}
              onChange={(v) => bf({ address: v })}
              placeholder="Street, City"
            />
            <Input
              label="Phone"
              value={branchForm.phone}
              onChange={(v) => bf({ phone: v })}
              placeholder="011 234 5678"
            />
            <Flex gap={10} justify="flex-end">
              <Btn variant="secondary" onClick={() => setShowBranchModal(false)}>
                Cancel
              </Btn>
              <Btn onClick={saveBranch} disabled={savingB}>
                {savingB ? 'Saving…' : editingBranch ? 'Update' : 'Add branch'}
              </Btn>
            </Flex>
          </div>
        </Modal>
      )}

      {/* Delete branch */}
      {confirmDelB && (
        <Modal title="Delete branch" onClose={() => setConfirmDelB(null)} width={360}>
          <p style={{ fontSize: 13, color: 'var(--col-text-2)', marginBottom: 16 }}>
            Delete <strong style={{ color: 'var(--col-text)' }}>{confirmDelB.name}</strong>? This
            will fail if the branch has products or sales.
          </p>
          <Flex gap={10} justify="flex-end">
            <Btn variant="secondary" onClick={() => setConfirmDelB(null)}>
              Cancel
            </Btn>
            <Btn variant="danger" onClick={() => deleteBranch(confirmDelB.id)}>
              Delete
            </Btn>
          </Flex>
        </Modal>
      )}

      {/* Brand add/edit */}
      {showBrandModal && (
        <Modal
          title={editingBrand ? 'Edit brand' : 'Add brand'}
          onClose={() => setShowBrandModal(false)}
          width={360}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input
              label="Brand name *"
              value={brandName}
              onChange={setBrandName}
              placeholder="e.g. Vantage, Ebony, Emerald"
            />
            <Flex gap={10} justify="flex-end">
              <Btn variant="secondary" onClick={() => setShowBrandModal(false)}>
                Cancel
              </Btn>
              <Btn onClick={saveBrand} disabled={savingBrand}>
                {savingBrand ? 'Saving…' : editingBrand ? 'Update' : 'Add brand'}
              </Btn>
            </Flex>
          </div>
        </Modal>
      )}

      {/* Delete brand */}
      {confirmDelBrand && (
        <Modal title="Delete brand" onClose={() => setConfirmDelBrand(null)} width={360}>
          <p style={{ fontSize: 13, color: 'var(--col-text-2)', marginBottom: 16 }}>
            Delete brand{' '}
            <strong style={{ color: 'var(--col-text)' }}>{confirmDelBrand.name}</strong>?
          </p>
          <Flex gap={10} justify="flex-end">
            <Btn variant="secondary" onClick={() => setConfirmDelBrand(null)}>
              Cancel
            </Btn>
            <Btn variant="danger" onClick={() => deleteBrand(confirmDelBrand.id)}>
              Delete
            </Btn>
          </Flex>
        </Modal>
      )}

      {/* Category add/edit */}
      {showCatModal && (
        <Modal
          title={editingCat ? 'Edit category' : 'Add category'}
          onClose={() => setShowCatModal(false)}
          width={380}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input
              label="Category name *"
              value={catForm.name}
              onChange={(v) => setCatForm((p) => ({ ...p, name: v }))}
              placeholder="e.g. Shirts, Jeans, Fabric"
            />
            <Select
              label="Parent category (optional)"
              value={catForm.parentId}
              onChange={(v) => setCatForm((p) => ({ ...p, parentId: v }))}
              options={catOpts}
            />
            <Flex gap={10} justify="flex-end">
              <Btn variant="secondary" onClick={() => setShowCatModal(false)}>
                Cancel
              </Btn>
              <Btn onClick={saveCat} disabled={savingCat}>
                {savingCat ? 'Saving…' : editingCat ? 'Update' : 'Add category'}
              </Btn>
            </Flex>
          </div>
        </Modal>
      )}

      {/* Delete category */}
      {confirmDelCat && (
        <Modal title="Delete category" onClose={() => setConfirmDelCat(null)} width={360}>
          <p style={{ fontSize: 13, color: 'var(--col-text-2)', marginBottom: 16 }}>
            Delete category{' '}
            <strong style={{ color: 'var(--col-text)' }}>{confirmDelCat.name}</strong>?
          </p>
          <Flex gap={10} justify="flex-end">
            <Btn variant="secondary" onClick={() => setConfirmDelCat(null)}>
              Cancel
            </Btn>
            <Btn variant="danger" onClick={() => deleteCat(confirmDelCat.id)}>
              Delete
            </Btn>
          </Flex>
        </Modal>
      )}

      {/* Add attribute VALUE */}
      {showAttrModal && selectedType && (
        <Modal
          title={`Add value to "${selectedType.name}"`}
          onClose={() => setShowAttrModal(false)}
          width={360}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
              {(selectedType.values || []).map((v) => (
                <span
                  key={v.id}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 20,
                    background: 'rgba(0,180,216,.1)',
                    color: 'var(--col-teal)',
                    fontSize: 11,
                  }}
                >
                  {v.value || v.display_label}
                </span>
              ))}
            </div>
            <Input
              label={`New ${selectedType.name} value`}
              value={newAttrValue}
              onChange={setNewAttrValue}
              placeholder={
                selectedType.name.toLowerCase() === 'size'
                  ? 'e.g. 38W, XXL, Collar 18"'
                  : selectedType.name.toLowerCase() === 'color'
                    ? 'e.g. Emerald Green'
                    : selectedType.name.toLowerCase() === 'material'
                      ? 'e.g. Bamboo, Twill'
                      : selectedType.name.toLowerCase() === 'style'
                        ? 'e.g. Oversized Fit'
                        : 'Enter value'
              }
            />
            <Flex gap={10} justify="flex-end">
              <Btn variant="secondary" onClick={() => setShowAttrModal(false)}>
                Done
              </Btn>
              <Btn onClick={saveAttrValue} disabled={savingAttr}>
                {savingAttr ? 'Adding…' : `Add to ${selectedType.name}`}
              </Btn>
            </Flex>
          </div>
        </Modal>
      )}

      {/* Delete attribute value */}
      {confirmDelVal && (
        <Modal title="Remove value" onClose={() => setConfirmDelVal(null)} width={360}>
          <p style={{ fontSize: 13, color: 'var(--col-text-2)', marginBottom: 16 }}>
            Remove{' '}
            <strong style={{ color: 'var(--col-text)' }}>
              {confirmDelVal.value?.value || confirmDelVal.value?.display_label}
            </strong>
            ? This will fail if the value is linked to existing product variants.
          </p>
          <Flex gap={10} justify="flex-end">
            <Btn variant="secondary" onClick={() => setConfirmDelVal(null)}>
              Cancel
            </Btn>
            <Btn
              variant="danger"
              onClick={() => deleteAttrValue(confirmDelVal.typeId, confirmDelVal.value.id)}
            >
              Remove
            </Btn>
          </Flex>
        </Modal>
      )}
    </div>
  );
}
