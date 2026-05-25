/**
 * AddSOModal Component
 * Modal for creating a new sale order — fetches SO number, customers, and products from DB
 */

import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Loader2 } from 'lucide-react';

/** Default calendar days from order date to due date (business rule). */
const LEAD_DAYS_PRODUCT = 45;
const LEAD_DAYS_CUSTOMISATION = 90;
import { UnifiedModal as Modal, UnifiedInput as Input, UnifiedSelect as Select, UnifiedButton as Button } from '../ui/UnifiedComponents';
import type { AddSOModalProps } from '../../types/orderFulfillment';
import { getTodayISO, addDays, isValidPackSize } from '../../utils/orderFulfillmentUtils';
import {
  resolveStagedPaymentTermsFromCustomerMaster,
  serializeStagedPaymentTerms,
  validateStagedPercents,
} from '../../lib/stagedPaymentTerms';
import {
  fetchNextSoNo,
  fetchCustomers,
  fetchProducts,
  fetchClientProductPrice,
  type CustomerOption,
  type ProductOption,
} from '../../services/fulfillment.service';

const DEFAULT_STAGED = { advance_pct: 0, pre_shipment_pct: 100, post_shipment_pct: 0, credit_days: 30 };
const MAX_PRODUCT_SUGGESTIONS = 100;
const MAX_CUSTOMER_SUGGESTIONS = 100;

/** Themed suggestion panel (native <datalist> cannot be styled in most browsers). */
const SUGGEST_LIST_BOX_CLASS =
  'fixed z-[10000] max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5';
const SUGGEST_ITEM_CLASS =
  'flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors hover:bg-slate-100 focus:bg-slate-100 focus:outline-none border-b border-gray-50 last:border-0';
const SUGGEST_ITEM_PRIMARY_CLASS = 'text-sm font-medium text-gray-900';
const SUGGEST_ITEM_META_CLASS = 'text-xs text-gray-500';

type AutocompleteTarget = null | { kind: 'customer' } | { kind: 'product'; index: number };

function parseProductIdFromOption(product: ProductOption): number | null {
  const m = /^PR-(\d+)$/i.exec(String(product.id || '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function packSizeFromProductRecord(product: ProductOption | undefined): string {
  const p = (product?.pack ?? '').trim();
  return p || '0';
}

export const AddSOModal: React.FC<AddSOModalProps> = ({ isOpen, onClose, onSave }) => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [soNo, setSoNo] = useState('');
  const [customer, setCustomer] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [orderDate, setOrderDate] = useState(getTodayISO());
  const [dueDate, setDueDate] = useState(addDays(getTodayISO(), LEAD_DAYS_PRODUCT));
  const [orderKind, setOrderKind] = useState<'product' | 'customisation'>('product');
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const [shipAddress, setShipAddress] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCountry, setCustomerCountry] = useState('');
  const [customerLocation, setCustomerLocation] = useState('');
  const [customerCategory, setCustomerCategory] = useState('');
  const [customerSegment, setCustomerSegment] = useState('');
  const [customerContactLine, setCustomerContactLine] = useState('');
  const [customerCreditLimit, setCustomerCreditLimit] = useState('');

  const [advancePctStr, setAdvancePctStr] = useState(String(DEFAULT_STAGED.advance_pct));
  const [preShipmentPctStr, setPreShipmentPctStr] = useState(String(DEFAULT_STAGED.pre_shipment_pct));
  const [postShipmentPctStr, setPostShipmentPctStr] = useState(String(DEFAULT_STAGED.post_shipment_pct));
  const [creditDaysStr, setCreditDaysStr] = useState(String(DEFAULT_STAGED.credit_days));

  const [notes, setNotes] = useState('');

  const [items, setItems] = useState([{
    sku: '',
    productName: '',
    pack: '',
    orderedQty: 1000,
    unitPrice: 0,
    bmrNo: ''
  }]);

  const [errors, setErrors] = useState<string[]>([]);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [priceHints, setPriceHints] = useState<Record<number, string>>({});
  const priceResolveGenRef = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const [autocompleteTarget, setAutocompleteTarget] = useState<AutocompleteTarget>(null);
  const [suggestPanelRect, setSuggestPanelRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const customerInputRef = useRef<HTMLInputElement | null>(null);
  const suggestPanelRef = useRef<HTMLDivElement | null>(null);
  const productInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const updateSuggestPanelPosition = useCallback(() => {
    if (!autocompleteTarget) {
      setSuggestPanelRect(null);
      return;
    }
    const el =
      autocompleteTarget.kind === 'customer'
        ? customerInputRef.current
        : productInputRefs.current[autocompleteTarget.index];
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSuggestPanelRect({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 220),
    });
  }, [autocompleteTarget]);

  useLayoutEffect(() => {
    updateSuggestPanelPosition();
    if (!autocompleteTarget) return;
    window.addEventListener('scroll', updateSuggestPanelPosition, true);
    window.addEventListener('resize', updateSuggestPanelPosition);
    return () => {
      window.removeEventListener('scroll', updateSuggestPanelPosition, true);
      window.removeEventListener('resize', updateSuggestPanelPosition);
    };
  }, [autocompleteTarget, updateSuggestPanelPosition, customer, items]);

  useEffect(() => {
    if (!autocompleteTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAutocompleteTarget(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [autocompleteTarget]);

  useEffect(() => {
    if (!autocompleteTarget) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (suggestPanelRef.current?.contains(t)) return;
      if (customerInputRef.current?.contains(t)) return;
      if (autocompleteTarget.kind === 'product') {
        const inp = productInputRefs.current[autocompleteTarget.index];
        if (inp?.contains(t)) return;
      }
      setAutocompleteTarget(null);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [autocompleteTarget]);

  useEffect(() => {
    if (!isOpen) {
      setAutocompleteTarget(null);
      setSuggestPanelRect(null);
    }
  }, [isOpen]);

  const productsByName = useMemo(() => {
    const map = new Map<string, ProductOption>();
    products.forEach((product) => map.set(product.name, product));
    return map;
  }, [products]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoadingData(true);

    Promise.all([fetchNextSoNo(), fetchCustomers(), fetchProducts()])
      .then(([nextSoNo, customerList, productList]) => {
        if (cancelled) return;
        setSoNo(nextSoNo);
        setCustomers(customerList);
        setProducts(productList);
      })
      .catch((err) => {
        console.error('Failed to load modal data:', err);
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });

    return () => { cancelled = true; };
  }, [isOpen]);

  const applyStagedPaymentFields = (staged: typeof DEFAULT_STAGED) => {
    setAdvancePctStr(String(staged.advance_pct));
    setPreShipmentPctStr(String(staged.pre_shipment_pct));
    setPostShipmentPctStr(String(staged.post_shipment_pct));
    setCreditDaysStr(String(staged.credit_days));
  };

  const resolveLinePrice = useCallback(
    async (index: number, snapshot: typeof items, clientId: number) => {
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
            next[index] = { ...next[index], unitPrice: result.price_per_unit! };
          } else if (result.source === 'no_tier_match' || !autoPrice) {
            next[index] = { ...next[index], unitPrice: 0 };
          }
          return next;
        });

        if (result.message) {
          setPriceHints((prev) => ({ ...prev, [index]: result.message! }));
        } else {
          setPriceHints((prev) => {
            const next = { ...prev };
            delete next[index];
            return next;
          });
        }

        const fromPriceList = fromTier || fromDefaultRate;
        if (fromPriceList && result.staged_payment_terms) {
          applyStagedPaymentFields(result.staged_payment_terms);
        }
      } catch (err) {
        console.error('Failed to resolve client product price:', err);
        setPriceHints((prev) => ({
          ...prev,
          [index]: 'Could not load price from client price list.',
        }));
      }
    },
    [productsByName],
  );

  const linePriceSignature = items
    .map((it) => `${it.productName}|${it.orderedQty}`)
    .join(';');

  useEffect(() => {
    if (!selectedCustomerId || !isOpen) return;
    const clientId = selectedCustomerId;
    const timer = window.setTimeout(() => {
      const snap = itemsRef.current;
      snap.forEach((_, index) => {
        void resolveLinePrice(index, snap, clientId);
      });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [selectedCustomerId, linePriceSignature, isOpen, resolveLinePrice]);

  const handleCustomerChange = (name: string) => {
    setCustomer(name);
    const selected = customers.find(c => c.name === name);
    if (!selected) {
      setSelectedCustomerId(null);
      setPriceHints({});
      setCustomerCode('');
      setCustomerCity('');
      setShipAddress('');
      setBillingAddress('');
      setCustomerEmail('');
      setCustomerPhone('');
      setCustomerCountry('');
      setCustomerLocation('');
      setCustomerCategory('');
      setCustomerSegment('');
      setCustomerContactLine('');
      setCustomerCreditLimit('');
      applyStagedPaymentFields(DEFAULT_STAGED);
      return;
    }

    setSelectedCustomerId(selected.id);
    setCustomerCode(selected.code || '');
    setCustomerCity(selected.city || '');
    setShipAddress(selected.shippingAddress || '');
    setBillingAddress(selected.billingAddress || '');
    setCustomerEmail(selected.email || '');
    setCustomerPhone(selected.phone || '');
    setCustomerCountry(selected.country || '');
    setCustomerLocation((selected.state || selected.location || '').trim());
    setCustomerCategory(selected.category || '');
    setCustomerSegment(selected.segment || '');
    setCustomerContactLine(selected.contactLine || '');
    setCustomerCreditLimit(selected.creditLimit || '');
    setNotes(selected.notes || '');

    const pr = String(selected.priority || '').toLowerCase();
    if (pr === 'high' || pr === 'normal') setPriority(pr as 'normal' | 'high');

    const staged = resolveStagedPaymentTermsFromCustomerMaster(
      selected.paymentTerms,
      (selected.clientData ?? {}) as Record<string, unknown>,
    );
    applyStagedPaymentFields(staged);
  };

  const handleAddItem = () => {
    setItems([...items, { sku: '', productName: '', pack: '', orderedQty: 1000, unitPrice: 0, bmrNo: '' }]);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'productName') {
      const selected = productsByName.get(value);
      if (selected) {
        newItems[index].sku = selected.sku;
        newItems[index].pack = packSizeFromProductRecord(selected);
        if (!selectedCustomerId && selected.price > 0) {
          newItems[index].unitPrice = selected.price;
        } else {
          newItems[index].unitPrice = 0;
        }
      } else {
        newItems[index].sku = '';
        newItems[index].pack = '';
        newItems[index].unitPrice = 0;
      }
    }
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleSubmit = () => {
    const formEl = formRef.current;
    if (formEl && !formEl.reportValidity()) {
      const firstInvalid = formEl.querySelector(':invalid');
      if (firstInvalid instanceof HTMLElement) firstInvalid.focus();
      return;
    }

    const newErrors: string[] = [];
    if (!soNo.trim()) newErrors.push('SO Number is required.');
    if (!customer.trim()) newErrors.push('Customer is required.');
    else if (!customers.some((c) => c.name === customer.trim())) {
      newErrors.push('Select a valid customer from the list (search by name, code, or city).');
    }
    if (!items.some((item) => item.productName && item.productName.trim())) {
      newErrors.push('At least one product must be added.');
    }
    const selectedNames = items
      .map((item) => item.productName?.trim())
      .filter((name): name is string => Boolean(name));
    if (new Set(selectedNames).size !== selectedNames.length) {
      newErrors.push('Duplicate products are not allowed in order items.');
    }
    items.forEach((item, index) => {
      if (!item.productName) {
        newErrors.push(`Product for item #${index + 1} is required.`);
      } else if (!productsByName.has(item.productName)) {
        newErrors.push(`Select a valid product for item #${index + 1}.`);
      }
      if (item.orderedQty <= 0) newErrors.push(`Quantity for item #${index + 1} must be positive.`);
      if (item.unitPrice <= 0) {
        newErrors.push(
          `Unit price for item #${index + 1} is required — set client pricing in Items List (Products) or enter manually.`,
        );
      }
      if (item.productName && !isValidPackSize(item.pack)) {
        newErrors.push(`Pack size for item #${index + 1} could not be resolved from the PR SKU BOM.`);
      }
    });

    const adv = Number(advancePctStr);
    const pre = Number(preShipmentPctStr);
    const post = Number(postShipmentPctStr);
    const cd = Math.max(0, Math.floor(Number(creditDaysStr) || 0));
    const pctErr = validateStagedPercents(adv, pre, post);
    if (pctErr) newErrors.push(pctErr);
    if (!Number.isFinite(adv) || !Number.isFinite(pre) || !Number.isFinite(post)) {
      newErrors.push('Payment stage percentages must be valid numbers.');
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    const paymentTerms = serializeStagedPaymentTerms({
      advance_pct: adv,
      pre_shipment_pct: pre,
      post_shipment_pct: post,
      credit_days: cd,
    });

    const saveData = {
      soNo,
      customer,
      customerCity,
      orderDate,
      dueDate,
      priority,
      shipAddress,
      paymentTerms,
      notes,
      items: items.map((it) => ({
        ...it,
        pack: String(it.pack ?? '').trim(),
      })),
    };

    onSave(saveData as any);
    handleClose();
  };

  const handleClose = () => {
    setSoNo('');
    setCustomer('');
    setCustomerCode('');
    setCustomerCity('');
    setOrderDate(getTodayISO());
    setOrderKind('product');
    setDueDate(addDays(getTodayISO(), LEAD_DAYS_PRODUCT));
    setPriority('normal');
    setShipAddress('');
    setBillingAddress('');
    setCustomerEmail('');
    setCustomerPhone('');
    setCustomerCountry('');
    setCustomerLocation('');
    setCustomerCategory('');
    setCustomerSegment('');
    setCustomerContactLine('');
    setCustomerCreditLimit('');
    applyStagedPaymentFields(DEFAULT_STAGED);
    setNotes('');
    setItems([{ sku: '', productName: '', pack: '', orderedQty: 1000, unitPrice: 0, bmrNo: '' }]);
    setSelectedCustomerId(null);
    setPriceHints({});
    setErrors([]);
    setAutocompleteTarget(null);
    setSuggestPanelRect(null);
    onClose();
  };

  /* Only Finished Goods (FG) in suggestions; RMs and PMs are materials used to build FGs. */
  const getProductSuggestionsForIndex = (index: number) => {
    const currentValue = (items[index]?.productName || '').trim().toLowerCase();
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
  };

  const customerSuggestList = useMemo(() => {
    const q = customer.trim().toLowerCase();
    return customers
      .filter((c) => {
        if (!q) return true;
        const hay = `${c.name} ${c.code || ''} ${c.city || ''} ${c.state || ''} ${c.location || ''} ${c.country || ''}`
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, MAX_CUSTOMER_SUGGESTIONS);
  }, [customer, customers]);

  const productSuggestLists = useMemo(
    () => items.map((_, index) => getProductSuggestionsForIndex(index)),
    [items, products]
  );

  const suggestPortal =
    autocompleteTarget && suggestPanelRect && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={suggestPanelRef}
            role="listbox"
            className={SUGGEST_LIST_BOX_CLASS}
            style={{
              top: suggestPanelRect.top,
              left: suggestPanelRect.left,
              width: suggestPanelRect.width,
            }}
          >
            {autocompleteTarget.kind === 'customer' ? (
              customerSuggestList.length === 0 ? (
                <div className={`${SUGGEST_ITEM_CLASS} cursor-default hover:bg-transparent`}>
                  <span className={SUGGEST_ITEM_META_CLASS}>No matching customers. Try another search.</span>
                </div>
              ) : (
                customerSuggestList.map((c) => {
                  const geo = [c.city, c.state || c.location].filter(Boolean).join(', ');
                  const meta = [c.code && `Code ${c.code}`, geo || undefined].filter(Boolean).join(' · ');
                  return (
                    <button
                      key={`${c.id}-${c.name}`}
                      type="button"
                      role="option"
                      className={SUGGEST_ITEM_CLASS}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleCustomerChange(c.name);
                        setAutocompleteTarget(null);
                      }}
                    >
                      <span className={SUGGEST_ITEM_PRIMARY_CLASS}>{c.name}</span>
                      {meta ? <span className={SUGGEST_ITEM_META_CLASS}>{meta}</span> : null}
                    </button>
                  );
                })
              )
            ) : productSuggestLists[autocompleteTarget.index]?.length === 0 ? (
              <div className={`${SUGGEST_ITEM_CLASS} cursor-default hover:bg-transparent`}>
                <span className={SUGGEST_ITEM_META_CLASS}>No matching products. Try name or SKU.</span>
              </div>
            ) : (
              (productSuggestLists[autocompleteTarget.index] ?? []).map((p) => (
                <button
                  key={p.name}
                  type="button"
                  role="option"
                  className={SUGGEST_ITEM_CLASS}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleItemChange(autocompleteTarget.index, 'productName', p.name);
                    setAutocompleteTarget(null);
                  }}
                >
                  <span className={SUGGEST_ITEM_PRIMARY_CLASS}>{p.name}</span>
                  <span className={SUGGEST_ITEM_META_CLASS}>SKU {p.sku}{p.pack ? ` · ${p.pack}` : ''}</span>
                </button>
              ))
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Sale Order" size="lg">
      <div className="p-6 max-h-[85vh] overflow-y-auto">
        {loadingData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-orange-500 mr-3" size={20} />
            <span className="text-gray-500 text-sm">Loading form data...</span>
          </div>
        ) : (
          <>
            {errors.length > 0 && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-semibold text-red-800 mb-2">Please fix the following errors:</p>
                <ul className="list-disc list-inside text-sm text-red-700">
                  {errors.map((err, idx) => <li key={idx}>{err}</li>)}
                </ul>
              </div>
            )}

            <form ref={formRef} className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Input label="SO Number" value={soNo} readOnly disabled />
                  <p className="text-xs text-gray-400 mt-1">Auto-generated</p>
                </div>
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                    Customer<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    ref={customerInputRef}
                    value={customer}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    onFocus={() => setAutocompleteTarget({ kind: 'customer' })}
                    required
                    placeholder="Search customer by name, code, or city"
                    autoComplete="off"
                    className="w-full px-5 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent bg-gray-50/50 transition-all leading-normal tracking-wide border-gray-200"
                  />
                  <p className="text-xs text-gray-400 mt-1">Type to filter, then choose from the themed list below the field.</p>
                </div>
                <Input label="Customer code" value={customerCode} readOnly disabled />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-800">Customer details (from master)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  <Input label="Customer city" placeholder="e.g., Mumbai" value={customerCity} onChange={(e) => setCustomerCity(e.target.value)} />
                  <Input label="State / region" value={customerLocation} onChange={(e) => setCustomerLocation(e.target.value)} />
                  <Input label="Country" value={customerCountry} onChange={(e) => setCustomerCountry(e.target.value)} />
                  <Input label="Email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                  <Input label="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                  <Input label="Category" value={customerCategory} onChange={(e) => setCustomerCategory(e.target.value)} />
                  <Input label="Segment" value={customerSegment} onChange={(e) => setCustomerSegment(e.target.value)} />
                  <Input label="Primary contact" value={customerContactLine} onChange={(e) => setCustomerContactLine(e.target.value)} />
                  <Input label="Credit limit (₹)" value={customerCreditLimit} onChange={(e) => setCustomerCreditLimit(e.target.value)} />
                </div>
                <Input label="Billing address" value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} />
                <p className="text-xs text-slate-500">Prefilled when you pick a customer; edit as needed for this order.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <Input label="Order Date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} required />
                <Select
                  label="Lead time"
                  value={orderKind}
                  onChange={(e) => setOrderKind(e.target.value as 'product' | 'customisation')}
                  options={[
                    { value: 'product', label: `Product (${LEAD_DAYS_PRODUCT} days)` },
                    { value: 'customisation', label: `Customisation (${LEAD_DAYS_CUSTOMISATION} days)` },
                  ]}
                />
                <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
                <Select
                  label="Priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'normal' | 'high')}
                  options={[
                    { value: 'normal', label: 'Normal' },
                    { value: 'high', label: 'High' }
                  ]}
                />
              </div>
              <p className="text-xs text-gray-500 -mt-2">Due date defaults to order date + lead days; adjust if needed.</p>

              <div>
                <Input label="Shipping address" placeholder="Enter full shipping address" value={shipAddress} onChange={(e) => setShipAddress(e.target.value)} />
                <p className="text-xs text-gray-500 mt-1">Pre-filled from customer; edit if needed for this order.</p>
              </div>

              <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-800">Payment terms (three stages + credit days)</p>
                <p className="text-xs text-slate-500">
                  Prefilled from customer master; when you add a product, terms from that client&apos;s Items List rate apply when configured.
                  Total of the three percentages must not exceed 100%.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Input label="Advance %" type="number" min={0} max={100} step="0.01" value={advancePctStr} onChange={(e) => setAdvancePctStr(e.target.value)} required />
                  <Input label="Pre-shipment %" type="number" min={0} max={100} step="0.01" value={preShipmentPctStr} onChange={(e) => setPreShipmentPctStr(e.target.value)} required />
                  <Input label="Post-shipment %" type="number" min={0} max={100} step="0.01" value={postShipmentPctStr} onChange={(e) => setPostShipmentPctStr(e.target.value)} required />
                  <Input label="Credit days" type="number" min={0} value={creditDaysStr} onChange={(e) => setCreditDaysStr(e.target.value)} required />
                </div>
              </div>

              <div>
                <Input label="Notes" placeholder="Optional notes or instructions" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              {/* Items Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Order Items</h3>
                {items.map((item, index) => {
                  const selectedProduct = item.productName
                    ? productsByName.get(item.productName.trim())
                    : undefined;
                  const packFromPr = packSizeFromProductRecord(selectedProduct);

                  return (
                  <div key={index} className="grid grid-cols-12 gap-x-4 gap-y-2 p-4 border rounded-lg bg-gray-50 relative">
                    <div className="col-span-12 md:col-span-3 space-y-2">
                      <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Product<span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <input
                        ref={(el) => {
                          productInputRefs.current[index] = el;
                        }}
                        value={item.productName}
                        onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                        onFocus={() => setAutocompleteTarget({ kind: 'product', index })}
                        required
                        placeholder="Search Product (FG) by name or SKU"
                        autoComplete="off"
                        className="w-full px-5 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent bg-gray-50/50 transition-all leading-normal tracking-wide border-gray-200"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Input label="SKU" value={item.sku} readOnly disabled />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Input
                        label="Pack Size"
                        value={item.productName?.trim() ? packFromPr : item.pack}
                        readOnly
                        disabled
                        required={Boolean(item.productName?.trim())}
                      />
                      {item.productName?.trim() ? (
                        <p className="text-xs text-slate-500 mt-1">
                          From PR SKU BOM net per unit{packFromPr === '0' ? ' (not set — showing 0)' : ''}.
                        </p>
                      ) : null}
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Input label="Quantity" type="number" min={1} required value={item.orderedQty} onChange={(e) => handleItemChange(index, 'orderedQty', parseInt(e.target.value))} />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Input
                        label="Unit Price (₹)"
                        type="number"
                        min={0.01}
                        step="0.01"
                        required
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value))}
                      />
                      {selectedCustomerId ? (
                        <p className="text-xs text-slate-500 mt-1">
                          {priceHints[index] || 'From client price list when configured (MOQ tier by quantity).'}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-700 mt-1">Select a customer to load price from Items List.</p>
                      )}
                    </div>
                    <div className="col-span-12 md:col-span-1">
                      {items.length > 1 && (
                        <Button variant="ghost" size="sm" className="absolute top-4 right-4" onClick={() => handleRemoveItem(index)}>
                          <Plus className="h-4 w-4 rotate-45 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                  );
                })}
                <Button onClick={handleAddItem} className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Add Another Item
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 p-4 bg-gray-50 border-t">
        <Button variant="ghost" onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={loadingData}><Plus className="mr-2 h-4 w-4" /> Create Sale Order</Button>
      </div>
      {suggestPortal}
    </Modal>
  );
};
