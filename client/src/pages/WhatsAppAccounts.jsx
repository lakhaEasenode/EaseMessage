import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Loader2, Plus, LogOut, CheckCircle, Smartphone, AlertCircle, Shield, Unplug, Activity, MessageSquare, Globe, Clock } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import WhatsAppHeader from '../components/WhatsAppHeader';
import { usePageHeader } from '../context/PageHeaderContext';
import useFacebookSDK from '../hooks/useFacebookSDK';

const WhatsAppAccounts = () => {
    const { token } = useContext(AuthContext);
    const { setHeader } = usePageHeader();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

    // Connect Form State
    const [wabaId, setWabaId] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [connectLoading, setConnectLoading] = useState(false);
    const [connectError, setConnectError] = useState(null);

    // Embedded Signup State
    const { isReady: fbReady, loadSDK: loadFacebookSDK, configRef } = useFacebookSDK(token);
    const [embeddedSignupLoading, setEmbeddedSignupLoading] = useState(false);
    const [showManualForm, setShowManualForm] = useState(false);

    // Disconnect State
    const [disconnectingId, setDisconnectingId] = useState(null);
    const [disconnectModal, setDisconnectModal] = useState({ open: false, wabaId: null, accountName: '' });

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const config = { headers: { 'x-auth-token': token } };
            const res = await axios.get(`${API_URL}/whatsapp/accounts`, config);
            setAccounts(res.data);
        } catch (err) {
            console.error('Error fetching accounts:', err);
            setError('Failed to load WhatsApp accounts');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchAccounts();
        }
    }, [token]);

    useEffect(() => {
        setHeader({
            title: 'WhatsApp Accounts',
            subtitle: 'Manage your connected WhatsApp Business Accounts',
            actions: (
                <button
                    onClick={() => setIsConnectModalOpen(true)}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                    <Plus size={15} />
                    Connect Account
                </button>
            )
        });
        return () => setHeader({ title: '', subtitle: null, actions: null });
    }, []);

    // Load Facebook SDK when connect modal opens
    useEffect(() => {
        if (isConnectModalOpen) {
            loadFacebookSDK();
        }
    }, [isConnectModalOpen, loadFacebookSDK]);

    const closeConnectModal = () => {
        setIsConnectModalOpen(false);
        setConnectError(null);
        setEmbeddedSignupLoading(false);
        setShowManualForm(false);
        setWabaId('');
        setAccessToken('');
    };

    const handleEmbeddedSignup = () => {
        if (!window.FB) return;

        setEmbeddedSignupLoading(true);
        setConnectError(null);

        window.FB.login(
            function (response) {
                if (response.authResponse) {
                    const code = response.authResponse.code;
                    const config = { headers: { 'x-auth-token': token } };

                    axios
                        .post(`${API_URL}/whatsapp/embedded-signup`, { code }, config)
                        .then(() => {
                            closeConnectModal();
                            fetchAccounts();
                        })
                        .catch((err) => {
                            setConnectError(
                                err.response?.data?.msg || 'Failed to complete Embedded Signup'
                            );
                            setEmbeddedSignupLoading(false);
                        });
                } else {
                    // User cancelled the popup
                    setEmbeddedSignupLoading(false);
                }
            },
            {
                config_id: configRef.current?.configId,
                response_type: 'code',
                override_default_response_type: true,
                extras: {
                    setup: {},
                    featureType: '',
                    sessionInfoVersion: '3',
                },
            }
        );
    };

    const handleConnect = async (e) => {
        e.preventDefault();
        if (!wabaId || !accessToken) return;

        try {
            setConnectLoading(true);
            setConnectError(null);
            const config = { headers: { 'x-auth-token': token } };

            await axios.post(`${API_URL}/whatsapp/connect`, { wabaId, accessToken }, config);

            closeConnectModal();
            fetchAccounts();
        } catch (err) {
            console.error('Connect error:', err);
            setConnectError(err.response?.data?.msg || 'Failed to connect account');
        } finally {
            setConnectLoading(false);
        }
    };

    const handleSetDefault = async (phoneNumberId) => {
        try {
            const config = { headers: { 'x-auth-token': token } };
            await axios.put(`${API_URL}/whatsapp/phone/${phoneNumberId}/set-default`, {}, config);
            fetchAccounts();
        } catch (err) {
            console.error('Failed to set default:', err);
            alert(err.response?.data?.msg || 'Failed to set default phone number');
        }
    };

    const handleDisconnect = (wabaId, accountName) => {
        setDisconnectModal({ open: true, wabaId, accountName });
    };

    const confirmDisconnect = async () => {
        const { wabaId } = disconnectModal;
        setDisconnectModal({ open: false, wabaId: null, accountName: '' });

        try {
            setDisconnectingId(wabaId);
            const config = { headers: { 'x-auth-token': token } };
            await axios.delete(`${API_URL}/whatsapp/accounts/${wabaId}`, config);
            fetchAccounts();
        } catch (err) {
            console.error('Disconnect error:', err);
            alert(err.response?.data?.msg || 'Failed to disconnect account');
        } finally {
            setDisconnectingId(null);
        }
    };

    // Helper to format messaging limit tier
    const formatMessagingLimit = (tier) => {
        const limits = {
            TIER_NOT_SET: 'Not Set',
            TIER_50: '50 / day',
            TIER_250: '250 / day',
            TIER_1K: '1K / day',
            TIER_10K: '10K / day',
            TIER_100K: '100K / day',
            TIER_UNLIMITED: 'Unlimited',
        };
        return limits[tier] || tier || 'Unknown';
    };

    return (
        <div className="max-w-7xl mx-auto">
            {/* Stats Header */}
            {!loading && !error && accounts.length > 0 && (
                <WhatsAppHeader accounts={accounts} />
            )}

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 mb-2">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                    <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
                    <p className="text-gray-500 font-medium animate-pulse">Loading accounts...</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {accounts.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                            <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <Smartphone size={28} />
                            </div>
                            <h3 className="text-base font-bold text-gray-800 mb-1">No Accounts Connected</h3>
                            <p className="text-gray-500 max-w-sm mx-auto text-sm mb-4">Connect your WhatsApp Business Account to start sending campaigns.</p>
                            <button
                                onClick={() => setIsConnectModalOpen(true)}
                                className="text-green-600 font-bold hover:underline text-sm"
                            >
                                Connect now
                            </button>
                        </div>
                    ) : (
                        accounts.map(account => (
                            <div key={account._id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                                {/* Account Header */}
                                <div className="px-3 py-2 border-b border-gray-50 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-green-100 text-green-700 rounded-lg flex items-center justify-center font-bold text-base">
                                            {account.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-base">{account.name}</h3>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mt-0.5">
                                                <span>ID: {account.wabaId}</span>
                                                <span className="w-0.5 h-0.5 bg-gray-300 rounded-full"></span>
                                                <span>{account.timezoneId}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {account.analytics?.account_review_status && (
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                                                account.analytics.account_review_status === 'APPROVED'
                                                    ? 'bg-green-100 text-green-700'
                                                    : account.analytics.account_review_status === 'PENDING'
                                                        ? 'bg-yellow-100 text-yellow-700'
                                                        : 'bg-red-100 text-red-700'
                                            }`}>
                                                <CheckCircle size={10} />
                                                {account.analytics.account_review_status}
                                            </span>
                                        )}
                                        {!account.analytics?.account_review_status && (
                                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                                                <CheckCircle size={10} />
                                                Active
                                            </span>
                                        )}
                                        <button
                                            onClick={() => handleDisconnect(account.wabaId, account.name)}
                                            disabled={disconnectingId === account.wabaId}
                                            className="text-gray-400 hover:text-red-500 p-1 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                            title="Disconnect account"
                                        >
                                            {disconnectingId === account.wabaId ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <Unplug size={16} />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Account Details from Meta */}
                                {account.analytics && (
                                    <div className="px-3 py-2 border-b border-gray-50 grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {account.analytics.ownership_type && (
                                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                <Globe size={12} className="text-gray-400" />
                                                <span className="font-medium text-gray-700">{account.analytics.ownership_type}</span>
                                            </div>
                                        )}
                                        {account.analytics.currency && (
                                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                <span className="text-gray-400 font-mono text-[10px]">$</span>
                                                <span className="font-medium text-gray-700">{account.analytics.currency}</span>
                                            </div>
                                        )}
                                        {account.analytics.country && (
                                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                <Globe size={12} className="text-gray-400" />
                                                <span className="font-medium text-gray-700">{account.analytics.country}</span>
                                            </div>
                                        )}
                                        {account.analytics.on_behalf_of_business_info?.name && (
                                            <div className="flex items-center gap-1.5 text-xs text-gray-500 col-span-2 md:col-span-1">
                                                <Activity size={12} className="text-gray-400" />
                                                <span className="font-medium text-gray-700 truncate">{account.analytics.on_behalf_of_business_info.name}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Phone Numbers */}
                                <div className="p-3">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Connected Phone Numbers</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {account.phoneNumbers.map(num => (
                                            <div key={num._id} className="border border-gray-100 rounded p-2 hover:border-green-200 transition-colors group">
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-gray-800 text-sm">{num.verifiedName}</span>
                                                        {num.isDefault && (
                                                            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1 py-0.5 rounded-full flex items-center gap-0.5">
                                                                <Shield size={10} />
                                                                DEFAULT
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-1 py-0.5 rounded border ${num.codeVerificationStatus === 'VERIFIED'
                                                        ? 'bg-green-50 text-green-600 border-green-100'
                                                        : 'bg-yellow-50 text-yellow-600 border-yellow-100'
                                                        }`}>
                                                        {num.codeVerificationStatus || 'UNKNOWN'}
                                                    </span>
                                                </div>
                                                <div className="text-xs font-mono text-gray-600 mb-1.5">{num.displayPhoneNumber}</div>

                                                {/* Meta live details */}
                                                {num.meta && (
                                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-1.5 py-1.5 border-t border-gray-50">
                                                        <div className="text-[10px] text-gray-400 flex items-center gap-1">
                                                            <MessageSquare size={10} />
                                                            Messaging Limit
                                                        </div>
                                                        <div className="text-[10px] font-bold text-gray-700 text-right">
                                                            {formatMessagingLimit(num.meta.messaging_limit_tier)}
                                                        </div>

                                                        <div className="text-[10px] text-gray-400 flex items-center gap-1">
                                                            <Activity size={10} />
                                                            Name Status
                                                        </div>
                                                        <div className={`text-[10px] font-bold text-right ${
                                                            num.meta.name_status === 'APPROVED' ? 'text-green-600' :
                                                            num.meta.name_status === 'DECLINED' ? 'text-red-600' : 'text-yellow-600'
                                                        }`}>
                                                            {num.meta.name_status || 'N/A'}
                                                        </div>

                                                        {num.meta.health_status?.can_send_message && (
                                                            <>
                                                                <div className="text-[10px] text-gray-400 flex items-center gap-1">
                                                                    <CheckCircle size={10} />
                                                                    Health
                                                                </div>
                                                                <div className={`text-[10px] font-bold text-right ${
                                                                    num.meta.health_status.can_send_message === 'AVAILABLE' ? 'text-green-600' :
                                                                    num.meta.health_status.can_send_message === 'LIMITED' ? 'text-yellow-600' : 'text-red-600'
                                                                }`}>
                                                                    {num.meta.health_status.can_send_message}
                                                                </div>
                                                            </>
                                                        )}

                                                        {num.meta.is_official_business_account !== undefined && (
                                                            <>
                                                                <div className="text-[10px] text-gray-400 flex items-center gap-1">
                                                                    <Shield size={10} />
                                                                    Official
                                                                </div>
                                                                <div className="text-[10px] font-bold text-right text-gray-700">
                                                                    {num.meta.is_official_business_account ? 'Yes' : 'No'}
                                                                </div>
                                                            </>
                                                        )}

                                                        {num.meta.last_onboarded_time && (
                                                            <>
                                                                <div className="text-[10px] text-gray-400 flex items-center gap-1">
                                                                    <Clock size={10} />
                                                                    Onboarded
                                                                </div>
                                                                <div className="text-[10px] font-bold text-right text-gray-700">
                                                                    {new Date(num.meta.last_onboarded_time).toLocaleDateString()}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                                        <span className={`w-1.5 h-1.5 rounded-full ${num.qualityRating === 'GREEN' ? 'bg-green-500' :
                                                            num.qualityRating === 'YELLOW' ? 'bg-yellow-500' : 'bg-red-500'
                                                            }`}></span>
                                                        Quality: {num.qualityRating || 'UNKNOWN'}
                                                    </div>
                                                    {!num.isDefault && (
                                                        <button
                                                            onClick={() => handleSetDefault(num.phoneNumberId)}
                                                            className="text-[10px] font-bold text-primary-600 hover:text-primary-700 hover:underline"
                                                        >
                                                            Set Default
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Connect Modal */}
            {isConnectModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Smartphone size={18} className="text-green-600" />
                                Connect WhatsApp
                            </h3>
                            <button
                                onClick={closeConnectModal}
                                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <LogOut size={20} className="rotate-180" />
                            </button>
                        </div>

                        <div className="p-6">
                            {connectError && (
                                <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2">
                                    <AlertCircle size={16} className="mt-0.5" />
                                    <span>{connectError}</span>
                                </div>
                            )}

                            {/* Embedded Signup Section */}
                            <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-3">
                                    Connect your WhatsApp Business Account through Meta's guided setup.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleEmbeddedSignup}
                                    disabled={!fbReady || embeddedSignupLoading}
                                    className="w-full flex items-center justify-center gap-2 bg-[#1877F2] hover:bg-[#166FE5] text-white px-4 py-2.5 rounded-xl font-bold transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {embeddedSignupLoading ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                            </svg>
                                            Login with Facebook
                                        </>
                                    )}
                                </button>
                                {!fbReady && (
                                    <p className="text-[10px] text-gray-400 mt-1 text-center">Loading Facebook SDK...</p>
                                )}
                            </div>

                            {/* Divider */}
                            <div className="flex items-center gap-3 my-5">
                                <div className="flex-1 h-px bg-gray-200"></div>
                                <span className="text-xs text-gray-400 font-medium">or connect manually</span>
                                <div className="flex-1 h-px bg-gray-200"></div>
                            </div>

                            {/* Manual Form — collapsed by default */}
                            {!showManualForm ? (
                                <button
                                    type="button"
                                    onClick={() => setShowManualForm(true)}
                                    className="w-full text-sm text-gray-500 hover:text-gray-700 font-medium py-2 transition-colors"
                                >
                                    Enter WABA ID & Access Token manually
                                </button>
                            ) : (
                                <form onSubmit={handleConnect}>
                                    <div className="space-y-4 mb-6">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                                WhatsApp Business Account ID
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={wabaId}
                                                onChange={(e) => setWabaId(e.target.value)}
                                                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 outline-none transition-all text-sm font-mono"
                                                placeholder="e.g. 10456..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                                System User Access Token
                                            </label>
                                            <input
                                                type="password"
                                                required
                                                value={accessToken}
                                                onChange={(e) => setAccessToken(e.target.value)}
                                                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 outline-none transition-all text-sm font-mono"
                                                placeholder="EAAG..."
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1">
                                                This token connects to the Facebook Graph API to fetch your account details.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={closeConnectModal}
                                            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-all text-sm"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={connectLoading || !wabaId || !accessToken}
                                            className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                                        >
                                            {connectLoading ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : (
                                                'Connect'
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Disconnect Confirmation Modal */}
            {disconnectModal.open && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2 bg-red-50">
                            <div className="w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
                                <Unplug size={18} />
                            </div>
                            <h3 className="font-bold text-gray-800">Disconnect Account</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-700 mb-3">
                                Are you sure you want to disconnect <span className="font-bold">"{disconnectModal.accountName}"</span>?
                            </p>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5 flex items-start gap-2">
                                <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-amber-700">
                                    All information related to this account, including linked phone numbers, message history, and campaign data will be permanently lost.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDisconnectModal({ open: false, wabaId: null, accountName: '' })}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-all text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDisconnect}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all text-sm flex items-center justify-center gap-2"
                                >
                                    <Unplug size={15} />
                                    Disconnect
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WhatsAppAccounts;
