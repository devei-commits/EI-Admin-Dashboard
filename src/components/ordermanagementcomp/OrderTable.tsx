import React from 'react';

interface Order {
  orderId: string;
  companyName: string;
  doctorClinicAddress: string;
  dateRegistered: string;
  orderStatus: string;
}

const OrderTable: React.FC = () => {
  const orders: Order[] = [
    {
      orderId: 'ORD001',
      companyName: 'MedCorp Solutions',
      doctorClinicAddress: '123 Health Street, Medical City, MC 12345',
      dateRegistered: '2024-01-15',
      orderStatus: 'Review at BD'
    },
    {
      orderId: 'ORD002',
      companyName: 'HealthTech Inc',
      doctorClinicAddress: '456 Wellness Ave, Care Town, CT 67890',
      dateRegistered: '2024-01-20',
      orderStatus: 'Review at R&D Lead'
    },
    {
      orderId: 'ORD003',
      companyName: 'Clinical Partners',
      doctorClinicAddress: '789 Doctor Lane, Medicine City, MC 54321',
      dateRegistered: '2024-01-25',
      orderStatus: 'Approved'
    },
    {
      orderId: 'ORD004',
      companyName: 'Pharma Solutions',
      doctorClinicAddress: '321 Pharmacy Road, Drug Valley, DV 98765',
      dateRegistered: '2024-01-30',
      orderStatus: 'Packaging'
    },
    {
      orderId: 'ORD005',
      companyName: 'Medical Supplies Co',
      doctorClinicAddress: '654 Clinic Boulevard, Health City, HC 13579',
      dateRegistered: '2024-02-01',
      orderStatus: 'Review at OA'
    },
    {
      orderId: 'ORD006',
      companyName: 'Healthcare Innovations',
      doctorClinicAddress: '987 Medical Plaza, Care Center, CC 24680',
      dateRegistered: '2024-02-05',
      orderStatus: 'Rejected'
    },
    {
      orderId: 'ORD007',
      companyName: 'BioMed Corp',
      doctorClinicAddress: '111 Research Drive, Science Park, SP 11223',
      dateRegistered: '2024-02-10',
      orderStatus: 'Dispatch'
    },
    {
      orderId: 'ORD008',
      companyName: 'Global Health Systems',
      doctorClinicAddress: '222 Wellness Street, Treatment Town, TT 44556',
      dateRegistered: '2024-02-12',
      orderStatus: 'Shipped'
    }
  ];

  return (
    <div className="w-full">
      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {orders.map((order) => (
          <div key={order.orderId} className="bg-gray-50/50 border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <span className="font-semibold text-gray-800">{order.orderId}</span>
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-100">{order.orderStatus}</span>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium text-gray-400">Company:</span> <span className="text-gray-700">{order.companyName}</span></p>
              <p><span className="font-medium text-gray-400">Address:</span> <span className="text-gray-700">{order.doctorClinicAddress}</span></p>
              <p><span className="font-medium text-gray-400">Date:</span> <span className="text-gray-700">{order.dateRegistered}</span></p>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Order ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Company Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Doctor Clinic Address
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Date Registered
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Order Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.map((order) => (
              <tr key={order.orderId} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-4 font-semibold text-gray-800">
                  {order.orderId}
                </td>
                <td className="px-4 py-4 text-gray-700">
                  {order.companyName}
                </td>
                <td className="px-4 py-4 text-gray-600 text-sm">
                  {order.doctorClinicAddress}
                </td>
                <td className="px-4 py-4 text-gray-500">
                  {order.dateRegistered}
                </td>
                <td className="px-4 py-4">
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                    {order.orderStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderTable;