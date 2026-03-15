import { useContext, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { PageHeaderProvider } from '../context/PageHeaderContext';
import AuthContext from '../context/AuthContext';

const Layout = () => {
    const location = useLocation();
    const isInbox = location.pathname === '/inbox';
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user } = useContext(AuthContext);
    const workspaceKey = user?.activeWorkspaceId || 'default-workspace';

    return (
        <PageHeaderProvider>
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
                        <div className="flex-1 w-full max-w-[18rem] bg-white h-full shadow-2xl animate-in slide-in-from-left duration-200">
                            <Sidebar mobile onClose={() => setSidebarOpen(false)} />
                        </div>
                    </div>
                )}

                <div className="flex-1 flex flex-col h-screen overflow-hidden w-full relative pt-4">
                    <Header onMenuClick={() => setSidebarOpen(true)} />
                    <main
                        key={workspaceKey}
                        className={`flex-1 ${
                            isInbox
                                ? 'p-0 overflow-hidden'
                                : 'px-2 pb-2 pt-2 overflow-auto'
                        } w-full`}
                    >
                        <Outlet />
                    </main>
                </div>
            </div>
        </PageHeaderProvider>
    );
};

export default Layout;
