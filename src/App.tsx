import Dashboard from "./pages/dashboard"
import Sidebar from "./components/sidebar/sidebar"
const App = () => {
  return (
    <div>
      <div className="flex flex-row">
        <Sidebar />
        <Dashboard />
      </div>
    </div>

  )
}

export default App
