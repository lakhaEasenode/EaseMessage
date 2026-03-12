import { useState, useContext, useEffect, useCallback } from 'react';
import { User, Lock, Building, Save, CheckCircle, AlertCircle, Users, MailPlus, CreditCard, Pencil, X } from 'lucide-react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { usePageHeader } from '../context/PageHeaderContext';
import { COUNTRIES, getCountryName } from '../data/countries';
import EnterpriseRequestModal from '../components/EnterpriseRequestModal';

const Settings = () => {
    const { user, token, loadUser, refreshWorkspaces } = useContext(AuthContext);
    const { setHeader } = usePageHeader();
    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [workspaceLoading, setWorkspaceLoading] = useState(false);
    const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
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
    const [billing, setBilling] = useState(user?.billing || null);
    const [billingInvoices, setBillingInvoices] = useState([]);
    const [billingCycle, setBillingCycle] = useState('monthly');
    const [loadingPlan, setLoadingPlan] = useState(null);
    const [plans, setPlans] = useState([]);
    const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
    const [enterpriseModalOpen, setEnterpriseModalOpen] = useState(false);
    const [enterpriseLoading, setEnterpriseLoading] = useState(false);

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
                city: user.currentWorkspace?.city || '',
                state: user.currentWorkspace?.state || '',
                countryCode: user.currentWorkspace?.countryCode || '',
                postalCode: user.currentWorkspace?.postalCode || '',
                taxId: user.currentWorkspace?.taxId || ''
            });
            setBilling(user.currentWorkspace?.billing || user.billing || null);
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
            setWorkspaceLoaded(false);
            const [workspaceRes, membersRes, invitationsRes, billingRes, invoicesRes] = await Promise.all([
                axios.get(`${API_URL}/workspaces/current`, getAuthConfig()),
                axios.get(`${API_URL}/workspaces/current/members`, getAuthConfig()),
                axios.get(`${API_URL}/workspaces/current/invitations`, getAuthConfig()),
                axios.get(`${API_URL}/billing/current`, getAuthConfig()),
                axios.get(`${API_URL}/billing/invoices`, getAuthConfig())
            ]);

            setWorkspace({
                name: workspaceRes.data.workspace?.name || '',
                companyName: workspaceRes.data.workspace?.companyName || '',
                addressLine1: workspaceRes.data.workspace?.addressLine1 || '',
                city: workspaceRes.data.workspace?.city || '',
                state: workspaceRes.data.workspace?.state || '',
                countryCode: workspaceRes.data.workspace?.countryCode || '',
                postalCode: workspaceRes.data.workspace?.postalCode || '',
                taxId: workspaceRes.data.workspace?.taxId || ''
            });
            setMembers(membersRes.data.members || []);
            setInvitations(invitationsRes.data.invitations || []);
            setBilling(billingRes.data.billing || null);
            setBillingInvoices(invoicesRes.data.invoices || []);
            setWorkspaceLoaded(true);
        } catch (err) {
            setWorkspaceLoaded(true);
            showMsg('error', err.response?.data?.msg || 'Failed to load workspace settings');
        }
    }, [API_URL, getAuthConfig, token]);

    useEffect(() => {
        if (token) {
            fetchWorkspaceData();
        }
    }, [token, user?.activeWorkspaceId, fetchWorkspaceData]);

    useEffect(() => {
        if (!token) return;

        const fetchPlans = async () => {
            try {
                const res = await axios.get(`${API_URL}/billing/plans`, getAuthConfig());
                setPlans(res.data?.plans || []);
            } catch (err) {
                console.error('Failed to load billing plans', err);
            }
        };

        fetchPlans();
    }, [API_URL, getAuthConfig, token]);

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
            setIsWorkspaceModalOpen(false);
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

    const detectWorkspaceCountry = useCallback(async () => {
        if (!token || !workspaceLoaded || workspace.countryCode || !canManageWorkspace) return;

        try {
            const res = await axios.get(`${API_URL}/workspaces/detect-country`, {
                headers: {
                    'x-auth-token': token,
                    'x-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone || ''
                }
            });

            if (res.data?.countryCode) {
                setWorkspace((prev) => ({ ...prev, countryCode: res.data.countryCode }));
                await axios.put(`${API_URL}/workspaces/current`, { countryCode: res.data.countryCode }, getAuthConfig());
                await refreshWorkspaces();
            }
        } catch (err) {
            console.error('Failed to detect workspace country', err);
        }
    }, [API_URL, canManageWorkspace, getAuthConfig, refreshWorkspaces, token, workspace.countryCode, workspaceLoaded]);

    useEffect(() => {
        detectWorkspaceCountry();
    }, [detectWorkspaceCountry]);

    const handlePayInvoice = async (stripeInvoiceId) => {
        try {
            const res = await axios.post(`${API_URL}/billing/india/pay-link`, { stripeInvoiceId }, getAuthConfig());
            await fetchWorkspaceData();
            const paymentUrl = res.data?.invoice?.razorpayPaymentLinkUrl;
            if (paymentUrl) {
                window.open(paymentUrl, '_blank', 'noopener,noreferrer');
            }
        } catch (err) {
            showMsg('error', err.response?.data?.msg || 'Failed to create payment link');
        }
    };

    const handleCancelSubscription = async () => {
        try {
            await axios.post(`${API_URL}/billing/cancel`, {}, getAuthConfig());
            await refreshWorkspaces();
            await fetchWorkspaceData();
            showMsg('success', 'Subscription will cancel at period end');
        } catch (err) {
            showMsg('error', err.response?.data?.msg || 'Failed to cancel subscription');
        }
    };

    const handleEnterpriseRequest = async (note) => {
        setEnterpriseLoading(true);
        try {
            await axios.post(`${API_URL}/billing/enterprise-request`, { note }, getAuthConfig());
            showMsg('success', 'Enterprise request sent successfully');
            return true;
        } catch (err) {
            showMsg('error', err.response?.data?.msg || 'Failed to send enterprise request');
            return false;
        } finally {
            setEnterpriseLoading(false);
        }
    };

    const tabs = [
        { id: 'profile', label: 'Profile' },
        { id: 'workspace', label: 'Workspace' },
        { id: 'billing', label: 'Billing' }
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

    const workspaceDetails = [
        { label: 'Company Name', value: workspace.companyName || 'Not added yet' },
        { label: 'Address', value: workspace.addressLine1 || 'Not added yet' },
        { label: 'City', value: workspace.city || 'Not added yet' },
        { label: 'State', value: workspace.state || 'Not added yet' },
        { label: 'Country', value: getCountryName(workspace.countryCode) || 'Not added yet' },
        { label: 'PIN / Postal Code', value: workspace.postalCode || 'Not added yet' },
        { label: 'GST No / Tax ID', value: workspace.taxId || 'Not added yet' }
    ];
    const latestInvoice = billing?.latestInvoice || billingInvoices[0] || null;
    const isINRWorkspace = workspace.countryCode === 'IN';
    const displayCurrency = isINRWorkspace ? 'INR' : 'USD';
    const handlePlanSelect = async (plan) => {
        if (plan.name === 'Free' || plan.name === billing?.plan) return;

        setLoadingPlan(plan.name);
        try {
            if (isINRWorkspace && billing?.stripeSubscriptionId) {
                const res = await axios.post(`${API_URL}/billing/india/change-plan`, { planName: plan.name, billingCycle }, getAuthConfig());
                await loadUser();
                await fetchWorkspaceData();
                if (res.data?.paymentUrl) {
                    window.open(res.data.paymentUrl, '_blank', 'noopener,noreferrer');
                } else {
                    showMsg('success', 'Plan updated successfully');
                }
            } else {
                const res = await axios.post(`${API_URL}/billing/checkout/stripe-subscription`, { planName: plan.name, billingCycle }, getAuthConfig());
                if (res.data?.url) {
                    window.location.href = res.data.url;
                    return;
                }
                await loadUser();
                await fetchWorkspaceData();
                if (res.data?.paymentUrl) {
                    window.open(res.data.paymentUrl, '_blank', 'noopener,noreferrer');
                } else {
                    showMsg('success', 'Plan updated successfully');
                }
            }
        } catch (err) {
            showMsg('error', err.response?.data?.msg || 'Failed to update plan');
        } finally {
            setLoadingPlan(null);
        }
    };

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
            ) : activeTab === 'workspace' ? (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] gap-4">
                    <div className="space-y-4">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-5">
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3 rounded-2xl border border-primary-100 bg-primary-50/60 p-3.5">
                                        <div className="p-2 bg-white text-primary-600 rounded-xl shadow-sm">
                                            <Building size={18} />
                                        </div>
                                        <div className="flex-1 space-y-1.5">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <h2 className="truncate text-lg font-bold text-gray-900">{workspace.name || 'Workspace'}</h2>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => canManageWorkspace && setIsWorkspaceModalOpen(true)}
                                                    disabled={!canManageWorkspace}
                                                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-primary-600 shadow-sm transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-500">Workspace profile stays read-only here. Use edit to update it.</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                        {workspaceDetails.map((detail) => (
                                            <div key={detail.label} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                                                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{detail.label}</p>
                                                <p className="mt-1 text-sm font-medium text-gray-800 break-words">{detail.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            Active role: <span className="font-semibold text-gray-900 capitalize">{workspaceRole || 'member'}</span>
                                        </div>
                                        {!canManageWorkspace && (
                                            <span className="text-xs text-amber-600">Only owners and admins can edit workspace details.</span>
                                        )}
                                    </div>
                                </div>
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
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
                            <div className="p-2 bg-primary-100 text-primary-600 rounded-lg">
                                <CreditCard size={18} />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-gray-800">Billing Overview</h2>
                                <p className="text-xs text-gray-500">Billing follows the active workspace country</p>
                            </div>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-primary-700">Current Plan</p>
                                <p className="mt-2 text-2xl font-bold text-gray-900">{billing?.plan || 'Free'}</p>
                                <p className="mt-1 text-sm text-gray-600">Status: <span className="capitalize">{billing?.status || 'inactive'}</span></p>
                                <p className="mt-1 text-sm text-gray-600">Renewal: <span className="font-medium text-gray-900">{billing?.currentPeriodEnd ? new Date(billing.currentPeriodEnd).toLocaleDateString() : 'Not scheduled'}</span></p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Credits</p>
                                    <p className="mt-2 text-xl font-bold text-gray-900">{(billing?.contactLimit ?? 100).toLocaleString()}</p>
                                    <p className="mt-1 text-xs text-gray-500">Workspace contact limit for the active plan</p>
                                </div>
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Billing Currency</p>
                                    <p className="mt-2 text-xl font-bold text-gray-900">{displayCurrency}</p>
                                    <p className="mt-1 text-xs text-gray-500">Workspace country: {getCountryName(workspace.countryCode)}</p>
                                </div>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                                Collection mode: <span className="font-semibold uppercase text-gray-900">{billing?.collectionMode || 'autopay'}</span>
                                {billing?.graceEndsAt && (
                                    <p className="mt-2 text-xs text-amber-700">Grace period ends on {new Date(billing.graceEndsAt).toLocaleDateString()}</p>
                                )}
                                {billing?.isReadOnlyLocked && (
                                    <p className="mt-2 text-xs text-red-600">This workspace is in read-only billing lock until payment is cleared.</p>
                                )}
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Outstanding Invoice</p>
                                <p className="mt-2 text-sm font-semibold text-gray-900">{latestInvoice?.stripeInvoiceNumber || 'No recent invoice'}</p>
                                <p className="mt-1 text-sm text-gray-600">
                                    {latestInvoice ? `${(latestInvoice.currency || 'usd').toUpperCase()} ${(latestInvoice.amountDue || 0) / 100}` : 'No open invoice right now'}
                                </p>
                                {latestInvoice?.dueDate && (
                                    <p className="mt-1 text-xs text-gray-500">Due on {new Date(latestInvoice.dueDate).toLocaleDateString()}</p>
                                )}
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {workspace.countryCode === 'IN' && latestInvoice?.stripeInvoiceId && latestInvoice?.status !== 'paid' && (
                                        <button
                                            type="button"
                                            onClick={() => handlePayInvoice(latestInvoice.stripeInvoiceId)}
                                            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
                                        >
                                            Pay Now
                                        </button>
                                    )}
                                    {latestInvoice?.customerInvoiceUrl && (
                                        <a
                                            href={latestInvoice.customerInvoiceUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                            View Invoice
                                        </a>
                                    )}
                                    {billing?.stripeSubscriptionId && (
                                        <button
                                            type="button"
                                            onClick={handleCancelSubscription}
                                            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                                        >
                                            Cancel at Period End
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                            <h2 className="text-base font-bold text-gray-800">Invoices</h2>
                            <p className="text-xs text-gray-500">Recent invoices for the active workspace</p>
                        </div>
                        <div className="p-5 space-y-4 text-sm text-gray-600">
                            {billingInvoices.length === 0 && (
                                <div className="rounded-xl border border-gray-100 p-4">No invoices yet for this workspace.</div>
                            )}
                            {billingInvoices.map((invoice) => (
                                <div key={invoice.stripeInvoiceId} className="rounded-xl border border-gray-100 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-gray-900">{invoice.stripeInvoiceNumber || invoice.stripeInvoiceId}</p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {(invoice.currency || 'usd').toUpperCase()} {(invoice.amountDue || 0) / 100}
                                                {invoice.dueDate ? ` • Due ${new Date(invoice.dueDate).toLocaleDateString()}` : ''}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                                            {invoice.status}
                                        </span>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {invoice.customerInvoiceUrl && (
                                            <a
                                                href={invoice.customerInvoiceUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                            >
                                                View
                                            </a>
                                        )}
                                        {workspace.countryCode === 'IN' && invoice.status !== 'paid' && (
                                            <button
                                                type="button"
                                                onClick={() => handlePayInvoice(invoice.stripeInvoiceId)}
                                                className="rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
                                            >
                                                Pay
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {workspace.countryCode === 'IN' && (
                                <div className="rounded-xl border border-dashed border-gray-200 p-4">
                                    Zoho Books invoice link will appear here later. Placeholder fields are already reserved in billing records.
                                </div>
                            )}
                        </div>
                    </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-base font-bold text-gray-800">Plans and Pricing</h2>
                                <p className="text-xs text-gray-500">
                                    Showing {isINRWorkspace ? 'INR' : 'USD'} pricing for {getCountryName(workspace.countryCode)}.
                                </p>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1">
                                <button
                                    type="button"
                                    onClick={() => setBillingCycle('monthly')}
                                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${billingCycle === 'monthly' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    Monthly
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBillingCycle('yearly')}
                                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${billingCycle === 'yearly' ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    Yearly
                                </button>
                            </div>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
                                {plans.filter((plan) => plan.name !== 'Enterprise').map((plan) => {
                                    const price = isINRWorkspace ? plan.prices?.inr?.[billingCycle]?.amount : plan.prices?.usd?.[billingCycle]?.amount;
                                    const symbol = isINRWorkspace ? '₹' : '$';
                                    const isCurrentPlan = billing?.plan === plan.name;

                                    return (
                                        <div
                                            key={plan.name}
                                            className={`rounded-2xl border p-4 ${plan.key === 'Growth' ? 'border-primary-200 bg-primary-50/60' : 'border-gray-200 bg-white'}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-base font-bold text-gray-900">{plan.name}</p>
                                                    <p className="mt-1 text-sm text-gray-500">
                                                        Up to {plan.contactLimit.toLocaleString()} contacts
                                                    </p>
                                                </div>
                                                {plan.key === 'Growth' && (
                                                    <span className="rounded-full bg-primary-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-700">
                                                        Popular
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-4 text-3xl font-bold text-gray-900">
                                                {symbol}{price}
                                                <span className="ml-1 text-sm font-medium text-gray-500">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                                            </p>
                                            <div className="mt-4 space-y-2 text-sm text-gray-600">
                                                {plan.features.map((feature) => (
                                                    <p key={feature}>{feature}</p>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handlePlanSelect(plan)}
                                                disabled={loadingPlan === plan.name || isCurrentPlan}
                                                className={`mt-5 w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors ${isCurrentPlan ? 'cursor-not-allowed bg-gray-200 text-gray-500' : 'bg-primary-600 text-white hover:bg-primary-700'} disabled:opacity-70`}
                                            >
                                                {loadingPlan === plan.name ? 'Processing...' : isCurrentPlan ? 'Current Plan' : billing?.plan === 'Free' ? 'Buy Plan' : 'Upgrade Plan'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {plans.filter((plan) => plan.name === 'Enterprise').map((plan) => (
                                <div key={plan.name} className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <p className="text-lg font-bold text-gray-900">{plan.name}</p>
                                            <p className="mt-1 text-sm text-gray-600">{plan.description || 'Custom pricing for larger teams.'}</p>
                                            <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-500">
                                                <span>Custom pricing</span>
                                                <span>Dedicated onboarding</span>
                                                <span>Custom SLA</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setEnterpriseModalOpen(true)}
                                            className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                                        >
                                            Contact Us
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'workspace' && isWorkspaceModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4 py-6">
                    <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Edit Workspace</h2>
                                <p className="text-xs text-gray-500">Update the business identity your team works under.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsWorkspaceModalOpen(false)}
                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600 transition hover:bg-gray-200"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleWorkspaceSubmit} className="space-y-4 p-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Workspace</label>
                                <input
                                    type="text"
                                    value={workspace.name}
                                    onChange={e => setWorkspace({ ...workspace, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                    disabled={!canManageWorkspace}
                                    placeholder="Workspace"
                                />
                            </div>
                            <div className="space-y-1.5">
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
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div className="space-y-1.5 md:col-span-2">
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
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">City</label>
                                    <input
                                        type="text"
                                        value={workspace.city}
                                        onChange={e => setWorkspace({ ...workspace, city: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                        disabled={!canManageWorkspace}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">State</label>
                                    <input
                                        type="text"
                                        value={workspace.state}
                                        onChange={e => setWorkspace({ ...workspace, state: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                        disabled={!canManageWorkspace}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Country</label>
                                    <select
                                        value={workspace.countryCode}
                                        onChange={e => setWorkspace({ ...workspace, countryCode: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm bg-white"
                                        disabled={!canManageWorkspace}
                                    >
                                        <option value="">Select country</option>
                                        {COUNTRIES.map((country) => (
                                            <option key={country.code} value={country.code}>
                                                {country.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">PIN / Postal Code</label>
                                    <input
                                        type="text"
                                        value={workspace.postalCode}
                                        onChange={e => setWorkspace({ ...workspace, postalCode: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                                        disabled={!canManageWorkspace}
                                    />
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
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
                            <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-sm text-gray-600">
                                    Active role: <span className="font-semibold text-gray-900 capitalize">{workspaceRole || 'member'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsWorkspaceModalOpen(false)}
                                        className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={workspaceLoading || !canManageWorkspace}
                                        className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        <Save size={16} />
                                        Save Workspace
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <EnterpriseRequestModal
                isOpen={enterpriseModalOpen}
                onClose={() => setEnterpriseModalOpen(false)}
                onSubmit={handleEnterpriseRequest}
                loading={enterpriseLoading}
                workspaceName={workspace.name}
            />
        </div>
    );
};

export default Settings;
