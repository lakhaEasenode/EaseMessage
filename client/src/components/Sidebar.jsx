import { LayoutDashboard, Users, Megaphone, MessageSquare, Settings, MessageCircle, FileText, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useState } from 'react';

const Sidebar = ({ mobile, onClose }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Megaphone, label: 'Campaigns', path: '/campaigns' },
        { icon: Users, label: 'Contacts', path: '/contacts' },
        { icon: MessageSquare, label: 'Inbox', path: '/inbox' },
        { icon: MessageCircle, label: 'WhatsApp Accounts', path: '/whatsapp-accounts' },
        { icon: FileText, label: 'Templates', path: '/templates' },
    ];

    // Force expanded on mobile
    const collapsed = mobile ? false : isCollapsed;

    return (
        <aside
            className={`${collapsed ? 'w-20' : mobile ? 'w-full' : 'w-64'} bg-white border-r border-primary-100 h-screen flex flex-col justify-between p-4 shadow-sm transition-all duration-300 ease-in-out relative`}
        >
            <div>
                {/* Logo Section */}
                <div className={`flex items-center mb-8 px-2 ${collapsed ? 'justify-center' : 'justify-between'}`}>
                    <div className="flex items-center gap-2">
                        <div className="min-w-8 w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold">
                            E
                        </div>
                        {!collapsed && (
                            <span className="text-xl font-bold text-gray-800 whitespace-nowrap overflow-hidden animate-in fade-in duration-200">
                                EaseMessage
                            </span>
                        )}
                    </div>
                    {mobile && (
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Navigation Items */}
                <nav className="space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={mobile ? onClose : undefined}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${isActive
                                    ? 'bg-primary-50 text-primary-600 font-medium'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                } ${collapsed ? 'justify-center' : ''}`
                            }
                            title={collapsed ? item.label : ''}
                        >
                            <item.icon size={20} className="min-w-[20px]" />
                            {!collapsed && (
                                <span className="whitespace-nowrap overflow-hidden animate-in fade-in duration-200">
                                    {item.label}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2">
                {/* Settings Link */}
                <NavLink
                    to="/settings"
                    onClick={mobile ? onClose : undefined}
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                            ? 'bg-primary-50 text-primary-600 font-medium'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        } ${collapsed ? 'justify-center' : ''}`
                    }
                    title={collapsed ? 'Settings' : ''}
                >
                    <Settings size={20} className="min-w-[20px]" />
                    {!collapsed && (
                        <span className="whitespace-nowrap overflow-hidden animate-in fade-in duration-200">
                            Settings
                        </span>
                    )}
                </NavLink>

                {/* Collapse Toggle - Hide on mobile */}
                {!mobile && (
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600 rounded-lg transition-colors justify-center"
                        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                    >
                        {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    </button>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
