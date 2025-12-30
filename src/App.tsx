import Ordermanagement from './pages/Ordermanagement.tsx'
import RoleManagement from './pages/RoleManagement.tsx'
import Sidebar from "./components/sidebar/sidebar"

const App = () => {
  return (
    <div>
      <div className="flex flex-row">
        <Sidebar />
        <Ordermanagement />
        <RoleManagement />
      </div>
    </div>
  )
}

export default App

