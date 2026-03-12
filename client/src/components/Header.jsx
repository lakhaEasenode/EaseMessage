import { useState, useContext, useRef, useEffect } from 'react';
import { Bell, User, LogOut, ChevronDown, ChevronUp, Menu, Briefcase, Check } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { usePageHeader } from '../context/PageHeaderContext';
import { useNavigate } from 'react-router-dom';

const Header = ({ onMenuClick }) => {
    const { user, logout, switchWorkspace } = useContext(AuthContext);
    const { header } = usePageHeader();
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
    const [switchingWorkspace, setSwitchingWorkspace] = useState(false);
    const profileDropdownRef = useRef(null);
    const workspaceDropdownRef = useRef(null);
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleWorkspaceSwitch = async (workspaceId) => {
        if (!workspaceId || workspaceId === user?.activeWorkspaceId) {
            setWorkspaceDropdownOpen(false);
            return;
        }

        try {
            setSwitchingWorkspace(true);
            await switchWorkspace(workspaceId);
        } finally {
            setSwitchingWorkspace(false);
            setWorkspaceDropdownOpen(false);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
                setProfileDropdownOpen(false);
            }
            if (workspaceDropdownRef.current && !workspaceDropdownRef.current.contains(event.target)) {
                setWorkspaceDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-5 md:px-8 flex-shrink-0 z-10 transition-all duration-300">
            {/* Left side — mobile menu + page title */}
            <div className="flex items-center gap-3 min-w-0">
                <button
                    onClick={onMenuClick}
                    className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg md:hidden flex-shrink-0"
                >
                    <Menu size={24} />
                </button>
                {header.title && (
                    <div className="min-w-0">
                        <h1 className="text-base font-semibold text-gray-800 leading-tight truncate">
                            {header.title}
                        </h1>
                        {header.subtitle && (
                            <p className="text-xs text-gray-400 leading-tight truncate hidden sm:block">
                                {header.subtitle}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Right side — page actions + profile */}
            <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
                {/* Per-page action buttons */}
                {header.actions && (
                    <>
                        <div className="flex items-center gap-2">{header.actions}</div>
                        <div className="h-5 w-px bg-gray-200"></div>
                    </>
                )}
                {/* Notification Icon */}
                <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-full transition-colors relative">
                    <Bell size={20} />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                </button>

                <div className="relative hidden sm:block" ref={workspaceDropdownRef}>
                    <button
                        onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
                        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-primary-200 hover:bg-primary-50/40"
                        disabled={switchingWorkspace}
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
                            <Briefcase size={16} />
                        </div>
                        <div className="min-w-0 max-w-44">
                            <p className="truncate text-sm font-semibold text-gray-800">
                                {user?.currentWorkspace?.name || 'Workspace'}
                            </p>
                            <p className="truncate text-[11px] text-gray-500">
                                {user?.currentWorkspace?.companyName || 'Personal workspace'}
                            </p>
                        </div>
                        {workspaceDropdownOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </button>

                    {workspaceDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-gray-100 bg-white py-2 shadow-lg">
                            <div className="border-b border-gray-100 px-4 pb-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Workspace</p>
                                <p className="mt-1 text-sm text-gray-600">Select the organization you want to work in.</p>
                            </div>
                            <div className="max-h-72 overflow-auto py-2">
                                {(user?.workspaces || []).map((membership) => {
                                    const workspace = membership.workspace;
                                    const isActive = workspace.id === user?.activeWorkspaceId;

                                    return (
                                        <button
                                            key={membership.id}
                                            onClick={() => handleWorkspaceSwitch(workspace.id)}
                                            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                                                isActive ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isActive ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'}`}>
                                                {workspace.name?.charAt(0)?.toUpperCase() || 'W'}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium">{workspace.name}</p>
                                                <p className="truncate text-xs text-gray-500">
                                                    {workspace.companyName || 'No company name'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                                    {membership.role}
                                                </span>
                                                {isActive && <Check size={16} className="text-primary-600" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="h-6 w-px bg-gray-200 mx-1"></div>

                {/* User Profile Dropdown */}
                <div className="relative" ref={profileDropdownRef}>
                    <button
                        onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                        className="flex items-center gap-3 hover:bg-gray-50 p-1.5 pr-3 rounded-full transition-all border border-transparent hover:border-gray-100"
                    >
                        <div className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold text-sm">
                            {user?.firstName ? user.firstName.charAt(0).toUpperCase() : <User size={16} />}
                        </div>
                        <div className="hidden md:block text-left">
                            <p className="text-sm font-medium text-gray-700 leading-none">
                                {user?.firstName || 'User'}
                            </p>
                            {user?.email && (
                                <p className="text-[10px] text-gray-400 mt-0.5 leading-none">
                                    {user.email}
                                </p>
                            )}
                        </div>
                        {profileDropdownOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </button>

                    {/* Dropdown Menu */}
                    {profileDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                            <div className="px-4 py-2 border-b border-gray-50 md:hidden">
                                <p className="text-sm font-medium text-gray-800">{user?.firstName}</p>
                                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                            </div>

                            <button
                                onClick={() => {
                                    setProfileDropdownOpen(false);
                                    navigate('/settings');
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                            >
                                <User size={16} />
                                Settings
                            </button>

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
