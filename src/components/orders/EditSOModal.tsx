import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Modal } from './Modal';
import type { SaleOrder } from '../../types/orderFulfillment';
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
import { computeSuggestPanelRect, getScrollParents, type SuggestPanelRect } from '../../utils/suggestPanelPosition';

interface EditableItem {
  sku: string;
  productName: string;
  pack: string;
  orderedQty: number;
  unitPrice: number;
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
    items: EditableItem[];
  }) => Promise<void> | void;
}

const DEFAULT_STAGED = { advance_pct: 0, pre_shipment_pct: 100, post_shipment_pct: 0, credit_days: 30 };
const MAX_PRODUCT_SUGGESTIONS = 100;
const SUGGEST_LIST_BOX_CLASS =
  'fixed z-[10050] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5';
const SUGGEST_ITEM_CLASS =
  'flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors hover:bg-slate-100 focus:bg-slate-100 focus:outline-none border-b border-gray-50 last:border-0';
const SUGGEST_ITEM_PRIMARY_CLASS = 'text-sm font-medium text-gray-900';
const SUGGEST_ITEM_META_CLASS = 'text-xs text-gray-500';

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
  const [shipAddress, setShipAddress] = useState('');
  const [advancePctStr, setAdvancePctStr] = useState(String(DEFAULT_STAGED.advance_pct));
  const [preShipmentPctStr, setPreShipmentPctStr] = useState(String(DEFAULT_STAGED.pre_shipment_pct));
  const [postShipmentPctStr, setPostShipmentPctStr] = useState(String(DEFAULT_STAGED.post_shipment_pct));
  const [creditDaysStr, setCreditDaysStr] = useState(String(DEFAULT_STAGED.credit_days));
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [priceHints, setPriceHints] = useState<Record<number, string>>({});
  const priceResolveGenRef = useRef(0);
  const [activeProductSuggestIndex, setActiveProductSuggestIndex] = useState<number | null>(null);
  const [suggestPanelRect, setSuggestPanelRect] = useState<SuggestPanelRect | null>(null);
  const suggestPanelRef = useRef<HTMLDivElement | null>(null);
  const productInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!saleOrder || !isOpen) return;
    setCustomer(String(saleOrder.customer || ''));
    setCustomerCity(String(saleOrder.customerCity || ''));
    setOrderDate(String(saleOrder.orderDate || ''));
    setDueDate(String(saleOrder.dueDate || ''));
    setPriority(saleOrder.priority === 'high' ? 'high' : 'normal');
    setShipAddress(String(saleOrder.shipAddress || ''));
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

  const totalValue = useMemo(
    () => items.reduce((sum, it) => sum + Number(it.orderedQty || 0) * Number(it.unitPrice || 0), 0),
    [items]
  );

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
          const next = [...prev];
          if (fromTier || (fromDefaultRate && autoPrice)) {
            next[index] = { ...next[index], unitPrice: Number(result.price_per_unit) };
          } else if (result.source === 'no_tier_match' || !autoPrice) {
            next[index] = { ...next[index], unitPrice: 0 };
          }
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
          };
        } else {
          next[index] = {
            ...next[index],
            sku: '',
            pack: '',
            unitPrice: 0,
          };
        }
      }
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { sku: '', productName: '', pack: '', orderedQty: 1, unitPrice: 0 },
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
    // intentionally omit `items` — we want this to fire only when customer or open state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId, isOpen, resolveLinePrice]);

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
      items: items.map((item) => ({
        sku: item.sku.trim(),
        productName: item.productName.trim(),
        pack: item.pack.trim(),
        orderedQty: Number(item.orderedQty || 0),
        unitPrice: Number(item.unitPrice || 0),
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
        size="xl"
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canEdit || isSaving}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
        {!canEdit && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {lockReason || 'Editing is locked for this sale order.'}
          </div>
        )}

        {errors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <ul className="list-disc list-inside text-sm text-red-700">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Customer</label>
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Customer city</label>
            <input value={customerCity} onChange={(e) => setCustomerCity(e.target.value)} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as 'normal' | 'high')} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100">
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Order date</label>
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Shipping address</label>
            <input value={shipAddress} onChange={(e) => setShipAddress(e.target.value)} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Payment terms (staged)</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={0} max={100} step="0.01" value={advancePctStr} onChange={(e) => setAdvancePctStr(e.target.value)} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" placeholder="Advance %" />
              <input type="number" min={0} max={100} step="0.01" value={preShipmentPctStr} onChange={(e) => setPreShipmentPctStr(e.target.value)} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" placeholder="Pre-shipment %" />
              <input type="number" min={0} max={100} step="0.01" value={postShipmentPctStr} onChange={(e) => setPostShipmentPctStr(e.target.value)} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" placeholder="Post-shipment %" />
              <input type="number" min={0} step={1} value={creditDaysStr} onChange={(e) => setCreditDaysStr(e.target.value)} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" placeholder="Credit days" />
            </div>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Total value</label>
            <div className="h-[38px] border border-gray-200 rounded-lg px-3 flex items-center text-sm font-semibold text-gray-700 bg-gray-50">
              {totalValue.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" rows={2} />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200">
          <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Order items</p>
            <button type="button" onClick={addItem} disabled={!canEdit} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60">
              <Plus size={14} />
              Add item
            </button>
          </div>
          <div className="p-3 space-y-2">
            {/* Column headings */}
            <div className="grid grid-cols-12 gap-2 pb-1 border-b border-gray-100">
              <div className="col-span-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Product</div>
              <div className="col-span-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">SKU</div>
              <div className="col-span-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Pack</div>
              <div className="col-span-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Qty (units)</div>
              <div className="col-span-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Unit Price (₹)</div>
              <div className="col-span-2" />
            </div>
            {items.map((item, index) => (
              <div key={`edit-so-item-${index}`} className="grid grid-cols-12 gap-2">
                <input
                  ref={(el) => {
                    productInputRefs.current[index] = el;
                  }}
                  className="col-span-3 border border-gray-300 rounded px-2 py-1.5 text-sm disabled:bg-gray-100"
                  placeholder="Search by product name or SKU…"
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
                  className="col-span-2 border border-gray-300 rounded px-2 py-1.5 text-sm disabled:bg-gray-100 bg-gray-50"
                  placeholder="Auto-filled"
                  value={item.sku}
                  disabled
                  readOnly
                  title="SKU is filled automatically when a product is selected"
                />
                <input
                  className="col-span-1 border border-gray-300 rounded px-2 py-1.5 text-sm disabled:bg-gray-100 bg-gray-50"
                  placeholder="—"
                  value={item.pack}
                  disabled
                  readOnly
                  title="Pack size is filled automatically when a product is selected"
                />
                <input
                  type="number"
                  min={1}
                  className="col-span-2 border border-gray-300 rounded px-2 py-1.5 text-sm disabled:bg-gray-100"
                  placeholder="0"
                  value={item.orderedQty || ''}
                  disabled={!canEdit}
                  onChange={(e) => updateItem(index, { orderedQty: Number(e.target.value || 0) })}
                />
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  className="col-span-2 border border-gray-300 rounded px-2 py-1.5 text-sm disabled:bg-gray-100"
                  placeholder="0.00"
                  value={item.unitPrice || ''}
                  disabled={!canEdit}
                  onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value || 0) })}
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={!canEdit || items.length === 1}
                  className="col-span-2 inline-flex items-center justify-center gap-1 border border-red-200 rounded px-2 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-60"
                >
                  <Trash2 size={13} />
                  Remove
                </button>
                {priceHints[index] ? (
                  <div className="col-span-12 text-[11px] text-blue-600 flex items-center gap-1">
                    <span>💡</span>{priceHints[index]}
                  </div>
                ) : null}
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
