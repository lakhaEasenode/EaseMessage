
import { useState, useContext, useRef, useEffect } from 'react';
import { Bell, User, LogOut, ChevronDown, ChevronUp, Menu } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Header = ({ onMenuClick }) => {
    const { user, logout } = useContext(AuthContext);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-10 transition-all duration-300">
            {/* Left side */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onMenuClick}
                    className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg md:hidden"
                >
                    <Menu size={24} />
                </button>
            </div>

            {/* Right side - Actions & Profile */}
            <div className="flex items-center gap-4">
                {/* Notification Icon */}
                <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-full transition-colors relative">
                    <Bell size={20} />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                </button>

                <div className="h-6 w-px bg-gray-200 mx-1"></div>

                {/* User Profile Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="flex items-center gap-3 hover:bg-gray-50 p-1.5 pr-3 rounded-full transition-all border border-transparent hover:border-gray-100"
                    >
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                            {user?.firstName ? user.firstName.charAt(0).toUpperCase() : <User size={16} />}
                        </div>
                        <div className="hidden md:block text-left">
                            <p className="text-sm font-medium text-gray-700 leading-none">
                                {user?.firstName || 'User'}
                            </p>
                            {user?.businessName && (
                                <p className="text-[10px] text-gray-400 mt-0.5 leading-none">
                                    {user.businessName}
                                </p>
                            )}
                        </div>
                        {dropdownOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </button>

                    {/* Dropdown Menu */}
                    {dropdownOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                            <div className="px-4 py-2 border-b border-gray-50 md:hidden">
                                <p className="text-sm font-medium text-gray-800">{user?.firstName}</p>
                                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                            >
                                <LogOut size={16} />
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
