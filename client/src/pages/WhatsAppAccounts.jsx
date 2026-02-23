import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Loader2, Plus, LogOut, CheckCircle, Smartphone, AlertCircle, Shield } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import WhatsAppHeader from '../components/WhatsAppHeader';

const WhatsAppAccounts = () => {
    const { token } = useContext(AuthContext);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

    // Connect Form State
    const [wabaId, setWabaId] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [connectLoading, setConnectLoading] = useState(false);
    const [connectError, setConnectError] = useState(null);

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

    const handleConnect = async (e) => {
        e.preventDefault();
        if (!wabaId || !accessToken) return;

        try {
            setConnectLoading(true);
            setConnectError(null);
            const config = { headers: { 'x-auth-token': token } };

            await axios.post(`${API_URL}/whatsapp/connect`, { wabaId, accessToken }, config);

            setWabaId('');
            setAccessToken('');
            setIsConnectModalOpen(false);
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
            fetchAccounts(); // Refresh to show updated default
        } catch (err) {
            console.error('Failed to set default:', err);
            alert(err.response?.data?.msg || 'Failed to set default phone number');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">WhatsApp Accounts</h1>
                    <p className="text-gray-500 text-sm mt-1">Manage your connected WhatsApp Business Accounts</p>
                </div>
                <button
                    onClick={() => setIsConnectModalOpen(true)}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-all shadow-sm active:scale-95"
                >
                    <Plus size={18} />
                    Connect Account
                </button>
            </div>

            {/* Stats Header */}
            {!loading && !error && accounts.length > 0 && (
                <WhatsAppHeader accounts={accounts} />
            )}

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 mb-6">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                    <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
                    <p className="text-gray-500 font-medium animate-pulse">Loading accounts...</p>
                </div>
            ) : (
                <div className="space-y-6">
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
                                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                                            <CheckCircle size={10} />
                                            Active
                                        </span>
                                    </div>
                                </div>

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
                                onClick={() => setIsConnectModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <LogOut size={20} className="rotate-180" />
                            </button>
                        </div>

                        <form onSubmit={handleConnect} className="p-6">
                            {connectError && (
                                <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2">
                                    <AlertCircle size={16} className="mt-0.5" />
                                    <span>{connectError}</span>
                                </div>
                            )}

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
                                    onClick={() => setIsConnectModalOpen(false)}
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
                                        <>
                                            Connect
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WhatsAppAccounts;
