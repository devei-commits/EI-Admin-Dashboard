import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Modal } from './Modal';
import type { SaleOrder, SalesOrderStatus } from '../../types/orderFulfillment';
import { SALES_ORDER_STATUS_OPTIONS } from '../../types/orderFulfillment';
import {
  fetchClientProductPrice,
  fetchCustomers,
  fetchProducts,
  type CustomerOption,
  type ProductOption,
} from '../../services/fulfillment.service';
import { masterPickerLabelSuffix } from '../../constants/masterApprovalStatus';
import {
  parseStagedPaymentTerms,
  serializeStagedPaymentTerms,
  validateStagedPercents,
} from '../../lib/stagedPaymentTerms';
import { cleanAddress } from '../../utils/orderFulfillmentUtils';
import { computeSuggestPanelRect, getScrollParents, type SuggestPanelRect } from '../../utils/suggestPanelPosition';

interface EditableItem {
  sku: string;
  productName: string;
  pack: string;
  orderedQty: number;
  unitPrice: number;
  mrp?: number | null;
  /** Individual per-line tax — % and ₹ amount, kept in sync with each other (never a platform default). */
  taxPct: number;
  taxAmount: number;
}

interface EditSOModalProps {
  isOpen: boolean;
  saleOrder: SaleOrder | null;
  canEdit: boolean;
  lockReason?: string;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (payload: {
    customer: string;
    customerCity: string;
    orderDate: string;
    dueDate: string;
    priority: 'normal' | 'high';
    shipAddress: string;
    paymentTerms: string;
    notes: string;
    salesOrderStatus?: SalesOrderStatus;
    items: Array<EditableItem & { mrp?: number | null; taxPct?: number; taxAmount?: number }>;
  }) => Promise<void> | void;
}

const DEFAULT_STAGED = { advance_pct: 0, pre_shipment_pct: 100, post_shipment_pct: 0, credit_days: 30 };
const MAX_PRODUCT_SUGGESTIONS = 100;
const SUGGEST_LIST_BOX_CLASS =
  'fixed z-[10050] overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-[var(--e2)] ring-1 ring-black/5';
const SUGGEST_ITEM_CLASS =
  'flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors hover:bg-surface-3 focus:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] border-b border-hairline last:border-0';
const SUGGEST_ITEM_PRIMARY_CLASS = 'text-sm font-medium text-ink';
const SUGGEST_ITEM_META_CLASS = 'text-xs text-ink-3';

// Order items grid — Product gets the only `fr` track so it absorbs the modal's extra width and
// never truncates long names; every other column is a fixed px width. Header row and item rows
// share this exact template so columns stay aligned.
const ITEM_ROW_GRID_COLS =
  'grid grid-cols-[2.25rem_minmax(260px,3fr)_120px_70px_100px_120px_100px_90px_110px_130px_70px] gap-2';

function parseProductIdFromOption(product: ProductOption): number | null {
  const m = /^PR-(\d+)$/i.exec(String(product.id || '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function packSizeFromProductRecord(product: ProductOption | undefined): string {
  const p = String(product?.pack || '').trim();
  return p || '0';
}

function toEditableItems(order: SaleOrder | null): EditableItem[] {
  if (!order) return [];
  return (order.items || []).map((item) => ({
    sku: String(item.sku || ''),
    productName: String(item.productName || ''),
    pack: String(item.pack || ''),
    orderedQty: Number(item.orderedQty || 0),
    unitPrice: Number(item.unitPrice || 0),
    mrp: item.mrp ?? null,
    taxPct: Number(item.taxPct || 0),
    taxAmount: Number(item.taxAmount || 0),
  }));
}

export const EditSOModal: React.FC<EditSOModalProps> = ({
  isOpen,
  saleOrder,
  canEdit,
  lockReason,
  isSaving = false,
  onClose,
  onSave,
}) => {
  const [customer, setCustomer] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const [salesOrderStatus, setSalesOrderStatus] = useState<SalesOrderStatus>('Draft');
  const [shipAddress, setShipAddress] = useState('');
  const [advancePctStr, setAdvancePctStr] = useState(String(DEFAULT_STAGED.advance_pct));
  const [preShipmentPctStr, setPreShipmentPctStr] = useState(String(DEFAULT_STAGED.pre_shipment_pct));
  const [postShipmentPctStr, setPostShipmentPctStr] = useState(String(DEFAULT_STAGED.post_shipment_pct));
  const [creditDaysStr, setCreditDaysStr] = useState(String(DEFAULT_STAGED.credit_days));
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const errorBannerRef = useRef<HTMLDivElement | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [priceHints, setPriceHints] = useState<Record<number, string>>({});
  const priceResolveGenRef = useRef(0);
  /** Which SO the form has hydrated — prevents re-hydration (and wiping in-progress edits) on parent re-renders. */
  const hydratedForRef = useRef<string | null>(null);
  const [activeProductSuggestIndex, setActiveProductSuggestIndex] = useState<number | null>(null);
  const [suggestPanelRect, setSuggestPanelRect] = useState<SuggestPanelRect | null>(null);
  const suggestPanelRef = useRef<HTMLDivElement | null>(null);
  const productInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!saleOrder || !isOpen) { hydratedForRef.current = null; return; }
    // Hydrate the form once per opened SO. Re-running on every `saleOrder` prop
    // reference change (parent re-render) would clobber in-progress edits (unit
    // price / MRP reset to the saved values).
    const key = String(saleOrder.soNo ?? '');
    if (hydratedForRef.current === key) return;
    hydratedForRef.current = key;
    setCustomer(String(saleOrder.customer || ''));
    setCustomerCity(String(saleOrder.customerCity || ''));
    setOrderDate(String(saleOrder.orderDate || ''));
    setDueDate(String(saleOrder.dueDate || ''));
    setPriority(saleOrder.priority === 'high' ? 'high' : 'normal');
    // Hydrate the authoritative order status; default to Draft when the SO has none yet.
    setSalesOrderStatus(
      (SALES_ORDER_STATUS_OPTIONS.find((o) => o.value === saleOrder.orderStatus)?.value) || 'Draft'
    );
    setShipAddress(cleanAddress(String(saleOrder.shipAddress || ''), String(saleOrder.customer || '')));
    const staged = parseStagedPaymentTerms(String(saleOrder.paymentTerms || '')) || DEFAULT_STAGED;
    setAdvancePctStr(String(staged.advance_pct));
    setPreShipmentPctStr(String(staged.pre_shipment_pct));
    setPostShipmentPctStr(String(staged.post_shipment_pct));
    setCreditDaysStr(String(staged.credit_days));
    setNotes(String(saleOrder.notes || ''));
    setItems(toEditableItems(saleOrder));
    setErrors([]);
    setPriceHints({});
  }, [saleOrder, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    Promise.all([fetchProducts(), fetchCustomers()])
      .then(([productList, customerList]) => {
        if (cancelled) return;
        setProducts(productList);
        setCustomers(customerList);
      })
      .catch((err) => {
        console.error('Failed to load edit SO lookups:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    const selected = customers.find((c) => c.name === customer.trim());
    setSelectedCustomerId(selected?.id ?? null);
  }, [customers, customer]);

  const updateSuggestPanelPosition = useCallback(() => {
    if (activeProductSuggestIndex == null) {
      setSuggestPanelRect(null);
      return;
    }
    const el = productInputRefs.current[activeProductSuggestIndex];
    if (!el) return;
    setSuggestPanelRect(computeSuggestPanelRect(el));
  }, [activeProductSuggestIndex]);

  const focusProductSuggest = useCallback((index: number) => {
    setActiveProductSuggestIndex(index);
    requestAnimationFrame(() => {
      const el = productInputRefs.current[index];
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (el) setSuggestPanelRect(computeSuggestPanelRect(el));
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setActiveProductSuggestIndex(null);
      setSuggestPanelRect(null);
    }
  }, [isOpen]);

  useLayoutEffect(() => {
    updateSuggestPanelPosition();
    if (activeProductSuggestIndex == null) return undefined;

    const anchor = productInputRefs.current[activeProductSuggestIndex];
    const scrollParents = getScrollParents(anchor ?? null);

    window.addEventListener('scroll', updateSuggestPanelPosition, true);
    window.addEventListener('resize', updateSuggestPanelPosition);
    scrollParents.forEach((node) => node.addEventListener('scroll', updateSuggestPanelPosition, { passive: true }));

    return () => {
      window.removeEventListener('scroll', updateSuggestPanelPosition, true);
      window.removeEventListener('resize', updateSuggestPanelPosition);
      scrollParents.forEach((node) => node.removeEventListener('scroll', updateSuggestPanelPosition));
    };
  }, [activeProductSuggestIndex, updateSuggestPanelPosition, items]);

  useEffect(() => {
    if (activeProductSuggestIndex == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setActiveProductSuggestIndex(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [activeProductSuggestIndex]);

  useEffect(() => {
    if (activeProductSuggestIndex == null) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (suggestPanelRef.current?.contains(t)) return;
      const inp = productInputRefs.current[activeProductSuggestIndex];
      if (inp?.contains(t)) return;
      setActiveProductSuggestIndex(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [activeProductSuggestIndex]);

  const productsByName = useMemo(() => {
    const map = new Map<string, ProductOption>();
    products.forEach((p) => map.set(p.name, p));
    return map;
  }, [products]);

  const getProductSuggestionsForIndex = useCallback(
    (index: number): ProductOption[] => {
      const currentValue = String(items[index]?.productName || '').trim().toLowerCase();
      const takenByOtherRows = new Set(
        items
          .map((it, idx) => (idx !== index ? it.productName : ''))
          .filter(Boolean)
      );
      return products
        .filter((p) => !takenByOtherRows.has(p.name) || p.name === items[index]?.productName)
        .filter((p) => {
          if (!currentValue) return true;
          return p.name.toLowerCase().includes(currentValue) || p.sku.toLowerCase().includes(currentValue);
        })
        .slice(0, MAX_PRODUCT_SUGGESTIONS);
    },
    [items, products]
  );

  const subtotalValue = useMemo(
    () => items.reduce((sum, it) => sum + Number(it.orderedQty || 0) * Number(it.unitPrice || 0), 0),
    [items]
  );
  const taxTotalValue = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.taxAmount) || 0), 0),
    [items]
  );
  // Final payable total: line subtotals + each line's own individual tax. No hardcoded/flat GST added.
  const totalValue = subtotalValue + taxTotalValue;

  const resolveLinePrice = useCallback(
    async (index: number, snapshot: EditableItem[], clientId: number) => {
      const line = snapshot[index];
      if (!line?.productName?.trim() || !clientId) return;
      const product = productsByName.get(line.productName.trim());
      if (!product) return;
      const productId = parseProductIdFromOption(product);
      if (!productId) return;

      const gen = ++priceResolveGenRef.current;
      try {
        const result = await fetchClientProductPrice({
          clientId,
          productId,
          quantity: line.orderedQty,
        });
        if (gen !== priceResolveGenRef.current) return;
        const fromTier = result.source === 'client_price_list_tier';
        const fromDefaultRate = result.source === 'client_price_list_rate';
        const autoPrice = result.price_per_unit != null && result.price_per_unit > 0;
        setItems((prev) => {
          if (prev[index]?.productName?.trim() !== line.productName.trim()) return prev;
          // Only auto-fill when the client price list actually yields a price.
          // No tier / no price → keep the existing (saved or manually-entered) unit price;
          // never wipe it to 0 (that reset was blocking manual pricing).
          if (!(fromTier || (fromDefaultRate && autoPrice))) return prev;
          const next = [...prev];
          next[index] = { ...next[index], unitPrice: Number(result.price_per_unit) };
          return next;
        });
        setPriceHints((prev) => ({
          ...prev,
          [index]:
            result.message ||
            (fromTier || fromDefaultRate
              ? 'Price from client price list.'
              : 'No tier match in client price list for this quantity.'),
        }));
      } catch (err) {
        console.error('Failed to resolve client product price in edit modal:', err);
      }
    },
    [productsByName]
  );

  const updateItem = (index: number, patch: Partial<EditableItem>) => {
    setItems((prev) => {
      const next = prev.map((it, idx) => (idx === index ? { ...it, ...patch } : it));
      if (patch.productName !== undefined) {
        const selected = productsByName.get(String(patch.productName || '').trim());
        if (selected) {
          next[index] = {
            ...next[index],
            productName: selected.name,
            sku: selected.sku,
            pack: packSizeFromProductRecord(selected),
            unitPrice: selectedCustomerId ? 0 : Number(selected.price || 0),
            mrp: selected.price > 0 ? Number(selected.price) : null,
            // Different product — the previously entered tax no longer applies.
            taxPct: 0,
            taxAmount: 0,
          };
        } else {
          next[index] = {
            ...next[index],
            sku: '',
            pack: '',
            unitPrice: 0,
            mrp: null,
            taxPct: 0,
            taxAmount: 0,
          };
        }
      } else if (patch.orderedQty !== undefined || patch.unitPrice !== undefined) {
        // Qty / price changed — tax % is the anchor, so re-derive the ₹ amount from it and the new base.
        const base = Number(next[index].orderedQty || 0) * Number(next[index].unitPrice || 0);
        next[index] = { ...next[index], taxAmount: Math.round(base * (next[index].taxPct || 0)) / 100 };
      }
      return next;
    });
  };

  /** Line subtotal (qty × unit price), before tax. */
  const lineBase = (item: EditableItem) => Number(item.orderedQty || 0) * Number(item.unitPrice || 0);

  /** User edited the % field — recompute the ₹ amount from it (% is the anchor). */
  const handleTaxPctChange = (index: number, pctStr: string) => {
    const pct = Math.max(0, Number(pctStr) || 0);
    setItems((prev) => {
      const next = [...prev];
      const base = lineBase(next[index]);
      next[index] = { ...next[index], taxPct: pct, taxAmount: Math.round(base * pct) / 100 };
      return next;
    });
  };

  /** User edited the ₹ amount field directly — back-derive the effective % from it. */
  const handleTaxAmountChange = (index: number, amtStr: string) => {
    const amt = Math.max(0, Number(amtStr) || 0);
    setItems((prev) => {
      const next = [...prev];
      const base = lineBase(next[index]);
      const pct = base > 0 ? Math.round((amt / base) * 10000) / 100 : 0;
      next[index] = { ...next[index], taxAmount: amt, taxPct: pct };
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { sku: '', productName: '', pack: '', orderedQty: 1, unitPrice: 0, mrp: null, taxPct: 0, taxAmount: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const validate = (): string[] => {
    const nextErrors: string[] = [];
    if (!customer.trim()) nextErrors.push('Customer is required.');
    if (!orderDate) nextErrors.push('Order date is required.');
    if (!dueDate) nextErrors.push('Due date is required.');
    if (items.length === 0) nextErrors.push('At least one item is required.');

    items.forEach((item, index) => {
      const row = index + 1;
      if (!item.productName.trim()) nextErrors.push(`Item ${row}: product name is required.`);
      else if (!productsByName.has(item.productName.trim())) {
        nextErrors.push(`Item ${row}: select a valid product from the list (search by name or SKU).`);
      }
      if (Number(item.orderedQty) <= 0) nextErrors.push(`Item ${row}: quantity must be greater than 0.`);
      if (Number(item.unitPrice) <= 0) nextErrors.push(`Item ${row}: unit price must be greater than 0.`);
    });
    const adv = Number(advancePctStr);
    const pre = Number(preShipmentPctStr);
    const post = Number(postShipmentPctStr);
    const pctErr = validateStagedPercents(adv, pre, post);
    if (pctErr) nextErrors.push(pctErr);
    return nextErrors;
  };

  // Keep a stable ref to items so the customer-change effect doesn't need items in its dep array
  // (avoids re-running price lookup on every qty / pack keystroke).
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => {
    if (!selectedCustomerId || !isOpen) return;
    const timer = window.setTimeout(() => {
      const snap = [...itemsRef.current];
      snap.forEach((_, index) => {
        void resolveLinePrice(index, snap, selectedCustomerId);
      });
    }, 280);
    return () => window.clearTimeout(timer);
    // Reads itemsRef.current (a ref) so it fires only on customer / open / resolver change, not per keystroke.
  }, [selectedCustomerId, isOpen, resolveLinePrice]);

  useEffect(() => {
    if (errors.length === 0) return;
    const el = errorBannerRef.current;
    if (!el) return;
    // Scrolls the modal body (nearest scrollable ancestor), not the page behind it.
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Focus so keyboard and screen-reader users land on the message too.
    el.focus({ preventScroll: true });
    // `errors` is a fresh array on every failed Save, so repeat attempts re-trigger this.
  }, [errors]);

  const handleSave = async () => {
    if (!canEdit || isSaving) return;
    const nextErrors = validate();
    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors([]);
    const adv = Number(advancePctStr);
    const pre = Number(preShipmentPctStr);
    const post = Number(postShipmentPctStr);
    const cd = Math.max(0, Math.floor(Number(creditDaysStr) || 0));
    const paymentTerms = serializeStagedPaymentTerms({
      advance_pct: adv,
      pre_shipment_pct: pre,
      post_shipment_pct: post,
      credit_days: cd,
    });

    await onSave({
      customer: customer.trim(),
      customerCity: customerCity.trim(),
      orderDate,
      dueDate,
      priority,
      shipAddress: shipAddress.trim(),
      paymentTerms,
      notes: notes.trim(),
      salesOrderStatus,
      items: items.map((item) => ({
        sku: item.sku.trim(),
        productName: item.productName.trim(),
        pack: item.pack.trim(),
        orderedQty: Number(item.orderedQty || 0),
        unitPrice: Number(item.unitPrice || 0),
        mrp: item.mrp ?? null,
        taxPct: Number(item.taxPct || 0),
        taxAmount: Number(item.taxAmount || 0),
      })),
    });
  };

  if (!saleOrder) return null;

  const productSuggestList =
    activeProductSuggestIndex != null
      ? getProductSuggestionsForIndex(activeProductSuggestIndex)
      : [];
  const suggestPortal =
    activeProductSuggestIndex != null && suggestPanelRect && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={suggestPanelRef}
            role="listbox"
            className={SUGGEST_LIST_BOX_CLASS}
            style={{
              top: suggestPanelRect.top,
              left: suggestPanelRect.left,
              width: suggestPanelRect.width,
              maxHeight: suggestPanelRect.maxHeight,
            }}
          >
            {productSuggestList.length === 0 ? (
              <div className={`${SUGGEST_ITEM_CLASS} cursor-default hover:bg-transparent`}>
                <span className={SUGGEST_ITEM_META_CLASS}>No matching products. Try name or SKU.</span>
              </div>
            ) : (
              productSuggestList.map((p) => (
                <button
                  key={`${p.id}-${p.sku}`}
                  type="button"
                  role="option"
                  className={SUGGEST_ITEM_CLASS}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    updateItem(activeProductSuggestIndex, { productName: p.name });
                    setActiveProductSuggestIndex(null);
                  }}
                >
                  <span className={SUGGEST_ITEM_PRIMARY_CLASS}>
                    {p.name}
                    {masterPickerLabelSuffix(p.approvalStatus)}
                  </span>
                  <span className={SUGGEST_ITEM_META_CLASS}>
                    SKU {p.sku}
                    {p.pack ? ` · ${p.pack}` : ''}
                  </span>
                </button>
              ))
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={() => {
          setActiveProductSuggestIndex(null);
          onClose();
        }}
        title={`Edit Sale Order — ${saleOrder.soNo}`}
        size="2xl"
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm font-semibold text-ink-2 bg-surface hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canEdit || isSaving}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand text-white hover:bg-brand-press disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
        {!canEdit && (
          <div className="rounded-lg border border-[color:var(--st-amber-fg)]/30 bg-warn-soft px-3 py-2 text-sm text-warn">
            {lockReason || 'Editing is locked for this sale order.'}
          </div>
        )}

        {errors.length > 0 && (
          <div
            ref={errorBannerRef}
            role="alert"
            tabIndex={-1}
            className="rounded-lg border border-[color:var(--st-red-fg)]/30 bg-err-soft px-3 py-2 scroll-mt-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--st-red-fg)]/40"
          >
            <ul className="list-disc list-inside text-sm text-err">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ink-3 mb-1">Customer</label>
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} disabled={!canEdit} aria-label="Customer" className="w-full border border-border rounded-lg px-3 py-2 text-sm disabled:bg-surface-3" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-3 mb-1">Customer city</label>
            <input value={customerCity} onChange={(e) => setCustomerCity(e.target.value)} disabled={!canEdit} aria-label="Customer city" className="w-full border border-border rounded-lg px-3 py-2 text-sm disabled:bg-surface-3" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-3 mb-1">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as 'normal' | 'high')} disabled={!canEdit} aria-label="Priority" className="w-full border border-border rounded-lg px-3 py-2 text-sm disabled:bg-surface-3">
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-3 mb-1">SO status</label>
            <select
              value={salesOrderStatus}
              onChange={(e) => setSalesOrderStatus(e.target.value as SalesOrderStatus)}
              disabled={!canEdit}
              aria-label="SO status"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm disabled:bg-surface-3"
            >
              {SALES_ORDER_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-ink-3">Draft or Cancelled orders are hidden from Planning → PIS Extracted.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-3 mb-1">Order date</label>
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} disabled={!canEdit} aria-label="Order date" className="w-full border border-border rounded-lg px-3 py-2 text-sm disabled:bg-surface-3" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-3 mb-1">Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!canEdit} aria-label="Due date" className="w-full border border-border rounded-lg px-3 py-2 text-sm disabled:bg-surface-3" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-ink-3 mb-1">Shipping address</label>
            <textarea value={shipAddress} onChange={(e) => setShipAddress(e.target.value)} disabled={!canEdit} rows={3} aria-label="Shipping address" className="w-full border border-border rounded-lg px-3 py-2 text-sm disabled:bg-surface-3 resize-none" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-ink-3 mb-1">Payment terms (staged)</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={0} max={100} step="0.01" value={advancePctStr} onChange={(e) => setAdvancePctStr(e.target.value)} disabled={!canEdit} aria-label="Advance %" className="w-full border border-border rounded-lg px-3 py-2 text-sm disabled:bg-surface-3" placeholder="Advance %" />
              <input type="number" min={0} max={100} step="0.01" value={preShipmentPctStr} onChange={(e) => setPreShipmentPctStr(e.target.value)} disabled={!canEdit} aria-label="Pre-shipment %" className="w-full border border-border rounded-lg px-3 py-2 text-sm disabled:bg-surface-3" placeholder="Pre-shipment %" />
              <input type="number" min={0} max={100} step="0.01" value={postShipmentPctStr} onChange={(e) => setPostShipmentPctStr(e.target.value)} disabled={!canEdit} aria-label="Post-shipment %" className="w-full border border-border rounded-lg px-3 py-2 text-sm disabled:bg-surface-3" placeholder="Post-shipment %" />
              <input type="number" min={0} step={1} value={creditDaysStr} onChange={(e) => setCreditDaysStr(e.target.value)} disabled={!canEdit} aria-label="Credit days" className="w-full border border-border rounded-lg px-3 py-2 text-sm disabled:bg-surface-3" placeholder="Credit days" />
            </div>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-ink-3 mb-1">Total value</label>
            <div className="h-[38px] border border-border rounded-lg px-3 flex flex-col justify-center leading-tight bg-surface-3">
              <span className="text-sm font-semibold text-ink-2">₹{totalValue.toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-ink-4">
                Subtotal ₹{subtotalValue.toLocaleString('en-IN')} + tax ₹{taxTotalValue.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-ink-3 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} aria-label="Notes" className="w-full border border-border rounded-lg px-3 py-2 text-sm disabled:bg-surface-3" rows={2} />
          </div>
        </div>

        <div className="rounded-lg border border-border">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Order items</p>
            <button type="button" onClick={addItem} disabled={!canEdit} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-xs font-semibold text-ink-2 bg-surface hover:bg-surface-2 disabled:opacity-60">
              <Plus size={14} />
              Add item
            </button>
          </div>
          <div className="p-3 space-y-2.5 overflow-x-auto">
            {/* Column headings — grid-template must stay identical to each item row below so headers line up. */}
            <div className={ITEM_ROW_GRID_COLS}>
              <div className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide text-center">Sr</div>
              <div className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Product</div>
              <div className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide">SKU</div>
              <div className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Pack</div>
              <div className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Qty (units)</div>
              <div className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Unit Price (₹)</div>
              <div className="text-[10px] font-semibold text-warn uppercase tracking-wide">MRP (₹)</div>
              <div className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Tax %</div>
              <div className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Tax amount (₹)</div>
              <div className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide">Line total (₹)</div>
              <div />
            </div>
            {items.map((item, index) => (
              <div
                key={`edit-so-item-${index}`}
                className="rounded-lg border border-border bg-surface p-2.5 transition-colors hover:border-brand/40 hover:bg-surface/80 focus-within:border-brand/50 focus-within:ring-1 focus-within:ring-brand/20"
              >
                <div className={`${ITEM_ROW_GRID_COLS} items-start`}>
                  <div className="flex items-start justify-center pt-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface-3 text-[10px] font-semibold tabular-nums text-ink-3">
                      {index + 1}
                    </span>
                  </div>
                  <input
                    ref={(el) => {
                      productInputRefs.current[index] = el;
                    }}
                    className="min-w-0 border border-border rounded-md px-2.5 py-2 text-sm bg-surface disabled:bg-surface-3 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-shadow"
                    placeholder="Search by product name or SKU…"
                    aria-label="Product (search by name or SKU)"
                    value={item.productName}
                    disabled={!canEdit}
                    autoComplete="off"
                    onFocus={() => focusProductSuggest(index)}
                    onChange={(e) => {
                      setActiveProductSuggestIndex(index);
                      updateItem(index, { productName: e.target.value });
                    }}
                  />
                  <input
                    className="min-w-0 border border-border rounded-md px-2.5 py-2 text-sm disabled:bg-surface-3 bg-surface-3 font-mono text-ink-2"
                    placeholder="Auto-filled"
                    aria-label="SKU is filled automatically when a product is selected"
                    value={item.sku}
                    disabled
                    readOnly
                    title="SKU is filled automatically when a product is selected"
                  />
                  <input
                    className="min-w-0 border border-border rounded-md px-2.5 py-2 text-sm disabled:bg-surface-3 bg-surface-3 text-ink-2"
                    placeholder="—"
                    aria-label="Pack size is filled automatically when a product is selected"
                    value={item.pack}
                    disabled
                    readOnly
                    title="Pack size is filled automatically when a product is selected"
                  />
                  <input
                    type="number"
                    min={1}
                    className="min-w-0 border border-border rounded-md px-2.5 py-2 text-sm disabled:bg-surface-3 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-shadow"
                    placeholder="0"
                    aria-label="Quantity (units)"
                    value={item.orderedQty || ''}
                    disabled={!canEdit}
                    onChange={(e) => updateItem(index, { orderedQty: Number(e.target.value || 0) })}
                  />
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    className="min-w-0 border border-border rounded-md px-2.5 py-2 text-sm disabled:bg-surface-3 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-shadow"
                    placeholder="0.00"
                    aria-label="Unit price (₹)"
                    value={item.unitPrice || ''}
                    disabled={!canEdit}
                    onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value || 0) })}
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="min-w-0 border border-[color:var(--st-amber-fg)]/30 rounded-md px-2.5 py-2 text-sm disabled:bg-surface-3 bg-warn-soft text-warn focus:outline-none focus:ring-2 focus:ring-warn/30 transition-shadow"
                    placeholder="0.00"
                    aria-label="MRP from product master — editable per SO"
                    value={item.mrp ?? ''}
                    disabled={!canEdit}
                    title="MRP from product master — editable per SO"
                    onChange={(e) => updateItem(index, { mrp: e.target.value === '' ? null : Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    className="min-w-0 border border-border rounded-md px-2.5 py-2 text-sm bg-surface-2/60 disabled:bg-surface-3 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-shadow"
                    placeholder="5%"
                    aria-label="Tax % — individual per-line tax"
                    value={item.taxPct || ''}
                    disabled={!canEdit}
                    title="Individual per-line tax — % and ₹ amount stay in sync"
                    onChange={(e) => handleTaxPctChange(index, e.target.value)}
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="min-w-0 border border-border rounded-md px-2.5 py-2 text-sm bg-surface-2/60 disabled:bg-surface-3 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-shadow"
                    placeholder="₹90"
                    aria-label="Tax amount (₹) — individual per-line tax"
                    value={item.taxAmount || ''}
                    disabled={!canEdit}
                    title="Individual per-line tax — % and ₹ amount stay in sync"
                    onChange={(e) => handleTaxAmountChange(index, e.target.value)}
                  />
                  <div className="min-w-0 flex items-center px-2.5 py-2 rounded-md border border-brand-soft bg-brand-soft/60 text-sm font-bold text-brand tabular-nums whitespace-nowrap overflow-hidden text-ellipsis">
                    ₹{(lineBase(item) + (Number(item.taxAmount) || 0)).toLocaleString('en-IN')}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={!canEdit || items.length === 1}
                    aria-label="Remove item"
                    className="inline-flex items-center justify-center gap-1 border border-[color:var(--st-red-fg)]/30 rounded-md px-2 py-2 text-xs font-semibold text-err bg-err-soft hover:bg-err-soft/70 disabled:opacity-60 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                  {priceHints[index] ? (
                    <div className="col-[2/-1] -mt-0.5 text-[11px] text-brand flex items-center gap-1">
                      <span>💡</span>{priceHints[index]}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
        </div>
      </Modal>
      {suggestPortal}
    </>
  );
};
