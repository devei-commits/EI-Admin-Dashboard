export interface OrderStatus {
  orderStatus: 'pending' | 'processing' | 'completed' | '';
  invoiced: 'pending' | 'completed' | '';
  payment: 'pending' | 'completed' | '';
  packed: 'pending' | 'completed' | '';
  shipped: 'pending' | 'completed' | '';
  deliveryMethod: 'road' | 'rail' | 'air' | 'sea' | '';
}

export interface OrderItem {
  name?: string;
  quantity?: number;
  unit?: string;
  price?: number;
  [key: string]: unknown;
}

export interface OrderFormData {
  [key: string]: unknown;
}

export interface Order {
  id: string;
  type: 'SO' | 'PO';
  orderId: string;
  customerName?: string;
  vendorName?: string;
  orderDate: string;
  expectedShipmentDate?: string;
  reference?: string;
  paymentTerms?: string;
  status: string;
  items: OrderItem[];
  formData: OrderFormData;
  orderStatus: OrderStatus;
  /** Zoho Books purchase order id (PO only) */
  zohoPurchaseOrderId?: string | null;
  /** Zoho Books vendor bill id — purchase invoice (PO only) */
  zohoBillId?: string | null;
}
