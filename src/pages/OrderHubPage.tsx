import React, { useEffect } from 'react';
import OrderHubContent from './OrderHub';

const OrderHubPage: React.FC = () => {
 useEffect(() => {
  // Set default tab to Orders Tracker when opening Order Hub
  localStorage.setItem('orderHubActiveTab', 'orders-tracker');
 }, []);

 return <OrderHubContent />;
};

export default OrderHubPage;
