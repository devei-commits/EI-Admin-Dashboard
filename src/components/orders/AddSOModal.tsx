/**
 * AddSOModal Component
 * Modal for creating a new sale order — fetches SO number, customers, and products from DB
 */

import React, { useState, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { UnifiedModal as Modal, UnifiedInput as Input, UnifiedSelect as Select, UnifiedButton as Button } from '../ui/UnifiedComponents';
import type { AddSOModalProps } from '../../types/orderFulfillment';
import { PAYMENT_TERMS } from '../../constants/orderFulfillment';
import { getTodayISO, addDays } from '../../utils/orderFulfillmentUtils';
import {
  fetchNextSoNo,
  fetchCustomers,
  fetchProducts,
  type CustomerOption,
  type ProductOption,
} from '../../services/fulfillment.service';

export const AddSOModal: React.FC<AddSOModalProps> = ({ isOpen, onClose, onSave }) => {
  const [soNo, setSoNo] = useState('');
  const [customer, setCustomer] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [orderDate, setOrderDate] = useState(getTodayISO());
  const [dueDate, setDueDate] = useState(addDays(getTodayISO(), 30));
  const [priority, setPriority] = useState<'normal' | 'high'>('normal');
  const [shipAddress, setShipAddress] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
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

  const handleCustomerChange = (name: string) => {
    setCustomer(name);
    const selected = customers.find(c => c.name === name);
    if (selected) {
      setCustomerCity(selected.city || '');
      if (selected.paymentTerms) setPaymentTerms(selected.paymentTerms);
      if (selected.shippingAddress) setShipAddress(selected.shippingAddress);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { sku: '', productName: '', pack: '', orderedQty: 1000, unitPrice: 0, bmrNo: '' }]);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'productName') {
      const selected = products.find(p => p.name === value);
      if (selected) {
        newItems[index].sku = selected.sku;
        newItems[index].pack = selected.pack;
        if (selected.price > 0) newItems[index].unitPrice = selected.price;
      }
    }
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleSubmit = () => {
    const newErrors: string[] = [];
    if (!soNo.trim()) newErrors.push('SO Number is required.');
    if (!customer.trim()) newErrors.push('Customer is required.');
    items.forEach((item, index) => {
      if (!item.productName) newErrors.push(`Product for item #${index + 1} is required.`);
      if (item.orderedQty <= 0) newErrors.push(`Quantity for item #${index + 1} must be positive.`);
      if (item.unitPrice <= 0) newErrors.push(`Unit price for item #${index + 1} must be positive.`);
    });

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

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
      items,
    };

    onSave(saveData as any);
    handleClose();
  };

  const handleClose = () => {
    setSoNo('');
    setCustomer('');
    setCustomerCity('');
    setOrderDate(getTodayISO());
    setDueDate(addDays(getTodayISO(), 30));
    setPriority('normal');
    setShipAddress('');
    setPaymentTerms('Net 30');
    setNotes('');
    setItems([{ sku: '', productName: '', pack: '', orderedQty: 1000, unitPrice: 0, bmrNo: '' }]);
    setErrors([]);
    onClose();
  };

  /* Only Finished Goods (FG) in dropdown; RMs and PMs are materials used to build FGs. */
  const productOptions = [
    { value: '', label: 'Select Product (FG)' },
    ...products.map(p => ({ value: p.name, label: `${p.name} (${p.sku})` })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Sale Order" size="lg">
      <div className="p-6">
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

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Input label="SO Number" value={soNo} readOnly disabled />
                  <p className="text-xs text-gray-400 mt-1">Auto-generated</p>
                </div>
                <Select
                  label="Customer"
                  value={customer}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  options={[
                    { value: '', label: 'Select Customer' },
                    ...customers.map(c => ({ value: c.name, label: `${c.name}${c.city ? ` — ${c.city}` : ''}` }))
                  ]}
                />
                <Input label="Customer City" placeholder="e.g., Mumbai" value={customerCity} onChange={(e) => setCustomerCity(e.target.value)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="Order Date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
                <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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

              <div>
                <Input label="Shipping Address" placeholder="Enter full shipping address" value={shipAddress} onChange={(e) => setShipAddress(e.target.value)} />
                <p className="text-xs text-gray-500 mt-1">Pre-filled from customer; edit if needed for this order.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Select
                    label="Payment Terms"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    options={PAYMENT_TERMS.map(term => ({ value: term, label: term }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">Pre-filled from customer; edit if needed for this order.</p>
                </div>
                <Input label="Notes" placeholder="Optional notes or instructions" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              {/* Items Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Order Items</h3>
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-x-4 gap-y-2 p-4 border rounded-lg bg-gray-50 relative">
                    <div className="col-span-12 md:col-span-3">
                      <Select
                        label="Product"
                        value={item.productName}
                        onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                        options={productOptions}
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Input label="SKU" value={item.sku} readOnly disabled />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Input label="Pack Size" value={item.pack} readOnly disabled />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Input label="Quantity" type="number" value={item.orderedQty} onChange={(e) => handleItemChange(index, 'orderedQty', parseInt(e.target.value))} />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <Input label="Unit Price (₹)" type="number" value={item.unitPrice} onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value))} />
                    </div>
                    <div className="col-span-12 md:col-span-1">
                      {items.length > 1 && (
                        <Button variant="ghost" size="sm" className="absolute top-4 right-4" onClick={() => handleRemoveItem(index)}>
                          <Plus className="h-4 w-4 rotate-45 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <Button onClick={handleAddItem} className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Add Another Item
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 p-4 bg-gray-50 border-t">
        <Button variant="ghost" onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={loadingData}><Plus className="mr-2 h-4 w-4" /> Create Sale Order</Button>
      </div>
    </Modal>
  );
};
