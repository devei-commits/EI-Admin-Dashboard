import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import eilogofull from "../../assets/logo/eilogofull.svg";

const Sidebar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [enquiryOpen, setEnquiryOpen] = useState(false);
    const location = useLocation();

    // Check if any enquiry submenu item is active
    const isEnquiryActive = [
        '/enquiry-management',
        '/doctor-appointments',
        '/contact-enquiry',
        '/new-developments',
        '/product-samples'
    ].includes(location.pathname);

    // Auto-open dropdown when navigating to enquiry pages, close when navigating away
    useEffect(() => {
        if (isEnquiryActive && !enquiryOpen) {
            setEnquiryOpen(true);
        } else if (!isEnquiryActive && enquiryOpen) {
            setEnquiryOpen(false);
        }
    }, [location.pathname, isEnquiryActive, enquiryOpen]);

    const linkClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
            isActive
                ? "bg-amber-50 text-amber-700 font-semibold border-l-4 border-amber-500"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent"
        }`;

    const handleLinkClick = () => {
        setIsOpen(false);
    };

    return (
        <>
            {/* Mobile Header Bar */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-50 flex items-center px-4 shadow-sm">
                <button
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
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
                    className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-30 mt-14"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
                className={`fixed md:static h-screen md:h-screen flex flex-col bg-white border-r border-gray-200 z-40 transition-transform duration-300 ease-in-out w-64 shadow-sm
                    ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
                    mt-14 md:mt-0`}
            >
                {/* Logo Section - Hidden on mobile since it's in the header */}
                <div className="hidden md:flex p-5 items-center justify-center border-b border-gray-100 bg-linear-to-r from-gray-50 to-white">
                    <img src={eilogofull} alt="Logo" className="max-h-10 max-w-full object-contain" />
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 p-4 overflow-y-auto">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 mb-3">Menu</p>
                    <ul className="space-y-1">
                        <li>
                            <NavLink to="/" className={linkClass} onClick={handleLinkClick}>
                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                <span className="font-medium">Dashboard</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/role-management" className={linkClass} onClick={handleLinkClick}>
                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                <span className="font-medium">Role Management</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/user-management" className={linkClass} onClick={handleLinkClick}>
                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                                <span className="font-medium">User Management</span>
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/order-management" className={linkClass} onClick={handleLinkClick}>
                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                                <span className="font-medium">Order Management</span>
                            </NavLink>
                        </li>
                        <li>
                            <div className={`rounded-lg transition-all duration-200 ${
                                isEnquiryActive || enquiryOpen
                                    ? "bg-amber-50 text-amber-700 font-semibold border-l-4 border-amber-500"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent"
                            }`}>
                                <div className="flex items-center">
                                    <NavLink
                                        to="/enquiry-management"
                                        className="flex-1 flex items-center px-4 py-3"
                                        onClick={handleLinkClick}
                                    >
                                        <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                        </svg>
                                        <span className="font-medium">Enquiry Management</span>
                                    </NavLink>
                                    <button
                                        onClick={() => setEnquiryOpen(!enquiryOpen)}
                                        className="p-2 rounded hover:bg-amber-100 transition-colors"
                                    >
                                        <svg
                                            className={`w-5 h-5 transition-transform duration-300 ease-in-out ${enquiryOpen ? "rotate-180" : ""}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            {/* Submenu with smooth animation */}
                            <div
                                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                                    enquiryOpen ? "max-h-96" : "max-h-0"
                                }`}
                            >
                                <ul className="bg-gradient-to-b from-amber-50/30 to-gray-50/50 border-l-2 border-amber-200 ml-4 my-2 py-2 space-y-1">
                                    <li>
                                        <NavLink
                                            to="/doctor-appointments"
                                            className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${
                                                isActive
                                                    ? "bg-amber-100 text-amber-700 font-semibold"
                                                    : "text-gray-600 hover:bg-white hover:text-amber-700"
                                            }`}
                                            onClick={handleLinkClick}
                                        >
                                            <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span>Doctor Appointments</span>
                                        </NavLink>
                                    </li>
                                    <li>
                                        <NavLink
                                            to="/contact-enquiry"
                                            className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${
                                                isActive
                                                    ? "bg-amber-100 text-amber-700 font-semibold"
                                                    : "text-gray-600 hover:bg-white hover:text-amber-700"
                                            }`}
                                            onClick={handleLinkClick}
                                        >
                                            <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                            <span>Contact Enquiry</span>
                                        </NavLink>
                                    </li>
                                    <li>
                                        <NavLink
                                            to="/new-developments"
                                            className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${
                                                isActive
                                                    ? "bg-amber-100 text-amber-700 font-semibold"
                                                    : "text-gray-600 hover:bg-white hover:text-amber-700"
                                            }`}
                                            onClick={handleLinkClick}
                                        >
                                            <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            <span>New Developments</span>
                                        </NavLink>
                                    </li>
                                    <li>
                                        <NavLink
                                            to="/product-samples"
                                            className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-lg transition-all duration-200 text-sm group ${
                                                isActive
                                                    ? "bg-amber-100 text-amber-700 font-semibold"
                                                    : "text-gray-600 hover:bg-white hover:text-amber-700"
                                            }`}
                                            onClick={handleLinkClick}
                                        >
                                            <svg className="w-4 h-4 mr-2 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                            <span>Product Samples</span>
                                        </NavLink>
                                    </li>
                                </ul>
                            </div>
                        </li>
                    </ul>
                </nav>

                {/* Footer Section */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                    <p className="text-xs text-gray-400 text-center">© 2025 Esthetic Insights</p>
                </div>
            </div>
        </>
    )
}

export default Sidebar
