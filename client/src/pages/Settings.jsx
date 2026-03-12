import { useState, useContext, useEffect, useCallback } from 'react';
import { User, Lock, Building, Save, CheckCircle, AlertCircle, Users, MailPlus } from 'lucide-react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { usePageHeader } from '../context/PageHeaderContext';

const Settings = () => {
    const { user, token, loadUser, refreshWorkspaces } = useContext(AuthContext);
    const { setHeader } = usePageHeader();
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [workspaceLoading, setWorkspaceLoading] = useState(false);
    const [msg, setMsg] = useState(null); // { type: 'success' | 'error', text: '' }

    const [profile, setProfile] = useState({
        firstName: '',
        businessName: '',
        email: ''
    });

    const [password, setPassword] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [workspace, setWorkspace] = useState({
        name: '',
        companyName: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        countryCode: '',
        postalCode: '',
        taxId: ''
    });
    const [members, setMembers] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [inviteForm, setInviteForm] = useState({
        email: '',
        role: 'member'
    });

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';
    const workspaceRole = user?.currentWorkspace?.role;
    const canManageWorkspace = workspaceRole === 'owner' || workspaceRole === 'admin';

    useEffect(() => {
        setHeader({ title: 'Settings', subtitle: null, actions: null });
        return () => setHeader({ title: '', subtitle: null, actions: null });
    }, [setHeader]);

    useEffect(() => {
        if (user) {
            setProfile({
                firstName: user.firstName || '',
                businessName: user.businessName || '',
                email: user.email || ''
            });

            setWorkspace({
                name: user.currentWorkspace?.name || '',
                companyName: user.currentWorkspace?.companyName || '',
                addressLine1: user.currentWorkspace?.addressLine1 || '',
                addressLine2: user.currentWorkspace?.addressLine2 || '',
                city: user.currentWorkspace?.city || '',
                state: user.currentWorkspace?.state || '',
                countryCode: user.currentWorkspace?.countryCode || '',
                postalCode: user.currentWorkspace?.postalCode || '',
                taxId: user.currentWorkspace?.taxId || ''
            });
        }
    }, [user]);

    const showMsg = (type, text) => {
        setMsg({ type, text });
        setTimeout(() => setMsg(null), 3000);
    };

    const getAuthConfig = useCallback(() => ({
        headers: {
            'x-auth-token': token
        }
    }), [token]);

    const fetchWorkspaceData = useCallback(async () => {
        if (!token) return;

        try {
            const [workspaceRes, membersRes, invitationsRes] = await Promise.all([
                axios.get(`${API_URL}/workspaces/current`, getAuthConfig()),
                axios.get(`${API_URL}/workspaces/current/members`, getAuthConfig()),
                axios.get(`${API_URL}/workspaces/current/invitations`, getAuthConfig())
            ]);

            setWorkspace({
                name: workspaceRes.data.workspace?.name || '',
                companyName: workspaceRes.data.workspace?.companyName || '',
                addressLine1: workspaceRes.data.workspace?.addressLine1 || '',
                addressLine2: workspaceRes.data.workspace?.addressLine2 || '',
                city: workspaceRes.data.workspace?.city || '',
                state: workspaceRes.data.workspace?.state || '',
                countryCode: workspaceRes.data.workspace?.countryCode || '',
                postalCode: workspaceRes.data.workspace?.postalCode || '',
                taxId: workspaceRes.data.workspace?.taxId || ''
            });
            setMembers(membersRes.data.members || []);
            setInvitations(invitationsRes.data.invitations || []);
        } catch (err) {
            showMsg('error', err.response?.data?.msg || 'Failed to load workspace settings');
        }
    }, [API_URL, getAuthConfig, token]);

    useEffect(() => {
        if (token) {
            fetchWorkspaceData();
        }
    }, [token, user?.activeWorkspaceId, fetchWorkspaceData]);

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await axios.put(`${API_URL}/auth/profile`, profile, getAuthConfig());
            showMsg('success', 'Profile updated successfully');
            await loadUser(); // Refresh global user state
        } catch (err) {
            showMsg('error', err.response?.data?.msg || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (password.newPassword !== password.confirmPassword) {
            showMsg('error', 'New passwords do not match');
            return;
        }
        setLoading(true);
        try {
            await axios.put(`${API_URL}/auth/password`, {
                currentPassword: password.currentPassword,
                newPassword: password.newPassword
            }, getAuthConfig());
            showMsg('success', 'Password updated successfully');
            setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            showMsg('error', err.response?.data?.msg || 'Failed to update password');
        } finally {
            setLoading(false);
        }
    };

    const handleWorkspaceSubmit = async (e) => {
        e.preventDefault();
        setWorkspaceLoading(true);
        try {
            await axios.put(`${API_URL}/workspaces/current`, workspace, getAuthConfig());
            await refreshWorkspaces();
            await fetchWorkspaceData();
            showMsg('success', 'Workspace updated successfully');
        } catch (err) {
            showMsg('error', err.response?.data?.msg || 'Failed to update workspace');
        } finally {
            setWorkspaceLoading(false);
        }
    };

    const handleInviteSubmit = async (e) => {
        e.preventDefault();
        setWorkspaceLoading(true);
        try {
            await axios.post(`${API_URL}/workspaces/current/invitations`, inviteForm, getAuthConfig());
            setInviteForm({ email: '', role: 'member' });
            await fetchWorkspaceData();
            await refreshWorkspaces();
            showMsg('success', 'Invitation added successfully');
        } catch (err) {
            showMsg('error', err.response?.data?.msg || 'Failed to add member invitation');
        } finally {
            setWorkspaceLoading(false);
        }
    };

    const tabs = [
        { id: 'profile', label: 'Profile' },
        { id: 'workspace', label: 'Workspace' }
    ];

    const teamEntries = [
        ...members.map((member) => ({
            id: `member-${member.id}`,
            kind: 'accepted',
            title: member.user?.firstName || 'Member',
            subtitle: member.user?.email || 'No email available',
            role: member.role,
            statusLabel: 'Accepted',
            statusClass: 'bg-emerald-100 text-emerald-700'
        })),
        ...invitations.map((invite) => ({
            id: `invite-${invite.id}`,
            kind: 'pending',
            title: invite.email,
            subtitle: `Invited on ${new Date(invite.createdAt).toLocaleDateString()}`,
            role: invite.role,
            statusLabel: 'Pending',
            statusClass: 'bg-amber-100 text-amber-700'
        }))
    ];

    return (
        <div className="max-w-6xl mx-auto h-full flex flex-col">
            {msg && (
                <div className={`mb-2 p-4 rounded-xl flex items-center gap-3 ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {msg.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    {msg.text}
                </div>
            )}

            <div className="mb-4 flex flex-wrap gap-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                            activeTab === tab.id
                                ? 'bg-primary-600 text-white shadow-sm'
                                : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-200 hover:text-primary-700'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'profile' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-fit">
                        <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
                            <div className="p-2 bg-primary-100 text-primary-600 rounded-lg">
                                <User size={18} />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-gray-800">Profile Settings</h2>
                                <p className="text-xs text-gray-500">Update your personal information</p>
                            </div>
                        </div>
                        <div className="p-5">
                            <form onSubmit={handleProfileSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">First Name</label>
                                    <input
                                        type="text"
                                        value={profile.firstName}
                                        onChange={e => setProfile({ ...profile, firstName: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Business Name</label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input
                                            type="text"
                                            value={profile.businessName}
                                            onChange={e => setProfile({ ...profile, businessName: e.target.value })}
                                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                            placeholder="Company Name"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Email Address</label>
                                    <input
                                        type="email"
                                        value={profile.email}
                                        disabled
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed text-sm"
                                    />
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        <Save size={16} />
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-fit">
                        <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
                            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                                <Lock size={18} />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-gray-800">Security</h2>
                                <p className="text-xs text-gray-500">Update your password</p>
                            </div>
                        </div>
                        <div className="p-5">
                            <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Current Password</label>
                                    <input
                                        type="password"
                                        value={password.currentPassword}
                                        onChange={e => setPassword({ ...password, currentPassword: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">New Password</label>
                                    <input
                                        type="password"
                                        value={password.newPassword}
                                        onChange={e => setPassword({ ...password, newPassword: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Confirm New</label>
                                    <input
                                        type="password"
                                        value={password.confirmPassword}
                                        onChange={e => setPassword({ ...password, confirmPassword: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                    />
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex items-center gap-2 px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        <Save size={16} />
                                        Update Password
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] gap-4">
                    <div className="space-y-4">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
                                <div className="p-2 bg-primary-100 text-primary-600 rounded-lg">
                                    <Building size={18} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-gray-800">Workspace Settings</h2>
                                    <p className="text-xs text-gray-500">Manage the organization your team is working in</p>
                                </div>
                            </div>
                            <div className="p-5">
                                <form onSubmit={handleWorkspaceSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Workspace Name</label>
                                        <input
                                            type="text"
                                            value={workspace.name}
                                            onChange={e => setWorkspace({ ...workspace, name: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                            disabled={!canManageWorkspace}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Company Name</label>
                                        <input
                                            type="text"
                                            value={workspace.companyName}
                                            onChange={e => setWorkspace({ ...workspace, companyName: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                            placeholder="Add your company name"
                                            disabled={!canManageWorkspace}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Address Line 1</label>
                                            <input
                                                type="text"
                                                value={workspace.addressLine1}
                                                onChange={e => setWorkspace({ ...workspace, addressLine1: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                                placeholder="Street address, building name"
                                                disabled={!canManageWorkspace}
                                            />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Address Line 2</label>
                                            <input
                                                type="text"
                                                value={workspace.addressLine2}
                                                onChange={e => setWorkspace({ ...workspace, addressLine2: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                                placeholder="Suite, floor, landmark"
                                                disabled={!canManageWorkspace}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">City</label>
                                            <input
                                                type="text"
                                                value={workspace.city}
                                                onChange={e => setWorkspace({ ...workspace, city: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                                disabled={!canManageWorkspace}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">State</label>
                                            <input
                                                type="text"
                                                value={workspace.state}
                                                onChange={e => setWorkspace({ ...workspace, state: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                                disabled={!canManageWorkspace}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Country Code</label>
                                            <input
                                                type="text"
                                                value={workspace.countryCode}
                                                onChange={e => setWorkspace({ ...workspace, countryCode: e.target.value.toUpperCase() })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                                placeholder="IN"
                                                disabled={!canManageWorkspace}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">PIN / Postal Code</label>
                                            <input
                                                type="text"
                                                value={workspace.postalCode}
                                                onChange={e => setWorkspace({ ...workspace, postalCode: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                                disabled={!canManageWorkspace}
                                            />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">GST No / Tax ID</label>
                                            <input
                                                type="text"
                                                value={workspace.taxId}
                                                onChange={e => setWorkspace({ ...workspace, taxId: e.target.value })}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                                placeholder="GSTIN or tax identifier"
                                                disabled={!canManageWorkspace}
                                            />
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                                        Active role: <span className="font-semibold text-gray-900 capitalize">{workspaceRole || 'member'}</span>
                                    </div>
                                    <div className="flex justify-end pt-2">
                                        <button
                                            type="submit"
                                            disabled={workspaceLoading || !canManageWorkspace}
                                            className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
                                        >
                                            <Save size={16} />
                                            Save Workspace
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
                                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                    <Users size={18} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-gray-800">Team</h2>
                                    <p className="text-xs text-gray-500">Accepted members and pending invitations in one place</p>
                                </div>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {teamEntries.map((entry) => (
                                    <div key={entry.id} className="flex items-center justify-between gap-3 px-5 py-4">
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">{entry.title}</p>
                                            <p className="text-xs text-gray-500">{entry.subtitle}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                                                {entry.role}
                                            </span>
                                            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${entry.statusClass}`}>
                                                {entry.statusLabel}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {teamEntries.length === 0 && (
                                    <div className="px-5 py-6 text-sm text-gray-500">No members or invitations found in this workspace yet.</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
                                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                    <MailPlus size={18} />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-gray-800">Add Members</h2>
                                    <p className="text-xs text-gray-500">Invite teammates into this workspace</p>
                                </div>
                            </div>
                            <div className="p-5">
                                <form onSubmit={handleInviteSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Email Address</label>
                                        <input
                                            type="email"
                                            value={inviteForm.email}
                                            onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                            placeholder="teammate@company.com"
                                            disabled={!canManageWorkspace}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Role</label>
                                        <select
                                            value={inviteForm.role}
                                            onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm bg-white"
                                            disabled={!canManageWorkspace}
                                        >
                                            <option value="member">Member</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={workspaceLoading || !canManageWorkspace}
                                        className="w-full flex items-center justify-center gap-2 px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        <MailPlus size={16} />
                                        Add Member
                                    </button>
                                </form>
                                {!canManageWorkspace && (
                                    <p className="mt-3 text-xs text-amber-600">Only owners and admins can update workspace details or add members.</p>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
