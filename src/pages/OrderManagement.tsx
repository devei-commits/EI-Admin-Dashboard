
import { OrderTable } from '../components/ordermanagementcomp';

const Ordermanagement = () => {
  return (
    <div className="p-4 bg-white rounded shadow min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Order Management</h1>
      <OrderTable />
    </div>
  )
}

export default Ordermanagement
