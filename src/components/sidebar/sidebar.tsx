import { useState } from "react";
import { NavLink } from "react-router-dom";
import eilogofull from "../../assets/logo/eilogofull.svg";

const Sidebar = () => {
    const [isOpen, setIsOpen] = useState(false);

    const linkClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center px-4 py-3 rounded-lg transition-colors ${
            isActive
                ? "bg-gray-200 text-gray-900 font-semibold"
                : "text-gray-700 hover:bg-gray-100"
        }`;

    const handleLinkClick = () => {
        setIsOpen(false);
    };

    return (
        <>
            {/* Mobile Header Bar */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-50 flex items-center px-4">
                <button
                    className="p-2 rounded-lg hover:bg-gray-100"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <svg
                        className="w-6 h-6 text-gray-700"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        {isOpen ? (
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        ) : (
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 6h16M4 12h16M4 18h16"
                            />
                        )}
                    </svg>
                </button>
                <img src={eilogofull} alt="Logo" className="h-8 ml-3 object-contain" />
            </div>

            {/* Overlay - Mobile Only */}
            {isOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30 mt-14"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
                className={`fixed md:static h-screen md:h-screen flex flex-col bg-white border-r border-gray-200 z-40 transition-transform duration-300 ease-in-out w-64
                    ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
                    mt-14 md:mt-0`}
            >
                {/* Logo Section - Hidden on mobile since it's in the header */}
                <div className="hidden md:flex p-4 items-center justify-center border-b border-gray-200">
                    <img src={eilogofull} alt="Logo" className="max-h-10 max-w-full object-contain" />
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 p-4 overflow-y-auto">
                    <ul className="space-y-2">
                        <li>
                            <NavLink to="/" className={linkClass} onClick={handleLinkClick}>
                                <span className="font-medium">Dashboard</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/role-management" className={linkClass} onClick={handleLinkClick}>
                                <span className="font-medium">Role Management</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/user-management" className={linkClass} onClick={handleLinkClick}>
                                <span className="font-medium">User Management</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/order-management" className={linkClass} onClick={handleLinkClick}>
                                <span className="font-medium">Order Management</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/enquiry-management" className={linkClass} onClick={handleLinkClick}>
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
        </>
    )
}

export default Sidebar
