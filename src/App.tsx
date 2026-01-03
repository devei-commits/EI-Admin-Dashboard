import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import RoleManagement from './pages/RoleManagement'
import UserManagement from './pages/UserManagement'
import OrderManagement from './pages/OrderManagement'
import EnquiryManagement from './pages/EnquiryManagement'
import DoctorAppointments from './pages/DoctorAppointments'
import ContactEnquiry from './pages/ContactEnquiry'
import NewDevelopments from './pages/NewDevelopments'
import ProductSamples from './pages/ProductSamples'
import Sidebar from "./components/sidebar/sidebar"

const App = () => {
  return (
    <BrowserRouter>
      <div className="flex flex-row min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 pt-14 md:pt-0 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/role-management" element={<RoleManagement />} />
            <Route path="/user-management" element={<UserManagement />} />
            <Route path="/order-management" element={<OrderManagement />} />
            <Route path="/enquiry-management" element={<EnquiryManagement />} />
            <Route path="/doctor-appointments" element={<DoctorAppointments />} />
            <Route path="/contact-enquiry" element={<ContactEnquiry />} />
            <Route path="/new-developments" element={<NewDevelopments />} />
            <Route path="/product-samples" element={<ProductSamples />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App

