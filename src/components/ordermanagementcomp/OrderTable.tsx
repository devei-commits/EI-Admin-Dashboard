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
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-4 py-2 text-left font-medium">
              Order ID
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left font-medium">
              Company Name
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left font-medium">
              Doctor Clinic Address
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left font-medium">
              Date Registered
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left font-medium">
              Order Status
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.orderId} className="hover:bg-gray-50">
              <td className="border border-gray-300 px-4 py-2">
                {order.orderId}
              </td>
              <td className="border border-gray-300 px-4 py-2">
                {order.companyName}
              </td>
              <td className="border border-gray-300 px-4 py-2">
                {order.doctorClinicAddress}
              </td>
              <td className="border border-gray-300 px-4 py-2">
                {order.dateRegistered}
              </td>
              <td className="border border-gray-300 px-4 py-2">
                {order.orderStatus}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default OrderTable;