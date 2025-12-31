import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/dashboard'
import RoleManagement from './pages/RoleManagement'
import Usermanagement from './pages/Usermanagement'
import Ordermanagement from './pages/OrderManagement'
import Enquirymanagement from './pages/Enquirymanagement'
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
            <Route path="/user-management" element={<Usermanagement />} />
            <Route path="/order-management" element={<Ordermanagement />} />
            <Route path="/enquiry-management" element={<Enquirymanagement />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App

