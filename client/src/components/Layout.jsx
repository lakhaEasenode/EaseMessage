import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { X } from 'lucide-react';

const Layout = () => {
    const location = useLocation();
    const isInbox = location.pathname === '/inbox';
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden md:block h-full">
                <Sidebar />
            </div>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
                        onClick={() => setSidebarOpen(false)}
                    ></div>

                    {/* Sidebar Drawer */}
                    <div className="relative flex-1 w-full max-w-[18rem] bg-white h-full shadow-2xl animate-in slide-in-from-left duration-200">
                        <div className="absolute top-2 right-2 z-50">
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="p-2 bg-white/10 text-gray-500 hover:text-gray-900 rounded-lg"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <Sidebar mobile onClose={() => setSidebarOpen(false)} />
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full relative">
                <Header onMenuClick={() => setSidebarOpen(true)} />
                <main className={`flex-1 ${isInbox ? 'p-0 overflow-hidden' : 'p-4 md:p-6 overflow-auto'} w-full`}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
