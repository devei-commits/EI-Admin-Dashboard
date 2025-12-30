import Ordermanagement from "./pages/OrderManagement.tsx"
import Sidebar from "./components/sidebar/sidebar"
const App = () => {
  return (
    <div>
      <div className="flex flex-row">
        <Sidebar />
        <Ordermanagement />
      </div>
    </div>

  )
}

export default App
