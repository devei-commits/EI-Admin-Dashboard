import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import RoleManagement from './pages/RoleManagement'
import UserManagement from './pages/UserManagement'
import OrderManagement from './pages/OrderManagement'
import EnquiryManagement from './pages/EnquiryManagement'
import Sidebar from "./components/sidebar/sidebar"

const App = () => {
  return (
    <BrowserRouter>
      <div className="flex flex-row">
        <Sidebar />
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/role-management" element={<RoleManagement />} />
            <Route path="/user-management" element={<UserManagement />} />
            <Route path="/order-management" element={<OrderManagement />} />
            <Route path="/enquiry-management" element={<EnquiryManagement />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App

