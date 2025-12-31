import { NavLink } from "react-router-dom";
import eilogofull from "../../assets/logo/eilogofull.svg";

const Sidebar = () => {
    const linkClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center px-4 py-3 rounded-lg transition-colors ${
            isActive
                ? "bg-gray-200 text-gray-900 font-semibold"
                : "text-gray-700 hover:bg-gray-100"
        }`;

    return (
        <div className="w-64 h-screen flex flex-col bg-white border-r border-gray-200">
            {/* Logo Section */}
            <div className="p-4 flex items-center justify-center border-b border-gray-200">
                <img src={eilogofull} alt="Logo" className="max-h-10 max-w-full object-contain" />
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 p-4">
                <ul className="space-y-2">
                    <li>
                        <NavLink to="/" className={linkClass}>
                            <span className="font-medium">Dashboard</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/role-management" className={linkClass}>
                            <span className="font-medium">Role Management</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/user-management" className={linkClass}>
                            <span className="font-medium">User Management</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/order-management" className={linkClass}>
                            <span className="font-medium">Order Management</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/enquiry-management" className={linkClass}>
                            <span className="font-medium">Enquiry Management</span>
                        </NavLink>
                    </li>
                </ul>
            </nav>

            {/* Footer Section (optional) */}
            <div className="p-4 border-t border-gray-200">
                <p className="text-sm text-gray-500 text-center">© 2025 Eisthetic</p>
            </div>
        </div>
    )
}

export default Sidebar
