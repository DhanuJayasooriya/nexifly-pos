import React, { useState, useEffect, useCallback } from 'react';
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
import { grnApi, productApi } from '../../api';

// ─── tiny inline label wrapper ───────────────────────────────────────────────
function FieldLabel({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: 'var(--col-text-2)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

// ─── inline select ───────────────────────────────────────────────────────────
function InlineSelect({ value, onChange, options, placeholder, disabled }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '7px 10px',
        borderRadius: 'var(--radius-md)',
        border: '0.5px solid var(--col-border-2)',
        background: disabled ? 'rgba(255,255,255,.03)' : 'var(--col-bg-3)',
        color: 'var(--col-text)',
        fontSize: 12,
        outline: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── inline number input ─────────────────────────────────────────────────────
function InlineNumber({ value, onChange, placeholder, min = 0 }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '7px 10px',
        borderRadius: 'var(--radius-md)',
        border: '0.5px solid var(--col-border-2)',
        background: 'var(--col-bg-3)',
        color: 'var(--col-text)',
        fontSize: 12,
        outline: 'none',
      }}
    />
  );
}

// ─── blank line item ─────────────────────────────────────────────────────────
const blankItem = () => ({
  _id: Math.random().toString(36).slice(2),
  productId: '',
  variantId: '',
  qty: '',
  unitCost: '',
  sellPrice: '',
  isRental: false,
  isFabric: false,
  fabricRolls: '',
  fabricMetersPerRoll: '',
  variants: [],
  loadingV: false,
});

// ─── EAN-13 SVG renderer (no external library) ───────────────────────────────
function ean13SVG(code) {
  const L = [
    '0001101',
    '0011001',
    '0010011',
    '0111101',
    '0100011',
    '0110001',
    '0101111',
    '0111011',
    '0110111',
    '0001011',
  ];
  const G = [
    '0100111',
    '0110011',
    '0011011',
    '0100001',
    '0011101',
    '0111001',
    '0000101',
    '0010001',
    '0001001',
    '0010111',
  ];
  const R = [
    '1110010',
    '1100110',
    '1101100',
    '1000010',
    '1011100',
    '1001110',
    '1010000',
    '1000100',
    '1001000',
    '1110100',
  ];
  const firstDigitEnc = [
    'LLLLLL',
    'LLGLGG',
    'LLGGLG',
    'LLGGGL',
    'LGLLGG',
    'LGGLLG',
    'LGGGLL',
    'LGLGLG',
    'LGLGGL',
    'LGGLGL',
  ];
  if (!/^\d{13}$/.test(code)) return '<text x="5" y="10" font-size="6" fill="red">BAD EAN</text>';
  const d = code.split('').map(Number);
  const enc = firstDigitEnc[d[0]];
  let bars = '101';
  for (let i = 0; i < 6; i++) bars += (enc[i] === 'L' ? L : G)[d[i + 1]];
  bars += '01010';
  for (let i = 7; i < 13; i++) bars += R[d[i]];
  bars += '101';
  const bw = 3;
  const bh = 55;
  const startX = 6;
  const totalW = startX * 2 + bars.length * bw;
  let rects = '';
  let x = startX;
  for (let i = 0; i < bars.length; i++) {
    if (bars[i] === '1') rects += `<rect x="${x}" y="0" width="${bw}" height="${bh}" fill="#000"/>`;
    x += bw;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${bh}" width="${totalW}" height="${bh}">${rects}</svg>`;
}

// ─── main component ───────────────────────────────────────────────────────────
export default function GRNPage() {
  const { user, activeBranchId: branchId, branchSettings } = useAuth();

  const [grns, setGrns] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showSupModal, setShowSupModal] = useState(false);
  const [editingSup, setEditingSup] = useState(null);
  const [supForm, setSupForm] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
  });
  const [savingSup, setSavingSup] = useState(false);
  const [confirmDelSup, setConfirmDelSup] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [grnHeader, setGrnHeader] = useState({
    no: '',
    type: 'individual',
    supplierId: '',
    date: '',
    notes: '',
    referenceNo: '',
  });
  const [grnItems, setGrnItems] = useState([blankItem()]);
  const [savingGrn, setSavingGrn] = useState(false);

  const [showBulk, setShowBulk] = useState(null);
  const [bulkItems, setBulkItems] = useState([]);
  const [bulkIdx, setBulkIdx] = useState(0);

  const [confirmDelGrn, setConfirmDelGrn] = useState(null);
  const [printingGrn, setPrintingGrn] = useState(null);

  const h = (patch) => setGrnHeader((p) => ({ ...p, ...patch }));
  const sf = (patch) => setSupForm((p) => ({ ...p, ...patch }));

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    Promise.all([
      grnApi.listGRNs(branchId),
      grnApi.listSuppliers(branchId),
      productApi.list(branchId, { limit: 200, page: 1 }),
    ])
      .then(([grnData, supData, prodData]) => {
        setGrns(grnData.items || grnData.rows || grnData || []);
        setSuppliers(supData || []);
        setProducts(prodData.items || prodData.rows || prodData || []);
      })
      .catch(() => toast.error('Failed to load GRN data'))
      .finally(() => setLoading(false));
  }, [branchId]);

  const reloadSuppliers = useCallback(async () => {
    if (!branchId) return;
    const data = await grnApi.listSuppliers(branchId);
    setSuppliers(data || []);
  }, [branchId]);

  // ── Supplier CRUD ─────────────────────────────────────────────────────────────
  const openAddSupplier = () => {
    setEditingSup(null);
    setSupForm({ name: '', contactName: '', phone: '', email: '', address: '' });
    setShowSupModal(true);
  };
  const openEditSupplier = (sup) => {
    setEditingSup(sup);
    setSupForm({
      name: sup.name || '',
      contactName: sup.contact_name || '',
      phone: sup.phone || '',
      email: sup.email || '',
      address: sup.address || '',
    });
    setShowSupModal(true);
  };

  const saveSupplier = async () => {
    if (!supForm.name.trim()) {
      toast.error('Supplier name is required');
      return;
    }
    setSavingSup(true);
    try {
      if (editingSup) {
        await grnApi.updateSupplier(editingSup.id, {
          name: supForm.name,
          contactName: supForm.contactName,
          phone: supForm.phone,
          email: supForm.email,
          address: supForm.address,
        });
        toast.success('Supplier updated');
      } else {
        await grnApi.createSupplier(branchId, {
          name: supForm.name,
          contactName: supForm.contactName,
          phone: supForm.phone,
          email: supForm.email,
          address: supForm.address,
        });
        toast.success('Supplier added');
      }
      await reloadSuppliers();
      setShowSupModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSavingSup(false);
    }
  };

  const deleteSupplier = async (id) => {
    try {
      await grnApi.deleteSupplier(id);
      await reloadSuppliers();
      setConfirmDelSup(null);
      toast.success('Supplier deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  // ── GRN item rows ─────────────────────────────────────────────────────────────
  const updateItem = (localId, patch) =>
    setGrnItems((prev) => prev.map((r) => (r._id === localId ? { ...r, ...patch } : r)));
  const removeItem = (localId) =>
    setGrnItems((prev) => (prev.length > 1 ? prev.filter((r) => r._id !== localId) : prev));

  const handleProductSelect = async (localId, productId) => {
    updateItem(localId, {
      productId,
      variantId: '',
      variants: [],
      sellPrice: '',
      isRental: false,
      loadingV: !!productId,
    });
    if (!productId) return;
    const prod = products.find((p) => String(p.id) === productId);
    const isRental = prod?.is_rentable || false;
    const isFabric = prod?.inventory_mode === 'continuous' || prod?.type_name === 'Fabric Roll';
    try {
      const variants = await productApi.listVariants(productId);
      // Also detect fabric from variant if product-level detection failed
      const firstVar = variants?.[0];
      const isFabricFinal =
        isFabric || (firstVar && (firstVar.stock_qty_continuous > 0 || firstVar.fabric_unit));
      updateItem(localId, {
        variants: variants || [],
        loadingV: false,
        isRental,
        isFabric: isFabricFinal,
      });
    } catch {
      updateItem(localId, { variants: [], loadingV: false });
      toast.error('Failed to load variants');
    }
  };

  const handleVariantSelect = (localId, variantId, variants) => {
    const variant = variants.find((v) => String(v.id) === variantId);
    updateItem(localId, {
      variantId,
      sellPrice: variant ? String(variant.price || '') : '',
      unitCost: variant ? String(variant.cost_price || '') : '',
      fabricUnit: variant?.fabric_unit || 'm',
    });
  };

  // ── Create GRN ────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setGrnHeader({
      no: '',
      type: 'individual',
      supplierId: '',
      date: '',
      notes: '',
      referenceNo: '',
    });
    setGrnItems([blankItem()]);
    setShowCreate(true);
  };

  const saveGrn = async () => {
    if (!grnHeader.referenceNo.trim()) {
      toast.error('Reference number (supplier invoice no.) is required');
      return;
    }
    const filledItems = grnItems.filter((r) => {
      if (!r.variantId) return false;
      if (r.isFabric) return parseFloat(r.fabricRolls) > 0 && parseFloat(r.fabricMetersPerRoll) > 0;
      return parseFloat(r.qty) > 0;
    });
    if (filledItems.length === 0) {
      toast.error('Add at least one complete item row');
      return;
    }
    const incomplete = grnItems.find(
      (r) =>
        r.productId &&
        (!r.variantId || (r.isFabric ? !r.fabricRolls || !r.fabricMetersPerRoll : !r.qty)),
    );
    if (incomplete) {
      toast.error('Fill all required fields for each item');
      return;
    }
    setSavingGrn(true);
    try {
      const payload = {
        type: grnHeader.type,
        referenceNo: grnHeader.referenceNo.trim(),
        supplierId: grnHeader.supplierId || null,
        receivedDate: grnHeader.date || undefined,
        notes: grnHeader.notes || undefined,
        items: filledItems.map((r) => ({
          variantId: parseInt(r.variantId),
          quantityReceived: r.isFabric ? parseFloat(r.fabricRolls) || 1 : parseFloat(r.qty),
          unitCost: parseFloat(r.unitCost) || 0,
          // Fabric-specific
          fabricRolls: r.isFabric ? parseFloat(r.fabricRolls) || 1 : undefined,
          fabricMetersPerRoll: r.isFabric ? parseFloat(r.fabricMetersPerRoll) || 0 : undefined,
        })),
      };
      const newGrn = await grnApi.createGRN(branchId, payload);
      const priceUpdates = filledItems.filter((r) => r.sellPrice && r.variantId);
      await Promise.all(
        priceUpdates.map((r) =>
          productApi.updateVariant(r.variantId, { price: parseFloat(r.sellPrice) }).catch(() => {}),
        ),
      );
      setGrns((prev) => [newGrn, ...prev]);
      toast.success(
        `GRN ${newGrn.grn_no} created (Ref: ${grnHeader.referenceNo}) — ${filledItems.length} item line(s), barcodes generated`,
      );
      // Tell the notification bell to refresh — stock levels have changed
      window.dispatchEvent(new CustomEvent('nxf:stock-updated'));
      setShowCreate(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create GRN');
    } finally {
      setSavingGrn(false);
    }
  };

  // ── USB Print — browser print dialog, 50x25mm 2-up, no ZPL/IP needed ─────────
  const printLabelsUSB = (barcodes) => {
    if (!barcodes || !barcodes.length) {
      toast.error('No barcodes to print');
      return;
    }
    const pairs = [];
    for (let i = 0; i < barcodes.length; i += 2) pairs.push([barcodes[i], barcodes[i + 1] || null]);

    const css = `
      @page { margin: 0; size: 103mm 25mm; orphans: 0; widows: 0; }
      @page { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { width: 103mm; background: #fff; font-family: Arial, sans-serif; }
      .row { display: flex; width: 103mm; height: 25mm; page-break-after: always; }
      .row:last-child { page-break-after: avoid; }
      .gap { width: 3mm; flex-shrink: 0; }
      .label {
        width: 50mm; height: 25mm; flex-shrink: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 0.8mm; overflow: hidden;
        padding-top: 5mm;
      }
      .barcode-area svg { display: block; width: 44mm; height: auto; }
      .digits { font-family: 'Courier New', monospace; font-size: 10pt; font-weight: 700; letter-spacing: 0.5px; color: #000; text-align: center; }
      .name  { font-size: 8pt; font-weight: 700; color: #000; text-align: center; }
      .sku-price { display: flex; justify-content: center; align-items: center; gap: 2mm; }
      .sku   { font-family: 'Courier New', monospace; font-size: 8pt; font-weight: 700; color: #000; text-align: center; }
      .price { font-size: 8pt; font-weight: 700; color: #000; text-align: center; }
    `;

    const labelHTML = (bc) => {
      if (!bc) return `<div class="label"></div>`;
      const name = (bc.product_name || '').slice(0, 24);
      const sku = (bc.label_text || '').slice(0, 22);
      const price =
        bc.price !== null && bc.price !== undefined && Number(bc.price) > 0
          ? `Rs ${Number(bc.price).toLocaleString()}`
          : '';
      return `<div class="label">
        <div class="barcode-area">${ean13SVG(bc.barcode_value || '')}</div>
        <div class="digits">${bc.barcode_value || ''}</div>
        <div class="name">${name}</div>
        <div class="sku-price"><span class="sku">${sku}</span>${price ? `<span class="price">${price}</span>` : ''}</div>
      </div>`;
    };

    const body = pairs
      .map(
        ([l, r]) => `<div class="row">${labelHTML(l)}<div class="gap"></div>${labelHTML(r)}</div>`,
      )
      .join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title> </title><style>${css}</style></head><body onload="window.print();window.onafterprint=function(){window.close();}">${body}</body></html>`;

    const popup = window.open(
      '',
      '_blank',
      'width=800,height=600,toolbar=no,scrollbars=no,menubar=no,status=no,location=no,titlebar=no',
    );
    if (!popup) {
      toast.error('Pop-up blocked — allow pop-ups for this site in your browser settings');
      return;
    }
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  };

  // ── Bulk print modal ──────────────────────────────────────────────────────────
  const openBulk = async (grn) => {
    setShowBulk(grn);
    setBulkIdx(0);
    setBulkItems([]);
    try {
      const detail = await grnApi.getGRN(grn.id);
      if (detail.items?.length) {
        const allBarcodes = await Promise.all(
          detail.items.map((item) => grnApi.getItemBarcodes(item.id).catch(() => [])),
        );
        setBulkItems(allBarcodes.flat().filter((b) => !b.is_printed));
      }
    } catch {
      toast.error('Failed to load barcodes');
    }
  };

  const printBulkBarcode = async (barcode) => {
    try {
      const nextBarcode = bulkItems[bulkIdx + 1] || null;
      printLabelsUSB([barcode, nextBarcode].filter(Boolean));
      await grnApi.markPrinted(barcode.id);
      if (nextBarcode) await grnApi.markPrinted(nextBarcode.id);
      const printedIds = new Set([barcode.id, nextBarcode?.id].filter(Boolean));
      setBulkItems((prev) => prev.filter((b) => !printedIds.has(b.id)));
      setBulkIdx(0);
      toast.success('Sent to print — select Zebra GT800 in the dialog');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Print failed');
    }
  };

  // ── Print all — individual GRN ────────────────────────────────────────────────
  const printAllLabels = async (grn) => {
    setPrintingGrn(grn.id);
    try {
      const detail = await grnApi.getGRN(grn.id);
      if (!detail.items?.length) {
        toast.error('No items in this GRN');
        return;
      }
      const allBarcodes = await Promise.all(
        detail.items.map((item) => grnApi.getItemBarcodes(item.id).catch(() => [])),
      );
      const barcodes = allBarcodes.flat();
      if (!barcodes.length) {
        toast.error('No barcodes found for this GRN');
        return;
      }
      printLabelsUSB(barcodes);
      await grnApi.printAllGRN(grn.id);
      toast.success(
        `${barcodes.length} label(s) sent to print — select Zebra GT800 in the dialog`,
        { duration: 5000 },
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load barcodes');
    } finally {
      setPrintingGrn(null);
    }
  };

  // ── Delete GRN ────────────────────────────────────────────────────────────────
  const deleteGrn = async (id) => {
    try {
      await grnApi.deleteGRN(id);
      setGrns((prev) => prev.filter((g) => g.id !== id));
      setConfirmDelGrn(null);
      toast.success('GRN deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed — only Owner can delete GRNs');
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────────
  const supplierOpts = suppliers.map((s) => ({ value: String(s.id), label: s.name }));
  const productOpts = products.map((p) => ({ value: String(p.id), label: p.name }));
  const grnTotalCost = grnItems.reduce(
    (sum, r) => sum + (parseFloat(r.qty) || 0) * (parseFloat(r.unitCost) || 0),
    0,
  );

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
        Loading GRN data…
      </div>
    );

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── SUPPLIERS ── */}
      <div>
        <SectionHeader
          title="Suppliers"
          action={
            <Btn size="sm" onClick={openAddSupplier}>
              + Add supplier
            </Btn>
          }
        />
        {suppliers.length === 0 ? (
          <Card>
            <EmptyState
              icon="🏭"
              title="No suppliers yet"
              sub="Add a supplier before creating GRNs so you can link deliveries to the correct vendor."
            />
          </Card>
        ) : (
          <Card flush>
            <Table
              columns={[
                {
                  key: 'name',
                  label: 'Name',
                  render: (r) => <span style={{ fontWeight: 500 }}>{r.name}</span>,
                },
                { key: 'contact_name', label: 'Contact', render: (r) => r.contact_name || '—' },
                { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
                { key: 'email', label: 'Email', render: (r) => r.email || '—' },
                {
                  key: 'actions',
                  label: '',
                  render: (r) => (
                    <Flex gap={6}>
                      <Btn variant="ghost" size="sm" onClick={() => openEditSupplier(r)}>
                        Edit
                      </Btn>
                      <Btn variant="danger" size="sm" onClick={() => setConfirmDelSup(r)}>
                        Del
                      </Btn>
                    </Flex>
                  ),
                },
              ]}
              rows={suppliers}
            />
          </Card>
        )}
      </div>

      {/* ── GRN LIST ── */}
      <div>
        <SectionHeader
          title="Goods Received Notes"
          action={<Btn onClick={openCreate}>+ Create GRN</Btn>}
        />

        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 12,
            background: 'rgba(0,180,216,.08)',
            border: '0.5px solid rgba(0,180,216,.2)',
            fontSize: 12,
            color: 'var(--col-teal)',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
          }}
        >
          <span>ℹ</span>
          <span>
            EAN-13 barcodes are auto-generated for every received unit. Printing opens your
            browser's print dialog — select <strong>Zebra GT800</strong> and set paper size to{' '}
            <strong>100mm × 25mm</strong> with no margins.
          </span>
        </div>

        <Card flush>
          <Table
            columns={[
              {
                key: 'grn_no',
                label: 'GRN No.',
                render: (r) => (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--col-teal)',
                      fontSize: 12,
                    }}
                  >
                    {r.grn_no}
                  </span>
                ),
              },
              {
                key: 'reference_no',
                label: 'Ref No.',
                render: (r) => (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {r.reference_no || '—'}
                  </span>
                ),
              },
              { key: 'supplier_name', label: 'Supplier', render: (r) => r.supplier_name || '—' },
              {
                key: 'grn_type',
                label: 'Type',
                render: (r) => (
                  <Badge
                    label={r.grn_type || r.type || '—'}
                    variant={r.grn_type === 'bulk' || r.type === 'bulk' ? 'amber' : 'teal'}
                  />
                ),
              },
              {
                key: 'received_date',
                label: 'Date',
                render: (r) => (r.received_date || r.received_at || '').slice(0, 10) || '—',
              },
              { key: 'item_count', label: 'Items', render: (r) => r.item_count ?? '—' },
              {
                key: 'actions',
                label: '',
                render: (r) => (
                  <Flex gap={6}>
                    <Btn
                      variant="secondary"
                      size="sm"
                      disabled={printingGrn === r.id}
                      onClick={() =>
                        r.grn_type === 'bulk' || r.type === 'bulk' ? openBulk(r) : printAllLabels(r)
                      }
                    >
                      {printingGrn === r.id
                        ? 'Loading…'
                        : r.grn_type === 'bulk' || r.type === 'bulk'
                          ? 'Print (bulk)'
                          : 'Print all'}
                    </Btn>
                    <Btn variant="danger" size="sm" onClick={() => setConfirmDelGrn(r)}>
                      Del
                    </Btn>
                  </Flex>
                ),
              },
            ]}
            rows={grns}
            emptyMsg="No GRNs yet — create your first"
          />
        </Card>
      </div>

      {/* ── MODAL: ADD/EDIT SUPPLIER ── */}
      {showSupModal && (
        <Modal
          title={editingSup ? 'Edit supplier' : 'Add supplier'}
          onClose={() => setShowSupModal(false)}
          width={460}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input
              label="Supplier name *"
              value={supForm.name}
              onChange={(v) => sf({ name: v })}
              placeholder="e.g. Abony Holdings (PVT) Ltd"
            />
            <Input
              label="Contact person"
              value={supForm.contactName}
              onChange={(v) => sf({ contactName: v })}
              placeholder="e.g. Piyanatha"
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input
                label="Phone"
                value={supForm.phone}
                onChange={(v) => sf({ phone: v })}
                placeholder="077 1234567"
              />
              <Input
                label="Email"
                value={supForm.email}
                onChange={(v) => sf({ email: v })}
                placeholder="info@supplier.com"
              />
            </div>
            <Input
              label="Address"
              value={supForm.address}
              onChange={(v) => sf({ address: v })}
              placeholder="Street, City"
            />
            <Flex gap={10} justify="flex-end" style={{ marginTop: 4 }}>
              <Btn variant="secondary" onClick={() => setShowSupModal(false)}>
                Cancel
              </Btn>
              <Btn onClick={saveSupplier} disabled={savingSup}>
                {savingSup ? 'Saving…' : editingSup ? 'Update supplier' : 'Add supplier'}
              </Btn>
            </Flex>
          </div>
        </Modal>
      )}

      {/* ── MODAL: CREATE GRN ── */}
      {showCreate && (
        <Modal title="Create GRN" onClose={() => setShowCreate(false)} width={820}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Header */}
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
                Delivery details
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
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
                    GRN No. (auto-generated)
                  </span>
                  <div
                    style={{
                      padding: '7px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255,255,255,.03)',
                      border: '0.5px solid var(--col-border)',
                      color: 'var(--col-text-3)',
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    Auto — e.g. GRN-000001
                  </div>
                </div>
                <Select
                  label="GRN type"
                  value={grnHeader.type}
                  onChange={(v) => h({ type: v })}
                  options={[
                    { value: 'individual', label: 'Individual (print all at once)' },
                    { value: 'bulk', label: 'Bulk (confirm each barcode)' },
                  ]}
                />
                <Input
                  label="Received date"
                  type="date"
                  value={grnHeader.date}
                  onChange={(v) => h({ date: v })}
                />
              </div>
              <div
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}
              >
                <FieldLabel label="Supplier (optional)">
                  <InlineSelect
                    value={grnHeader.supplierId}
                    onChange={(v) => h({ supplierId: v })}
                    options={supplierOpts}
                    placeholder="Select supplier…"
                  />
                </FieldLabel>
                <Input
                  label="Reference No. (supplier invoice no.) *"
                  value={grnHeader.referenceNo}
                  onChange={(v) => h({ referenceNo: v })}
                  placeholder="e.g. INV-2026-001"
                />
              </div>
              <div
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}
              >
                <Input
                  label="Notes"
                  value={grnHeader.notes}
                  onChange={(v) => h({ notes: v })}
                  placeholder="Optional notes about this delivery"
                />
              </div>
            </div>

            <Divider />

            {/* Item rows */}
            <div>
              <Flex justify="space-between" align="center" style={{ marginBottom: 10 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--col-text-2)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Received items
                </span>
                <Btn
                  size="sm"
                  variant="secondary"
                  onClick={() => setGrnItems((prev) => [...prev, blankItem()])}
                >
                  + Add row
                </Btn>
              </Flex>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 2fr 70px 70px 90px 90px 80px 32px',
                  gap: 8,
                  padding: '0 0 6px',
                  marginBottom: 4,
                  borderBottom: '0.5px solid var(--col-border)',
                }}
              >
                {[
                  'Product',
                  'Variant (size / color / style)',
                  'Qty / Rolls',
                  'Length/Roll',
                  'Unit cost (Rs)',
                  'Sell price (Rs)',
                  'Type',
                  '',
                ].map((h) => (
                  <span
                    key={h}
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: 'var(--col-text-3)',
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {grnItems.map((row) => {
                  const variantOpts = row.variants.map((v) => ({
                    value: String(v.id),
                    label: v.attributes?.map((a) => a.value).join(' · ') || v.sku,
                  }));
                  return (
                    <div
                      key={row._id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 2fr 70px 70px 90px 90px 80px 32px',
                        gap: 8,
                        alignItems: 'center',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255,255,255,.03)',
                        border: '0.5px solid var(--col-border)',
                      }}
                    >
                      <InlineSelect
                        value={row.productId}
                        onChange={(v) => handleProductSelect(row._id, v)}
                        options={productOpts}
                        placeholder="Select product…"
                      />
                      <InlineSelect
                        value={row.variantId}
                        onChange={(v) => handleVariantSelect(row._id, v, row.variants)}
                        options={variantOpts}
                        placeholder={
                          row.loadingV
                            ? 'Loading…'
                            : row.productId
                              ? row.variants.length === 0
                                ? 'No variants — add first'
                                : 'Select variant…'
                              : 'Select product first'
                        }
                        disabled={!row.productId || row.loadingV || row.variants.length === 0}
                      />
                      {row.isFabric ? (
                        <>
                          <InlineNumber
                            value={row.fabricRolls}
                            onChange={(v) => updateItem(row._id, { fabricRolls: v })}
                            placeholder="Rolls"
                            min={1}
                          />
                          <InlineNumber
                            value={row.fabricMetersPerRoll}
                            onChange={(v) => updateItem(row._id, { fabricMetersPerRoll: v })}
                            placeholder={row.fabricUnit || 'm'}
                          />
                        </>
                      ) : (
                        <>
                          <InlineNumber
                            value={row.qty}
                            onChange={(v) => updateItem(row._id, { qty: v })}
                            placeholder="0"
                            min={1}
                          />
                          <div />
                        </>
                      )}
                      <InlineNumber
                        value={row.unitCost}
                        onChange={(v) => updateItem(row._id, { unitCost: v })}
                        placeholder="Cost"
                      />
                      <InlineNumber
                        value={row.sellPrice}
                        onChange={(v) => updateItem(row._id, { sellPrice: v })}
                        placeholder="Price"
                      />
                      <button
                        onClick={() => updateItem(row._id, { isRental: !row.isRental })}
                        style={{
                          padding: '5px 0',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 11,
                          fontWeight: 500,
                          background: row.isRental ? 'rgba(245,166,35,.2)' : 'rgba(6,214,160,.15)',
                          color: row.isRental ? 'var(--col-gold)' : 'var(--col-green)',
                          border: row.isRental
                            ? '0.5px solid rgba(245,166,35,.3)'
                            : '0.5px solid rgba(6,214,160,.3)',
                          cursor: 'pointer',
                        }}
                      >
                        {row.isRental ? 'Rental' : 'Sell'}
                      </button>
                      <button
                        onClick={() => removeItem(row._id)}
                        disabled={grnItems.length === 1}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: grnItems.length === 1 ? 'not-allowed' : 'pointer',
                          color: 'var(--col-red)',
                          fontSize: 16,
                          opacity: grnItems.length === 1 ? 0.3 : 1,
                          padding: '2px 4px',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>

              <div
                style={{
                  marginTop: 10,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,255,255,.03)',
                  fontSize: 11,
                  color: 'var(--col-text-3)',
                }}
              >
                💡 Tip: if the variant you need doesn't exist yet, go to{' '}
                <strong style={{ color: 'var(--col-text-2)' }}>Inventory</strong> and add it first,
                then come back here. One EAN-13 barcode label will be generated per unit (qty)
                received.
                {grnHeader.type === 'bulk' && (
                  <span style={{ color: 'var(--col-gold)' }}>
                    {' '}
                    Bulk mode: labels are confirmed and printed two at a time.
                  </span>
                )}
              </div>
            </div>

            <Divider />

            {/* Summary */}
            <Flex justify="space-between" align="center">
              <div style={{ fontSize: 13, color: 'var(--col-text-2)' }}>
                <span>{grnItems.filter((r) => r.variantId && r.qty).length} line(s)</span>
                <span style={{ margin: '0 8px', color: 'var(--col-border-2)' }}>·</span>
                <span>
                  {grnItems
                    .filter((r) => r.variantId && r.qty)
                    .reduce((s, r) => s + (parseFloat(r.qty) || 0), 0)}{' '}
                  total units
                </span>
                {grnTotalCost > 0 && (
                  <>
                    <span style={{ margin: '0 8px', color: 'var(--col-border-2)' }}>·</span>
                    <span>
                      Total cost:{' '}
                      <strong style={{ color: 'var(--col-text)' }}>
                        Rs {grnTotalCost.toLocaleString()}
                      </strong>
                    </span>
                  </>
                )}
              </div>
              <Flex gap={10}>
                <Btn variant="secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </Btn>
                <Btn onClick={saveGrn} disabled={savingGrn}>
                  {savingGrn ? 'Creating GRN…' : 'Create GRN & generate barcodes'}
                </Btn>
              </Flex>
            </Flex>
          </div>
        </Modal>
      )}

      {/* ── MODAL: BULK PRINT ── */}
      {showBulk && (
        <Modal
          title={`Bulk print — ${showBulk.grn_no} · ${bulkItems.length} label(s) remaining`}
          onClose={() => setShowBulk(null)}
          width={460}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--col-text-3)', marginBottom: 14 }}>
              Each click prints a row of 2 stickers and marks them as printed.
            </div>

            {bulkItems.length === 0 ? (
              <div style={{ padding: '2rem', color: 'var(--col-text-3)' }}>
                No barcodes to print.
              </div>
            ) : (
              <div
                style={{
                  background: 'var(--col-bg-3)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 20,
                  marginBottom: 16,
                  border: '0.5px solid var(--col-border-2)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                  {bulkItems[bulkIdx]?.product_name || 'Product'}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 18,
                    letterSpacing: 3,
                    color: 'var(--col-teal)',
                    margin: '8px 0',
                  }}
                >
                  {bulkItems[bulkIdx]?.barcode_value || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--col-text-3)' }}>
                  EAN-13 · {bulkItems[bulkIdx]?.sku || ''}
                </div>
                {bulkItems[bulkIdx + 1] && (
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: '0.5px dashed var(--col-border)',
                      fontSize: 11,
                      color: 'var(--col-text-3)',
                    }}
                  >
                    <span style={{ color: 'var(--col-amber)' }}>Paired with → </span>
                    {bulkItems[bulkIdx + 1].product_name} · {bulkItems[bulkIdx + 1].barcode_value}
                  </div>
                )}
              </div>
            )}

            <Flex gap={8} justify="center">
              {bulkItems[bulkIdx] && (
                <Btn onClick={() => printBulkBarcode(bulkItems[bulkIdx])}>
                  🖨 Print {bulkItems[bulkIdx + 1] ? 'this pair' : 'this label'} to GT800
                </Btn>
              )}
              {bulkItems.length === 0 && (
                <Btn variant="success" onClick={() => setShowBulk(null)}>
                  Done ✓
                </Btn>
              )}
            </Flex>
          </div>
        </Modal>
      )}

      {/* ── MODAL: CONFIRM DELETE SUPPLIER ── */}
      {confirmDelSup && (
        <Modal title="Delete supplier" onClose={() => setConfirmDelSup(null)} width={360}>
          <p style={{ fontSize: 13, color: 'var(--col-text-2)', marginBottom: 16 }}>
            Delete <strong style={{ color: 'var(--col-text)' }}>{confirmDelSup.name}</strong>? This
            cannot be undone.
          </p>
          <Flex gap={10} justify="flex-end">
            <Btn variant="secondary" onClick={() => setConfirmDelSup(null)}>
              Cancel
            </Btn>
            <Btn variant="danger" onClick={() => deleteSupplier(confirmDelSup.id)}>
              Delete
            </Btn>
          </Flex>
        </Modal>
      )}

      {/* ── MODAL: CONFIRM DELETE GRN ── */}
      {confirmDelGrn && (
        <Modal title="Delete GRN" onClose={() => setConfirmDelGrn(null)} width={360}>
          <p style={{ fontSize: 13, color: 'var(--col-text-2)', marginBottom: 16 }}>
            Delete GRN{' '}
            <strong style={{ color: 'var(--col-text)', fontFamily: 'var(--font-mono)' }}>
              {confirmDelGrn.grn_no}
            </strong>
            ? This will not reverse any stock that was already added.
          </p>
          <Flex gap={10} justify="flex-end">
            <Btn variant="secondary" onClick={() => setConfirmDelGrn(null)}>
              Cancel
            </Btn>
            <Btn variant="danger" onClick={() => deleteGrn(confirmDelGrn.id)}>
              Delete GRN
            </Btn>
          </Flex>
        </Modal>
      )}
    </div>
  );
}
