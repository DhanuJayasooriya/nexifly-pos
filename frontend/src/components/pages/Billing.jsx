import React, { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Card, Btn, Input, Select, Modal, Badge, Flex, Divider } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { productApi, billingApi, http, customerApi, rentalApi } from '../../api';

const d = (r) => r.data.data;
const initSession = (key) => ({
  key,
  items: [],
  disc: 0,
  tax: 0,
  billType: 'sale',
  scannedBarcodes: [],
});

export default function Billing() {
  const { user, activeBranchId, branchSettings } = useAuth();
  const branchId = activeBranchId || user?.branchId || user?.branch_id;

  const [sessions, setSessions] = useState([initSession('A')]);
  const [activeKey, setActiveKey] = useState('A');
  const [scanInput, setScanInput] = useState('');
  const [qty, setQty] = useState('1');
  const [showBillPrev, setBillPrev] = useState(false);
  const [payMethod, setPayMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [adding, setAdding] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const scanRef = useRef();
  const suggestTimer = useRef(null);

  // Rental date modal state
  const [fabricModal, setFabricModal] = useState(null); // { variant, barcodeValue }
  const [fabricQty, setFabricQty] = useState('');
  const [fabricUnit, setFabricUnit] = useState('m');
  const [rentalModal, setRentalModal] = useState(null); // { variant, qty }
  const [rentalDates, setRentalDates] = useState({ reservedDate: '', rentedDate: '', dueDate: '' });
  const [checkingRental, setCheckingRental] = useState(false);
  const [overlapError, setOverlapError] = useState(null); // { from, to } | null
  const [custSearch, setCustSearch] = useState('');
  const [custResults, setCustResults] = useState([]);
  const [custSearching, setCustSearching] = useState(false);
  const [selectedCust, setSelectedCust] = useState(null); // { id, name, phone, nic }
  const [showAddCust, setShowAddCust] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', phone: '', nic: '', email: '' });
  const [savingCust, setSavingCust] = useState(false);
  const custTimer = useRef(null);

  const sess = sessions.find((s) => s.key === activeKey) || sessions[0];
  const salesSub = sess.items
    .filter((i) => i.type !== 'rental')
    .reduce((a, i) => a + i.lineTotal, 0);
  const rentalSub = sess.items
    .filter((i) => i.type === 'rental')
    .reduce((a, i) => a + i.lineTotal, 0);
  const hasMixed = salesSub > 0 && rentalSub > 0;
  const sub = sess.items.reduce((a, i) => a + i.lineTotal, 0);
  const total = sub - (sess.disc || 0) + (sess.tax || 0);

  const updateSess = useCallback((key, patch) => {
    setSessions((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }, []);

  // ── Sessions ──────────────────────────────────────────────────────────────
  const openSession = () => {
    if (sessions.length >= 2) {
      toast.error('Maximum 2 concurrent sessions');
      return;
    }
    const key = sessions.some((s) => s.key === 'A') ? 'B' : 'A';
    setSessions((p) => [...p, initSession(key)]);
    setActiveKey(key);
    toast.success('Session ' + key + ' opened');
  };
  const closeSession = (key) => {
    if (sessions.length === 1) {
      toast.error('Cannot close last session');
      return;
    }
    setSessions((p) => p.filter((s) => s.key !== key));
    setActiveKey(sessions.find((s) => s.key !== key)?.key || 'A');
  };

  // ── Suggestions ───────────────────────────────────────────────────────────
  const onScanChange = (val) => {
    setScanInput(val);
    setShowSuggest(false);
    if (!val.trim() || val.length < 2 || !branchId) return;
    clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(async () => {
      try {
        const results = await productApi.searchVariants(branchId, val.trim());
        setSuggestions(results || []);
        setShowSuggest((results || []).length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 250);
  };

  const pickSuggestion = (s) => {
    setShowSuggest(false);
    setSuggestions([]);
    // For fabric items, use the suggestion data directly to avoid a second lookup
    // that might return stale data — call addItemWithValue with the full variant object
    if (s.inventory_mode === 'continuous') {
      setScanInput(s.barcode_value || s.variant_sku || s.sku);
      // Directly trigger fabric modal with the suggestion's data
      setTimeout(() => {
        const variant = {
          id: s.id,
          sku: s.sku || s.variant_sku,
          product_name: s.product_name,
          price: s.price,
          base_selling_price: s.base_selling_price || s.price,
          stock_qty: s.stock_qty,
          stock_qty_continuous: s.stock_qty_continuous,
          inventory_mode: s.inventory_mode,
          fabric_unit: s.fabric_unit,
          fabric_width: s.fabric_width,
          fabric_design: s.fabric_design,
          is_rentable: s.is_rentable,
          barcode_value: s.barcode_value,
        };
        setFabricModal({ variant, barcodeValue: s.barcode_value || s.variant_sku || s.sku });
        setFabricQty('');
        setFabricUnit(s.fabric_unit || 'm');
        setScanInput('');
      }, 50);
      return;
    }
    setScanInput(s.barcode_value || s.variant_sku || s.sku);
    setTimeout(() => {
      const qi = document.getElementById('bill-qty-input');
      if (qi) {
        qi.focus();
        qi.select();
      }
    }, 50);
  };

  // ── Add item ──────────────────────────────────────────────────────────────
  const addItemWithValue = async (value) => {
    const q = parseFloat(qty) || 1;
    if (!value?.trim()) {
      toast.error('Enter a barcode or SKU');
      return;
    }

    // Block duplicate barcode scans within the same session
    const trimmed = value.trim();
    if (sess.scannedBarcodes.includes(trimmed)) {
      toast.error('⚠ Already scanned — ' + trimmed, { duration: 3000 });
      setScanInput('');
      scanRef.current?.focus();
      return;
    }

    setAdding(true);
    try {
      let variant;
      try {
        variant = await productApi.lookupBarcode(trimmed, branchId);
      } catch {
        variant = await productApi.lookupSku(trimmed, branchId);
      }

      // Block if this variant was already added — check by variantId regardless of how it was entered
      // This catches: SKU typed first, barcode typed second (or vice versa)
      const alreadyAdded = sess.items.some((i) => i.variantId === variant.id && !i.rentalInfo);
      if (alreadyAdded) {
        toast.error(`⚠ Already on this bill — ${variant.product_name || variant.name}`, {
          duration: 3000,
        });
        setScanInput('');
        scanRef.current?.focus();
        setAdding(false);
        return;
      }

      // Block sale/rental if out of stock
      // Block if out of stock — fabric uses stock_qty_continuous, others use stock_qty
      const isFabric = variant.inventory_mode === 'continuous';
      const availableStock = isFabric
        ? Number(variant.stock_qty_continuous || 0)
        : Number(variant.stock_qty || 0);
      // DEBUG — remove after testing
      console.log(
        '[BILLING] variant:',
        variant.sku,
        'inventory_mode:',
        variant.inventory_mode,
        'stock_qty:',
        variant.stock_qty,
        'stock_qty_continuous:',
        variant.stock_qty_continuous,
        'isFabric:',
        isFabric,
        'availableStock:',
        availableStock,
      );
      if (availableStock <= 0) {
        toast.error(
          `Out of stock — ${variant.product_name || variant.name} has no units available`,
          { duration: 4000 },
        );
        setScanInput('');
        scanRef.current?.focus();
        setAdding(false);
        return;
      }

      // If fabric/continuous item — show length modal
      if (variant.inventory_mode === 'continuous') {
        setFabricModal({ variant, barcodeValue: trimmed });
        setFabricQty('');
        setFabricUnit(variant.fabric_unit || 'm');
        setScanInput('');
        setQty('1');
        setAdding(false);
        return;
      }

      // If rental item — open date modal (mixed bills with sale items allowed)
      if (variant.is_rentable) {
        setRentalModal({ variant, qty: q });
        setRentalDates({
          reservedDate: '',
          rentedDate: '',
          dueDate: '',
          customerName: '',
          customTotal: '',
          advancePayment: '',
          advanceMethod: 'cash',
          deposit: '',
        });
        setSelectedCust(null);
        setCustSearch('');
        setCustResults([]);
        setShowAddCust(false);
        setOverlapError(null);
        setScanInput('');
        setQty('1');
        setAdding(false);
        return;
      }

      addVariantToSession(variant, q, null, trimmed);
      // Record all identifiers so any future scan/type of the same item is blocked
      const toRecord = [trimmed];
      if (variant.barcode_value && !toRecord.includes(variant.barcode_value))
        toRecord.push(variant.barcode_value);
      if (variant.sku && !toRecord.includes(variant.sku)) toRecord.push(variant.sku);
      updateSess(activeKey, { scannedBarcodes: [...sess.scannedBarcodes, ...toRecord] });
      setScanInput('');
      setQty('1');
      scanRef.current?.focus();
    } catch {
      toast.error('Not found: "' + value + '" — check barcode or SKU');
    } finally {
      setAdding(false);
    }
  };

  const addVariantToSession = (
    variant,
    q,
    rentalInfo = null,
    barcodeValue = null,
    fabricInfo = null,
  ) => {
    const basePrice = Number(variant.base_selling_price || variant.price || 0);
    const unitPrice = Number(variant.discountedPrice ?? basePrice);
    const discAmt = Number(variant.discountApplied ?? 0);
    const discSrc = variant.discountSource || 'none';
    const lineTotal = unitPrice * q;

    const existing = sess.items.findIndex((i) => i.variantId === variant.id && !i.rentalInfo);
    const newItems =
      existing >= 0 && !rentalInfo
        ? sess.items.map((item, idx) =>
            idx === existing
              ? { ...item, qty: item.qty + q, lineTotal: item.lineTotal + lineTotal }
              : item,
          )
        : [
            ...sess.items,
            {
              variantId: variant.id,
              name: variant.product_name || variant.name,
              sku: variant.sku,
              barcodeValue: barcodeValue || variant.barcode_value || null,
              type: variant.is_rentable
                ? 'rental'
                : variant.inventory_mode === 'continuous'
                  ? 'fabric'
                  : 'standard',
              qty: q,
              basePrice,
              unitPrice,
              lineTotal,
              discount: discAmt,
              discountSource: discSrc,
              rentalInfo,
              fabricInfo,
            },
          ];

    updateSess(activeKey, { items: newItems });

    if (discAmt > 0) {
      toast.success(
        'Added: ' +
          (variant.product_name || variant.name) +
          ' — ' +
          discSrc +
          ' discount Rs ' +
          discAmt +
          ' applied',
        { duration: 4000, icon: '🏷' },
      );
    } else {
      toast.success('Added: ' + (variant.product_name || variant.name));
    }
  };

  const addItem = () => addItemWithValue(scanInput);

  const removeItem = (idx) =>
    updateSess(activeKey, { items: sess.items.filter((_, i) => i !== idx) });

  // ── Rental date confirmation ───────────────────────────────────────────────
  // Search customer by NIC, name or phone
  const searchCustomer = async (val) => {
    setCustSearch(val);
    setSelectedCust(null);
    if (!val.trim() || val.length < 2) {
      setCustResults([]);
      return;
    }
    clearTimeout(custTimer.current);
    custTimer.current = setTimeout(async () => {
      setCustSearching(true);
      try {
        const res = await customerApi.list(branchId, { search: val.trim(), limit: 6, page: 1 });
        setCustResults(res.items || res.rows || (Array.isArray(res) ? res : []));
      } catch {
        setCustResults([]);
      } finally {
        setCustSearching(false);
      }
    }, 300);
  };

  const saveNewCustomer = async () => {
    if (!newCust.name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    setSavingCust(true);
    try {
      const created = await customerApi.create(branchId, newCust);
      setSelectedCust(created);
      setCustSearch(created.name);
      setCustResults([]);
      setShowAddCust(false);
      setNewCust({ name: '', phone: '', nic: '', email: '' });
      toast.success('Customer added: ' + created.name);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save customer');
    } finally {
      setSavingCust(false);
    }
  };

  // Real-time availability check — fires when both dates are filled
  const checkAvailability = async (reserved, due) => {
    if (!reserved || !due || due <= reserved || !rentalModal?.variant?.id) return;
    setOverlapError(null);
    try {
      const res = await http
        .get(`/branches/${branchId}/rental/available`, {
          params: { variantId: rentalModal.variant.id, from: reserved, to: due },
        })
        .then(d);
      if (!res.available) setOverlapError({ from: res.conflictFrom, to: res.conflictTo });
    } catch {
      /* silent — confirmRental will catch it properly */
    }
  };

  const confirmRental = async () => {
    const { reservedDate, rentedDate, dueDate } = rentalDates;
    if (!reservedDate || !rentedDate || !dueDate) {
      toast.error('All three dates are required');
      return;
    }
    if (dueDate <= reservedDate) {
      toast.error('Return date must be after reserved date');
      return;
    }

    setOverlapError(null);
    setCheckingRental(true);
    try {
      const res = await http
        .get(`/branches/${branchId}/rental/available`, {
          params: { variantId: rentalModal.variant.id, from: reservedDate, to: dueDate },
        })
        .then(d);

      if (!res.available) {
        setOverlapError({ from: res.conflictFrom, to: res.conflictTo });
        setCheckingRental(false);
        return;
      }

      const days = Math.ceil((new Date(dueDate) - new Date(reservedDate)) / 86400000);
      const stdRate = Number(
        rentalModal.variant.rental_price_per_day || rentalModal.variant.price || 0,
      );
      const customTotal = parseFloat(rentalDates.customTotal);
      // customTotal is a FLAT total amount entered by owner — not per day
      // If not entered, calculate from daily rate × days
      const totalRent = customTotal || days * stdRate;
      addVariantToSession(
        {
          ...rentalModal.variant,
          price: totalRent,
          base_selling_price: totalRent,
          discountedPrice: totalRent,
          discountApplied: 0,
          discountSource: 'none',
        },
        1,
        {
          reservedDate,
          rentedDate: rentalDates.rentedDate || null,
          dueDate,
          customerId: selectedCust?.id || null,
          customerName: selectedCust?.name || rentalDates.customerName,
          customTotal: customTotal || null,
          days,
          totalRent,
          advancePayment: parseFloat(rentalDates.advancePayment) || 0,
          advanceMethod: rentalDates.advanceMethod || 'cash',
          balanceDue: totalRent - (parseFloat(rentalDates.advancePayment) || 0),
          deposit: parseFloat(rentalDates.deposit) || 0,
        },
      );
      // Auto-switch session bill type to rental so the label and printed bill show correctly
      updateSess(activeKey, { billType: 'rental' });
      setRentalModal(null);
      scanRef.current?.focus();
    } catch (err) {
      // If check endpoint doesn't exist yet, add anyway with a warning
      if (err.response?.status === 404) {
        const days = Math.ceil((new Date(dueDate) - new Date(reservedDate)) / 86400000);
        const stdRate = Number(
          rentalModal.variant.rental_price_per_day || rentalModal.variant.price || 0,
        );
        const customTotal = parseFloat(rentalDates.customTotal);
        const totalRent = customTotal || days * stdRate;
        addVariantToSession(
          {
            ...rentalModal.variant,
            price: totalRent,
            base_selling_price: totalRent,
            discountedPrice: totalRent,
            discountApplied: 0,
            discountSource: 'none',
          },
          1,
          {
            reservedDate,
            rentedDate: rentedDate || null,
            dueDate,
            customerId: selectedCust?.id || null,
            customerName: selectedCust?.name || rentalDates.customerName,
            customTotal: customTotal || null,
            days,
            totalRent,
            advancePayment: parseFloat(rentalDates.advancePayment) || 0,
            advanceMethod: rentalDates.advanceMethod || 'cash',
            balanceDue: totalRent - (parseFloat(rentalDates.advancePayment) || 0),
            deposit: parseFloat(rentalDates.deposit) || 0,
          },
        );
        updateSess(activeKey, { billType: 'rental' });
        setRentalModal(null);
      } else {
        toast.error(
          'Could not check availability: ' + (err.response?.data?.message || err.message),
        );
      }
    } finally {
      setCheckingRental(false);
    }
  };

  // ── Fabric length confirmation ─────────────────────────────────────────────
  const YARD_TO_M = 0.9144; // 1 yard = 0.9144 meters

  const getFabricPricePerUnit = (variant, selectedUnit) => {
    const storedUnit = variant.fabric_unit || 'm';
    const pricePerStoredUnit = Number(variant.base_selling_price || variant.price || 0);
    // Convert price if selling unit differs from stored unit
    if (storedUnit === selectedUnit) return pricePerStoredUnit;
    if (storedUnit === 'm' && selectedUnit === 'yd') return pricePerStoredUnit * YARD_TO_M; // price/m → price/yd
    if (storedUnit === 'yd' && selectedUnit === 'm') return pricePerStoredUnit / YARD_TO_M; // price/yd → price/m
    return pricePerStoredUnit;
  };

  // Convert qty to stored unit for stock deduction
  const toStoredUnit = (qty, selectedUnit, storedUnit) => {
    if (selectedUnit === storedUnit) return qty;
    if (selectedUnit === 'yd' && storedUnit === 'm') return qty * YARD_TO_M;
    if (selectedUnit === 'm' && storedUnit === 'yd') return qty / YARD_TO_M;
    return qty;
  };

  const confirmFabric = () => {
    const qty = parseFloat(fabricQty);
    if (!qty || qty <= 0) {
      toast.error('Enter a valid length');
      return;
    }
    const variant = fabricModal.variant;
    const storedUnit = variant.fabric_unit || 'm';
    const available = Number(variant.stock_qty_continuous || 0);
    // Convert entered qty to stored unit for stock check
    const qtyInStoredUnit = toStoredUnit(qty, fabricUnit, storedUnit);
    if (qtyInStoredUnit > available) {
      toast.error(`Only ${available}${storedUnit} available in stock`);
      return;
    }
    const pricePerUnit = getFabricPricePerUnit(variant, fabricUnit);
    const totalPrice = pricePerUnit * qty;
    addVariantToSession(
      {
        ...variant,
        price: totalPrice,
        base_selling_price: totalPrice,
        discountedPrice: totalPrice,
        discountApplied: 0,
        discountSource: 'none',
      },
      qtyInStoredUnit, // store in base unit for correct stock deduction
      null,
      fabricModal.barcodeValue,
      { length: qty, unit: fabricUnit, pricePerUnit, totalPrice, qtyInStoredUnit, storedUnit },
    );
    const toRecord = [fabricModal.barcodeValue, variant.barcode_value, variant.sku].filter(Boolean);
    updateSess(activeKey, { scannedBarcodes: [...sess.scannedBarcodes, ...toRecord] });
    toast.success(
      `Added: ${variant.product_name || variant.name} — ${qty}${fabricUnit} @ Rs ${pricePerUnit.toLocaleString()}/${fabricUnit}`,
    );
    setFabricModal(null);
    setFabricQty('');
    scanRef.current?.focus();
  };

  // ── Print ────────────────────────────────────────────────────────────────
  const printBill = () => {
    const area = document.getElementById('bill-print-area');
    if (!area) {
      toast.error('Nothing to print');
      return;
    }
    const printContents = area.innerHTML;
    const css = [
      'body{font-family:monospace;font-size:14px;margin:0;padding:8px;color:#000;background:#fff;width:72mm;}',
      '.logo-wrap{width:100%;height:100px;overflow:hidden;background:#fff;}',
      '.logo-wrap img{width:100%;height:100%;object-fit:cover;object-position:center center;}',
      'table{width:100%;border-collapse:collapse;font-size:13px;}',
      'th,td{padding:2px 4px;text-align:left;}',
      '.r{text-align:right;}',
      'hr{border:none;border-top:1px dashed #000;margin:4px 0;}',
      '.center{text-align:center;}',
      '@page{margin:2mm;size:80mm auto;}',
    ].join('');
    const html =
      '<html><head><title>Bill</title><style>' +
      css +
      '</style></head><body>' +
      printContents +
      '</body></html>';
    const iframe = document.createElement('iframe');
    iframe.style.cssText =
      'position:fixed;bottom:0;right:0;width:80mm;height:200px;border:none;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch (e) {}
      }, 2000);
    };
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
  };

  // ── Checkout ──────────────────────────────────────────────────────────────
  const doCheckout = async () => {
    if (!sess.items.length) {
      toast.error('No items in bill');
      return;
    }
    setCheckingOut(true);
    try {
      // ── For rental items: create each rental in the rental table ─────────
      const rentalItems = sess.items.filter((i) => i.rentalInfo);
      if (rentalItems.length > 0) {
        for (const item of rentalItems) {
          const ri = item.rentalInfo;
          if (!ri.customerId) {
            toast.error(
              'Customer is required for rental — please re-add the rental item with a customer selected',
            );
            setCheckingOut(false);
            return;
          }
          await rentalApi.create(branchId, {
            variantId: item.variantId,
            customerId: ri.customerId,
            reservedDate: ri.reservedDate,
            rentedDate: ri.rentedDate || null,
            dueDate: ri.dueDate,
            totalRentAmount: ri.totalRent,
            dailyRate: ri.days > 0 ? ri.totalRent / ri.days : ri.totalRent,
            advancePayment: ri.advancePayment || 0,
            advanceMethod: ri.advanceMethod || 'cash',
            depositAmount: ri.deposit || 0,
            notes: null,
            status: ri.rentedDate ? 'active' : 'reserved',
          });
        }
      }

      // ── For sale items: create billing session ────────────────────────────
      const saleItems = sess.items.filter((i) => !i.rentalInfo);
      if (saleItems.length > 0) {
        const session = await billingApi.createSession({ billType: 'sale' });
        for (const item of saleItems) {
          await billingApi.addItem(session.id, {
            variantId: item.variantId,
            quantity: item.qty,
            unitPrice: item.unitPrice,
            discountAmount: item.discount || 0,
            discountSource: item.discountSource || 'none',
          });
        }
        if (sess.disc || sess.tax) {
          await billingApi.applyTaxDisc(session.id, {
            taxAmount: sess.tax || 0,
            shopDiscount: sess.disc || 0,
          });
        }
        await billingApi.checkout(session.id, [{ method: payMethod, amount: salesSub }]);
      }

      const label = hasMixed ? 'Net Total' : rentalItems.length > 0 ? 'Rental' : 'Sale';
      toast.success(
        `✓ ${label} complete — Rs ${total.toLocaleString()}${saleItems.length > 0 ? ' via ' + payMethod.toUpperCase() : ''}`,
      );
      window.dispatchEvent(new CustomEvent('nxf:stock-updated'));
      printBill();
      await new Promise((r) => setTimeout(r, 300));
      if (sessions.length > 1) {
        setSessions((p) => p.filter((s) => s.key !== activeKey));
        setActiveKey(sessions.find((s) => s.key !== activeKey)?.key || 'A');
      } else {
        updateSess(activeKey, {
          items: [],
          disc: 0,
          tax: 0,
          billType: 'sale',
          scannedBarcodes: [],
        });
      }
      setBillPrev(false);
      setAmountReceived('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Session tabs */}
      <Flex gap={8} align="center">
        {sessions.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveKey(s.key)}
            style={{
              padding: '6px 18px',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              background: s.key === activeKey ? 'var(--col-accent)' : 'rgba(255,255,255,.06)',
              color: s.key === activeKey ? '#fff' : 'var(--col-text-2)',
              border:
                '0.5px solid ' +
                (s.key === activeKey ? 'var(--col-accent)' : 'var(--col-border-2)'),
              fontWeight: 500,
              fontSize: 13,
              transition: 'all var(--transition)',
            }}
          >
            Session {s.key} · {s.items.length} items
          </button>
        ))}
        {sessions.length < 2 && (
          <Btn variant="secondary" size="sm" onClick={openSession}>
            + New session
          </Btn>
        )}
        <Badge label="Max 2 concurrent sessions" variant="default" />
        {sessions.length > 1 && (
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => closeSession(activeKey)}
            style={{ marginLeft: 'auto', color: 'var(--col-red)' }}
          >
            Close session {activeKey}
          </Btn>
        )}
      </Flex>

      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}
      >
        {/* Left — scanner + items */}
        <Card>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                ref={scanRef}
                value={scanInput}
                onChange={(e) => onScanChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !adding) {
                    setShowSuggest(false);
                    addItem();
                  }
                  if (e.key === 'Escape') setShowSuggest(false);
                }}
                onBlur={() => setTimeout(() => setShowSuggest(false), 200)}
                placeholder="Scan barcode or type SKU / product name…"
                autoFocus
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--col-accent)',
                  background: 'var(--col-bg-3)',
                  color: 'var(--col-text)',
                  fontSize: 13,
                  outline: 'none',
                  boxShadow: '0 0 0 3px rgba(233,69,96,.12)',
                }}
              />
              {showSuggest && suggestions.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    zIndex: 300,
                    background: 'var(--col-bg-2)',
                    border: '0.5px solid var(--col-border-2)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 8px 24px rgba(0,0,0,.5)',
                    overflow: 'hidden',
                  }}
                >
                  {suggestions.map((s, idx) => (
                    <div
                      key={s.barcode_value || s.variant_sku || String(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickSuggestion(s);
                      }}
                      style={{
                        padding: '9px 14px',
                        cursor: 'pointer',
                        fontSize: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom:
                          idx < suggestions.length - 1 ? '0.5px solid var(--col-border)' : 'none',
                        background: 'transparent',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--col-bg-3)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--col-teal)',
                            fontSize: 11,
                            flexShrink: 0,
                          }}
                        >
                          {s.barcode_value || s.variant_sku}
                        </span>
                        <span
                          style={{
                            color: 'var(--col-text)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {s.product_name}
                        </span>
                        {s.brand_name && (
                          <span style={{ color: 'var(--col-text-3)', fontSize: 11, flexShrink: 0 }}>
                            {s.brand_name}
                          </span>
                        )}
                        {s.is_sku_only && (
                          <span style={{ fontSize: 10, color: 'var(--col-amber)', flexShrink: 0 }}>
                            no GRN yet
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexShrink: 0,
                          marginLeft: 12,
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--col-accent)' }}>
                          Rs {Number(s.price || s.base_selling_price || 0).toLocaleString()}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color:
                              (s.inventory_mode === 'continuous'
                                ? Number(s.stock_qty_continuous || 0)
                                : Number(s.stock_qty || 0)) > 0
                                ? 'var(--col-green)'
                                : 'var(--col-red)',
                          }}
                        >
                          {s.inventory_mode === 'continuous'
                            ? `${Number(s.stock_qty_continuous || 0)}${s.fabric_unit || 'm'} in stock`
                            : `${s.stock_qty} in stock`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <input
              id="bill-qty-input"
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !adding) addItem();
              }}
              min="0.25"
              step="0.25"
              placeholder="Qty"
              style={{
                width: 72,
                padding: '9px 10px',
                borderRadius: 'var(--radius-md)',
                border: '0.5px solid var(--col-border-2)',
                background: 'var(--col-bg-3)',
                color: 'var(--col-text)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <Btn onClick={addItem} disabled={adding}>
              {adding ? '…' : 'Add'}
            </Btn>
          </div>

          {sess.items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--col-text-3)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🧾</div>
              <div style={{ fontSize: 13 }}>Scan a barcode or type a SKU to start the bill</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Product', 'Qty', 'Price', 'You pay', ''].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 10px',
                        textAlign: 'left',
                        fontWeight: 500,
                        color: 'var(--col-text-2)',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                        borderBottom: '1px solid var(--col-border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sess.items.map((item, i) => (
                  <tr
                    key={item.variantId + '-' + i}
                    style={{ borderBottom: '0.5px solid var(--col-border)' }}
                  >
                    <td style={{ padding: '10px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 500 }}>{item.name}</div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--col-text-3)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {item.sku}
                      </div>
                      {item.type === 'rental' && <Badge label="Rental" variant="amber" size="sm" />}
                      {item.type === 'fabric' && <Badge label="Fabric" variant="teal" size="sm" />}
                      {item.fabricInfo && (
                        <div style={{ fontSize: 11, color: 'var(--col-teal)', marginTop: 2 }}>
                          {item.fabricInfo.length}
                          {item.fabricInfo.unit} @ Rs{' '}
                          {Number(item.fabricInfo.pricePerUnit).toLocaleString()}/
                          {item.fabricInfo.unit}
                        </div>
                      )}
                      {item.discount > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--col-green)', marginTop: 2 }}>
                          -{item.discountSource} Rs {Number(item.discount).toLocaleString()} off
                        </div>
                      )}
                      {item.rentalInfo && (
                        <div style={{ fontSize: 11, color: 'var(--col-teal)', marginTop: 2 }}>
                          {item.rentalInfo.reservedDate} → {item.rentalInfo.dueDate}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--col-text-2)' }}>{item.qty}</td>
                    <td
                      style={{
                        padding: '10px',
                        color: item.discount > 0 ? 'var(--col-text-3)' : 'var(--col-text)',
                        textDecoration: item.discount > 0 ? 'line-through' : 'none',
                      }}
                    >
                      Rs{' '}
                      {Number(
                        item.rentalInfo ? item.rentalInfo.totalRent : item.basePrice,
                      ).toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: '10px',
                        fontWeight: 600,
                        color: item.discount > 0 ? 'var(--col-green)' : 'var(--col-text)',
                      }}
                    >
                      Rs {Number(item.lineTotal).toLocaleString()}
                      {item.rentalInfo?.advancePayment > 0 && (
                        <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--col-amber)' }}>
                          advance Rs {Number(item.rentalInfo.advancePayment).toLocaleString()} · bal
                          Rs {Number(item.rentalInfo.balanceDue).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <button
                        onClick={() => removeItem(i)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--col-red)',
                          fontSize: 15,
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Right — summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                marginBottom: 14,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                color: 'var(--col-text-2)',
              }}
            >
              Bill summary
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  color: 'var(--col-text-2)',
                }}
              >
                <span>Subtotal</span>
                <span>Rs {sub.toLocaleString()}</span>
              </div>
              <Input
                label="Shop discount (Rs)"
                type="number"
                value={sess.disc || ''}
                onChange={(v) => updateSess(activeKey, { disc: parseFloat(v) || 0 })}
                placeholder="0"
              />
              <Input
                label="Tax (Rs)"
                type="number"
                value={sess.tax || ''}
                onChange={(v) => updateSess(activeKey, { tax: parseFloat(v) || 0 })}
                placeholder="0"
              />
              <Divider />
              {hasMixed ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--col-text-2)' }}>Sales Total</span>
                    <span>Rs {salesSub.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--col-text-2)' }}>Rental</span>
                    <span>Rs {rentalSub.toLocaleString()}</span>
                  </div>
                  <Divider />
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 700,
                      fontSize: 17,
                    }}
                  >
                    <span>Net Total</span>
                    <span style={{ color: 'var(--col-accent)' }}>Rs {total.toLocaleString()}</span>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 700,
                    fontSize: 17,
                  }}
                >
                  <span>{sess.billType === 'rental' ? 'Rental' : 'Total'}</span>
                  <span style={{ color: 'var(--col-accent)' }}>Rs {total.toLocaleString()}</span>
                </div>
              )}
              <Btn
                full
                onClick={() => setBillPrev(true)}
                disabled={!sess.items.length}
                style={{ marginTop: 4 }}
              >
                Preview bill
              </Btn>
            </div>
          </Card>
          <Card>
            <Select
              label="Bill type"
              value={sess.billType}
              onChange={(v) => updateSess(activeKey, { billType: v })}
              options={[
                { value: 'sale', label: 'Standard sale' },
                { value: 'rental', label: 'Rental bill' },
              ]}
            />
          </Card>
        </div>
      </div>

      {/* Bill preview modal */}
      {showBillPrev && (
        <Modal
          title="Bill preview"
          onClose={() => {
            setBillPrev(false);
            setAmountReceived('');
          }}
          width={520}
        >
          <div id="bill-print-area">
            <BillPreview
              sess={sess}
              sub={sub}
              total={total}
              salesSub={salesSub}
              rentalSub={rentalSub}
              hasMixed={hasMixed}
              user={user}
              branchSettings={branchSettings}
              amountReceived={parseFloat(amountReceived) || 0}
            />
          </div>
          <Select
            label="Payment method"
            value={payMethod}
            onChange={setPayMethod}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'card', label: 'Card' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
            ]}
          />

          {/* Amount received & balance */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--col-text-2)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Amount received (Rs)
              </span>
              <input
                type="number"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder={total.toLocaleString()}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--col-accent)',
                  background: 'var(--col-bg-3)',
                  color: 'var(--col-text)',
                  fontSize: 14,
                  outline: 'none',
                  fontWeight: 600,
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--col-text-2)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Balance to return (Rs)
              </span>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '0.5px solid var(--col-border-2)',
                  background: 'rgba(255,255,255,.04)',
                  fontSize: 14,
                  fontWeight: 700,
                  color:
                    parseFloat(amountReceived) >= total
                      ? 'var(--col-green)'
                      : parseFloat(amountReceived) > 0
                        ? 'var(--col-red)'
                        : 'var(--col-text-3)',
                }}
              >
                {parseFloat(amountReceived) > 0
                  ? parseFloat(amountReceived) >= total
                    ? `Rs ${(parseFloat(amountReceived) - total).toLocaleString()}`
                    : `Due Rs ${(total - parseFloat(amountReceived)).toLocaleString()}`
                  : '—'}
              </div>
            </div>
          </div>
          <Flex gap={10} justify="flex-end" style={{ marginTop: 16 }}>
            <Btn variant="secondary" onClick={() => setBillPrev(false)}>
              Cancel
            </Btn>
            <Btn variant="secondary" onClick={printBill}>
              🖨 Print preview
            </Btn>
            <Btn variant="success" onClick={doCheckout} disabled={checkingOut}>
              {checkingOut ? 'Processing…' : '✓ Confirm & Print'}
            </Btn>
          </Flex>
        </Modal>
      )}

      {/* Fabric length modal */}
      {fabricModal && (
        <Modal
          title={`Fabric — ${fabricModal.variant.product_name || fabricModal.variant.name}`}
          onClose={() => setFabricModal(null)}
          width={400}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Info */}
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(0,180,216,.08)',
                border: '0.5px solid rgba(0,180,216,.2)',
                fontSize: 12,
                color: 'var(--col-teal)',
              }}
            >
              <div>
                Price: Rs{' '}
                {Number(
                  fabricModal.variant.base_selling_price || fabricModal.variant.price || 0,
                ).toLocaleString()}{' '}
                per {fabricModal.variant.fabric_unit || 'm'}
              </div>
              {fabricModal.variant.fabric_width && (
                <div>
                  Width: {fabricModal.variant.fabric_width}
                  {fabricModal.variant.fabric_unit || 'm'}
                </div>
              )}
              {fabricModal.variant.fabric_design && (
                <div>Design: {fabricModal.variant.fabric_design}</div>
              )}
              <div>
                In stock: {Number(fabricModal.variant.stock_qty_continuous || 0).toLocaleString()}{' '}
                {fabricModal.variant.fabric_unit || 'm'}
              </div>
            </div>

            {/* Length input */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
                  Length *
                </span>
                <input
                  type="number"
                  value={fabricQty}
                  onChange={(e) => setFabricQty(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmFabric()}
                  placeholder="e.g. 2.5"
                  min="0.1"
                  step="0.1"
                  autoFocus
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--col-accent)',
                    background: 'var(--col-bg-3)',
                    color: 'var(--col-text)',
                    fontSize: 15,
                    outline: 'none',
                  }}
                />
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
                  Unit
                </span>
                <select
                  value={fabricUnit}
                  onChange={(e) => setFabricUnit(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '0.5px solid var(--col-border-2)',
                    background: 'var(--col-bg-3)',
                    color: 'var(--col-text)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                >
                  <option value="m">Meters (m)</option>
                  <option value="yd">Yards (yd)</option>
                </select>
              </div>
            </div>

            {/* Live price calculation */}
            {parseFloat(fabricQty) > 0 &&
              (() => {
                const pricePerUnit = getFabricPricePerUnit(fabricModal.variant, fabricUnit);
                const total = pricePerUnit * parseFloat(fabricQty);
                const storedUnit = fabricModal.variant.fabric_unit || 'm';
                const conversionNote =
                  fabricUnit !== storedUnit
                    ? ` (1${fabricUnit} = ${fabricUnit === 'yd' ? YARD_TO_M : (1 / YARD_TO_M).toFixed(4)}${storedUnit})`
                    : '';
                return (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(6,214,160,.08)',
                      border: '0.5px solid rgba(6,214,160,.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--col-text-2)' }}>
                        {fabricQty}
                        {fabricUnit} × Rs {pricePerUnit.toLocaleString()}/{fabricUnit}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--col-green)' }}>
                        Rs {total.toLocaleString()}
                      </span>
                    </div>
                    {conversionNote && (
                      <div style={{ fontSize: 11, color: 'var(--col-text-3)' }}>
                        Price converted from {storedUnit} to {fabricUnit}
                        {conversionNote}
                      </div>
                    )}
                  </div>
                );
              })()}

            <Flex gap={10} justify="flex-end">
              <Btn variant="secondary" onClick={() => setFabricModal(null)}>
                Cancel
              </Btn>
              <Btn
                onClick={confirmFabric}
                disabled={!parseFloat(fabricQty) || parseFloat(fabricQty) <= 0}
              >
                Add to bill
              </Btn>
            </Flex>
          </div>
        </Modal>
      )}

      {/* Rental date modal */}
      {rentalModal && (
        <Modal
          title={'Rental — ' + (rentalModal.variant.product_name || rentalModal.variant.name)}
          onClose={() => setRentalModal(null)}
          width={480}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Rate info */}
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(0,180,216,.08)',
                border: '0.5px solid rgba(0,180,216,.2)',
                fontSize: 12,
                color: 'var(--col-teal)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>
                Standard rate: Rs{' '}
                {Number(
                  rentalModal.variant.rental_price_per_day || rentalModal.variant.price || 0,
                ).toLocaleString()}
                /day
              </span>
              <span style={{ color: 'var(--col-text-3)' }}>Override below if needed</span>
            </div>

            {/* Customer search by NIC / name / phone */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--col-text-2)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Customer *
                </span>
                <button
                  onClick={() => setShowAddCust((v) => !v)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--col-accent)',
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  {showAddCust ? '− Cancel' : '+ New customer'}
                </button>
              </div>

              {showAddCust ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255,255,255,.04)',
                    border: '0.5px solid var(--col-border)',
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--col-accent)' }}>
                    Add new customer
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input
                      value={newCust.name}
                      onChange={(e) => setNewCust((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Full name *"
                      style={{
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '0.5px solid var(--col-border-2)',
                        background: 'var(--col-bg-3)',
                        color: 'var(--col-text)',
                        fontSize: 12,
                        outline: 'none',
                      }}
                    />
                    <input
                      value={newCust.nic}
                      onChange={(e) => setNewCust((p) => ({ ...p, nic: e.target.value }))}
                      placeholder="NIC number"
                      style={{
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '0.5px solid var(--col-border-2)',
                        background: 'var(--col-bg-3)',
                        color: 'var(--col-text)',
                        fontSize: 12,
                        outline: 'none',
                      }}
                    />
                    <input
                      value={newCust.phone}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setNewCust((p) => ({ ...p, phone: v }));
                      }}
                      onKeyDown={(e) => {
                        if (
                          !/[0-9]/.test(e.key) &&
                          !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(
                            e.key,
                          ) &&
                          !e.ctrlKey &&
                          !e.metaKey
                        )
                          e.preventDefault();
                        if (/[0-9]/.test(e.key) && newCust.phone.length >= 10) e.preventDefault();
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const text = e.clipboardData
                          .getData('text')
                          .replace(/\D/g, '')
                          .slice(0, 10);
                        setNewCust((p) => ({ ...p, phone: text }));
                      }}
                      placeholder="Phone number (10 digits)"
                      inputMode="numeric"
                      maxLength={10}
                      style={{
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '0.5px solid var(--col-border-2)',
                        background: 'var(--col-bg-3)',
                        color: 'var(--col-text)',
                        fontSize: 12,
                        outline: 'none',
                      }}
                    />
                    <input
                      value={newCust.email}
                      onChange={(e) => setNewCust((p) => ({ ...p, email: e.target.value }))}
                      placeholder="Email (optional)"
                      style={{
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '0.5px solid var(--col-border-2)',
                        background: 'var(--col-bg-3)',
                        color: 'var(--col-text)',
                        fontSize: 12,
                        outline: 'none',
                      }}
                    />
                  </div>
                  <button
                    onClick={saveNewCustomer}
                    disabled={savingCust}
                    style={{
                      padding: '7px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: 'var(--col-accent)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: savingCust ? 0.7 : 1,
                    }}
                  >
                    {savingCust ? 'Saving…' : 'Save customer'}
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input
                    value={custSearch}
                    onChange={(e) => searchCustomer(e.target.value)}
                    placeholder="Search by NIC, name or phone…"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: selectedCust
                        ? '1px solid var(--col-green)'
                        : '0.5px solid var(--col-border-2)',
                      background: 'var(--col-bg-3)',
                      color: 'var(--col-text)',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                  {selectedCust && (
                    <div style={{ fontSize: 11, color: 'var(--col-green)', marginTop: 3 }}>
                      ✓ {selectedCust.name}
                      {selectedCust.nic ? ' · NIC: ' + selectedCust.nic : ''}
                      {selectedCust.phone ? ' · ' + selectedCust.phone : ''}
                    </div>
                  )}
                  {custSearching && (
                    <div style={{ fontSize: 11, color: 'var(--col-text-3)', marginTop: 3 }}>
                      Searching…
                    </div>
                  )}
                  {custResults.length > 0 && !selectedCust && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 400,
                        background: 'var(--col-bg-2)',
                        border: '0.5px solid var(--col-border-2)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 8px 24px rgba(0,0,0,.5)',
                        overflow: 'hidden',
                        marginTop: 4,
                      }}
                    >
                      {custResults.map((c) => (
                        <div
                          key={c.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSelectedCust(c);
                            setCustSearch(c.name);
                            setCustResults([]);
                          }}
                          style={{
                            padding: '9px 14px',
                            cursor: 'pointer',
                            fontSize: 12,
                            borderBottom: '0.5px solid var(--col-border)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = 'var(--col-bg-3)')
                          }
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ fontWeight: 500 }}>{c.name}</span>
                          <span style={{ color: 'var(--col-text-3)', fontSize: 11 }}>
                            {c.nic ? 'NIC: ' + c.nic : ''}
                            {c.nic && c.phone ? ' · ' : ''}
                            {c.phone || ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dates — Reserved and Return only */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
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
                  Reserved date *
                </span>
                <input
                  type="date"
                  value={rentalDates.reservedDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRentalDates((p) => ({ ...p, reservedDate: v }));
                    setOverlapError(null);
                    checkAvailability(v, rentalDates.dueDate);
                  }}
                  min={new Date().toISOString().slice(0, 10)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '0.5px solid var(--col-border-2)',
                    background: 'var(--col-bg-3)',
                    color: 'var(--col-text)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
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
                  Rented date *
                </span>
                <input
                  type="date"
                  value={rentalDates.rentedDate || ''}
                  onChange={(e) => setRentalDates((p) => ({ ...p, rentedDate: e.target.value }))}
                  min={rentalDates.reservedDate || new Date().toISOString().slice(0, 10)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '0.5px solid var(--col-border-2)',
                    background: 'var(--col-bg-3)',
                    color: 'var(--col-text)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
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
                  Return date *
                </span>
                <input
                  type="date"
                  value={rentalDates.dueDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRentalDates((p) => ({ ...p, dueDate: v }));
                    setOverlapError(null);
                    checkAvailability(rentalDates.reservedDate, v);
                  }}
                  min={rentalDates.reservedDate || new Date().toISOString().slice(0, 10)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '0.5px solid var(--col-border-2)',
                    background: 'var(--col-bg-3)',
                    color: 'var(--col-text)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Custom rent price override */}
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
                Custom total rent (Rs) — optional
              </span>
              <input
                type="number"
                value={rentalDates.customTotal || ''}
                onChange={(e) => setRentalDates((p) => ({ ...p, customTotal: e.target.value }))}
                placeholder="Leave blank to calculate from daily rate × days"
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '0.5px solid var(--col-border-2)',
                  background: 'var(--col-bg-3)',
                  color: 'var(--col-text)',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--col-text-3)' }}>
                Enter a flat total — overrides the per-day calculation entirely
              </span>
            </div>

            {/* Live calculation */}
            {rentalDates.reservedDate &&
              rentalDates.dueDate &&
              rentalDates.dueDate > rentalDates.reservedDate &&
              (() => {
                const days = Math.ceil(
                  (new Date(rentalDates.dueDate) - new Date(rentalDates.reservedDate)) / 86400000,
                );
                const stdRate = Number(
                  rentalModal.variant.rental_price_per_day || rentalModal.variant.price || 0,
                );
                const customTotal = parseFloat(rentalDates.customTotal);
                const totalRent = customTotal || days * stdRate;
                return (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(6,214,160,.08)',
                      border: '0.5px solid rgba(6,214,160,.2)',
                      fontSize: 12,
                    }}
                  >
                    {customTotal ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--col-amber)' }}>
                          Custom total ({days} days)
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--col-green)' }}>
                          Rs {customTotal.toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          color: 'var(--col-text-2)',
                        }}
                      >
                        <span>
                          {days} days × Rs {stdRate.toLocaleString()}/day
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--col-green)' }}>
                          Rs {totalRent.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

            {/* Deposit */}
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
                Deposit (Rs) — refundable on return
              </span>
              <input
                type="number"
                value={rentalDates.deposit || ''}
                onChange={(e) => setRentalDates((p) => ({ ...p, deposit: e.target.value }))}
                placeholder="0"
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '0.5px solid var(--col-border-2)',
                  background: 'var(--col-bg-3)',
                  color: 'var(--col-text)',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>

            {/* Advance payment */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
                  Advance payment (Rs) — optional
                </span>
                <input
                  type="number"
                  value={rentalDates.advancePayment || ''}
                  onChange={(e) =>
                    setRentalDates((p) => ({ ...p, advancePayment: e.target.value }))
                  }
                  placeholder="0"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '0.5px solid var(--col-border-2)',
                    background: 'var(--col-bg-3)',
                    color: 'var(--col-text)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
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
                  Payment method
                </span>
                <select
                  value={rentalDates.advanceMethod || 'cash'}
                  onChange={(e) => setRentalDates((p) => ({ ...p, advanceMethod: e.target.value }))}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '0.5px solid var(--col-border-2)',
                    background: 'var(--col-bg-3)',
                    color: 'var(--col-text)',
                    fontSize: 13,
                    outline: 'none',
                  }}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
            </div>

            {/* Balance due indicator */}
            {parseFloat(rentalDates.advancePayment) > 0 &&
              rentalDates.reservedDate &&
              rentalDates.dueDate &&
              rentalDates.dueDate > rentalDates.reservedDate &&
              (() => {
                const days = Math.ceil(
                  (new Date(rentalDates.dueDate) - new Date(rentalDates.reservedDate)) / 86400000,
                );
                const stdRate = Number(
                  rentalModal.variant.rental_price_per_day || rentalModal.variant.price || 0,
                );
                const totalRent = parseFloat(rentalDates.customTotal) || days * stdRate;
                const advance = parseFloat(rentalDates.advancePayment) || 0;
                const balance = totalRent - advance;
                return (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: balance > 0 ? 'rgba(245,166,35,.08)' : 'rgba(6,214,160,.08)',
                      border: `0.5px solid ${balance > 0 ? 'rgba(245,166,35,.3)' : 'rgba(6,214,160,.25)'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: 'var(--col-text-2)' }}>Balance due on return</span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: balance > 0 ? 'var(--col-amber)' : 'var(--col-green)',
                      }}
                    >
                      {balance > 0 ? `Rs ${balance.toLocaleString()}` : 'Fully paid ✓'}
                    </span>
                  </div>
                );
              })()}

            {rentalDates.dueDate &&
              rentalDates.reservedDate &&
              rentalDates.dueDate <= rentalDates.reservedDate && (
                <div
                  style={{
                    color: 'var(--col-red)',
                    fontSize: 12,
                    padding: '6px 10px',
                    background: 'rgba(233,69,96,.08)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  ⚠ Return date must be after reserved date
                </div>
              )}

            {/* Overlap error — shown inline so user sees it without the toast disappearing */}
            {overlapError && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(233,69,96,.12)',
                  border: '1px solid rgba(233,69,96,.5)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>🚫</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--col-red)' }}>
                    Item not available — dates overlap
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--col-text-2)', marginTop: 3 }}>
                    Already booked from <strong>{overlapError.from}</strong> to{' '}
                    <strong>{overlapError.to}</strong>. Please choose different dates.
                  </div>
                </div>
              </div>
            )}

            <Flex gap={10} justify="flex-end" style={{ marginTop: 4 }}>
              <Btn variant="secondary" onClick={() => setRentalModal(null)}>
                Cancel
              </Btn>
              <Btn
                onClick={confirmRental}
                disabled={
                  checkingRental ||
                  !!overlapError ||
                  !selectedCust ||
                  !rentalDates.reservedDate ||
                  !rentalDates.rentedDate ||
                  !rentalDates.dueDate ||
                  rentalDates.dueDate <= rentalDates.reservedDate
                }
              >
                {checkingRental
                  ? 'Checking availability…'
                  : !selectedCust
                    ? 'Select customer first'
                    : !rentalDates.rentedDate
                      ? 'Enter rented date'
                      : 'Reserve & add to bill'}
              </Btn>
            </Flex>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── EAN-13 barcode SVG for bill printing ─────────────────────────────────────
function billBarcodeSVG(code) {
  if (!code || !/^\d{13}$/.test(code)) return null;
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
  const enc = [
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
  const digits = code.split('').map(Number);
  let bars = '101';
  for (let i = 0; i < 6; i++) bars += (enc[digits[0]][i] === 'L' ? L : G)[digits[i + 1]];
  bars += '01010';
  for (let i = 7; i < 13; i++) bars += R[digits[i]];
  bars += '101';
  const bw = 1.5;
  const bh = 28;
  const sx = 4;
  const w = sx * 2 + bars.length * bw;
  let rects = '';
  let x = sx;
  for (let i = 0; i < bars.length; i++) {
    if (bars[i] === '1') rects += `<rect x="${x}" y="0" width="${bw}" height="${bh}" fill="#000"/>`;
    x += bw;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${bh}" width="${w}" height="${bh}">${rects}</svg>`;
}

function BillPreview({
  sess,
  sub,
  total,
  salesSub,
  rentalSub,
  hasMixed,
  user,
  branchSettings,
  amountReceived = 0,
}) {
  const isRental = sess.billType === 'rental';
  const shopName =
    branchSettings?.shop_name || user?.shopName || user?.businessName || 'Nexifly Store';
  const shopAddr = branchSettings?.shop_address || user?.shopAddress || '';
  const shopContact = branchSettings?.shop_contact || user?.shopContact || '';
  const shopContact2 = branchSettings?.shop_contact2 || '';
  const purchaseNote = branchSettings?.purchase_bill_note || '';
  const rentalNote = branchSettings?.rental_bill_note || '';
  const logoUrl = localStorage.getItem('nxf_bill_logo') || branchSettings?.logo_url || '';
  const hr = <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }} />;

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        lineHeight: 1.8,
        marginBottom: 16,
        border: '0.5px solid var(--col-border)',
        color: '#000',
      }}
    >
      {/* Business header */}
      <div style={{ textAlign: 'center', marginBottom: 6, background: '#fff' }}>
        {logoUrl && (
          <div style={{ width: '100%', background: '#fff' }}>
            <img
              src={logoUrl}
              alt="logo"
              style={{ width: '100%', display: 'block' }}
              onError={(e) => (e.target.style.display = 'none')}
            />
          </div>
        )}
        <div
          style={{
            fontWeight: 700,
            fontSize: 16,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: '#000',
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          {shopName}
        </div>
        {shopAddr && <div style={{ fontSize: 11, color: '#333' }}>{shopAddr}</div>}
        {shopContact && <div style={{ fontSize: 11, color: '#333' }}>Tel: {shopContact}</div>}
      </div>
      {hr}

      {/* Items — no discount column, discount shown under item name */}
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px dashed #000' }}>
            <th style={{ textAlign: 'left', paddingBottom: 3 }}>Item</th>
            <th style={{ textAlign: 'right', paddingBottom: 3, paddingLeft: 8 }}>Price</th>
            <th style={{ textAlign: 'right', paddingBottom: 3, paddingLeft: 8 }}>Qty</th>
            <th style={{ textAlign: 'right', paddingBottom: 3, paddingLeft: 8 }}>Disc</th>
            <th style={{ textAlign: 'right', paddingBottom: 3, paddingLeft: 8 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {sess.items.map((item, i) => (
            <tr key={item.variantId + '-bill-' + i}>
              <td style={{ paddingTop: 3, paddingBottom: 1 }}>
                <div>{item.name}</div>
                {item.fabricInfo && (
                  <div style={{ fontSize: 11 }}>
                    {item.fabricInfo.length}
                    {item.fabricInfo.unit} @ Rs{' '}
                    {Number(item.fabricInfo.pricePerUnit).toLocaleString()}/{item.fabricInfo.unit}
                  </div>
                )}
                {item.barcodeValue && (
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: 'monospace',
                      letterSpacing: 1,
                      color: '#333',
                    }}
                  >
                    {item.barcodeValue}
                  </div>
                )}
                {item.rentalInfo && (
                  <div style={{ fontSize: 11 }}>
                    Reserved: {item.rentalInfo.reservedDate} | Rented:{' '}
                    {item.rentalInfo.rentedDate || '—'} | Return: {item.rentalInfo.dueDate}
                  </div>
                )}
              </td>
              <td style={{ textAlign: 'right', paddingTop: 3, paddingLeft: 8, verticalAlign: 'top' }}>
                {Number(item.basePrice).toLocaleString()}
              </td>
              <td style={{ textAlign: 'right', paddingTop: 3, paddingLeft: 8, verticalAlign: 'top' }}>
                {item.qty}
              </td>
              <td
                style={{
                  textAlign: 'right',
                  paddingTop: 3,
                  paddingLeft: 8,
                  verticalAlign: 'top',
                  color: item.discount > 0 ? '#c00' : '#888',
                }}
              >
                {item.discount > 0 ? '-' + Number(item.discount).toLocaleString() : '—'}
              </td>
              <td
                style={{ textAlign: 'right', paddingTop: 3, paddingLeft: 8, verticalAlign: 'top', fontWeight: 600 }}
              >
                {Number(item.lineTotal).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals section — only bill-level adjustments shown here */}
      {hr}
      {(sess.tax > 0 || sess.disc > 0) && (
        <div style={{ fontSize: 11 }}>
          {sess.tax > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Tax</span>
              <span>Rs {sess.tax}</span>
            </div>
          )}
          {sess.disc > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Bill discount</span>
              <span>-Rs {sess.disc}</span>
            </div>
          )}
        </div>
      )}
      {hr}
      {hasMixed ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>Sales Total</span>
            <span>Rs {salesSub.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>Rental</span>
            <span>Rs {rentalSub.toLocaleString()}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              fontSize: 15,
              marginTop: 2,
            }}
          >
            <span>NET TOTAL</span>
            <span>Rs {total.toLocaleString()}</span>
          </div>
        </>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          <span>{isRental ? 'RENTAL' : 'TOTAL'}</span>
          <span>Rs {total.toLocaleString()}</span>
        </div>
      )}
      {hr}
      {/* Amount received & balance */}
      {amountReceived > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span>Amount received</span>
            <span>Rs {Number(amountReceived).toLocaleString()}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {/* Change to give back, or the amount still owed if less was received */}
            <span>{amountReceived >= total ? 'Balance' : 'Amount due'}</span>
            <span>Rs {Math.abs(amountReceived - total).toLocaleString()}</span>
          </div>
        </>
      )}
      {hr}
      {sess.items
        .filter((i) => i.type === 'rental')
        .map((item, i) => (
          <div key={i} style={{ fontSize: 11, marginBottom: 4 }}>
            <div style={{ fontWeight: 600 }}>{item.name}</div>
            <div>Reserved : {item.rentalInfo?.reservedDate || '___________'}</div>
            <div>Rented : {item.rentalInfo?.rentedDate || '___________'}</div>
            <div>Return : {item.rentalInfo?.dueDate || '___________'}</div>
            {item.rentalInfo?.deposit > 0 && (
              <div>
                Deposit : Rs {Number(item.rentalInfo.deposit).toLocaleString()} (refundable on
                return)
              </div>
            )}
            {item.rentalInfo?.advancePayment > 0 && (
              <>
                <div>
                  Advance : Rs {Number(item.rentalInfo.advancePayment).toLocaleString()} (
                  {item.rentalInfo.advanceMethod})
                </div>
                <div>
                  Balance : Rs {Number(item.rentalInfo.balanceDue).toLocaleString()} (due on return)
                </div>
              </>
            )}
          </div>
        ))}

      {/* Footer notes */}
      <div style={{ textAlign: 'center', fontSize: 11, marginTop: 4 }}>
        {hasMixed ? (
          <>
            <div>{purchaseNote}</div>
            <div style={{ margin: '3px 0', letterSpacing: 1 }}>**************</div>
            <div>{rentalNote}</div>
          </>
        ) : isRental ? (
          <div>{rentalNote}</div>
        ) : (
          <div>{purchaseNote}</div>
        )}
        <div style={{ marginTop: 2 }}>Thanks for Shopping...!!!</div>
        <div style={{ marginTop: 4, color: '#666' }}>Powered by Nexifly</div>
        <div style={{ color: '#666' }}>nexifly.lk</div>
        <div style={{ color: '#666' }}>Tel: 0775257595</div>
      </div>
    </div>
  );
}
