import { useState, useContext, useEffect } from 'react';
import { User, Lock, Building, Save, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { usePageHeader } from '../context/PageHeaderContext';

const Settings = () => {
    const { user, token, loadUser } = useContext(AuthContext);
    const { setHeader } = usePageHeader();
    const [loading, setLoading] = useState(false);
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

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

    useEffect(() => {
        setHeader({ title: 'Settings', subtitle: null, actions: null });
        return () => setHeader({ title: '', subtitle: null, actions: null });
    }, []);

    useEffect(() => {
        if (user) {
            setProfile({
                firstName: user.firstName || '',
                businessName: user.businessName || '',
                email: user.email || ''
            });
        }
    }, [user]);

    const showMsg = (type, text) => {
        setMsg({ type, text });
        setTimeout(() => setMsg(null), 3000);
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const config = { headers: { 'x-auth-token': token } };
            await axios.put(`${API_URL}/auth/profile`, profile, config);
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
            const config = { headers: { 'x-auth-token': token } };
            await axios.put(`${API_URL}/auth/password`, {
                currentPassword: password.currentPassword,
                newPassword: password.newPassword
            }, config);
            showMsg('success', 'Password updated successfully');
            setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            showMsg('error', err.response?.data?.msg || 'Failed to update password');
        } finally {
            setLoading(false);
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {/* Profile Section */}
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

                {/* Security Section */}
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
                                    className={`flex items-center gap-2 px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black transition-colors shadow-sm disabled:opacity-50`}
                                >
                                    <Save size={16} />
                                    Update Password
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
