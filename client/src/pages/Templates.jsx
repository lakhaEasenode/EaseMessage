import { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { Loader2, Plus, Search, Filter, FileText, Copy, AlertCircle, RefreshCw, X, ChevronDown, Check } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import TemplateForm from '../components/TemplateForm';
import { usePageHeader } from '../context/PageHeaderContext';

const Templates = () => {
    const { token } = useContext(AuthContext);
    const { setHeader } = usePageHeader();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState(null);

    // Filters
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');

    // WABA Filter
    const [wabaAccounts, setWabaAccounts] = useState([]);
    const [filterWaba, setFilterWaba] = useState([]); // Array of selected WABA IDs
    const [isWabaDropdownOpen, setIsWabaDropdownOpen] = useState(false);
    const wabaDropdownRef = useRef(null);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

    const fetchTemplates = async () => {
        try {
            setLoading(true);
            const config = { headers: { 'x-auth-token': token } };
            const res = await axios.get(`${API_URL}/templates`, config);
            setTemplates(res.data);
        } catch (err) {
            console.error('Error fetching templates:', err);
            setError('Failed to load templates');
        } finally {
            setLoading(false);
        }
    };

    const fetchWabaAccounts = async () => {
        try {
            const config = { headers: { 'x-auth-token': token } };
            const res = await axios.get(`${API_URL}/whatsapp/accounts`, config);
            setWabaAccounts(res.data);
        } catch (err) {
            console.error('Error fetching WABA accounts:', err);
        }
    };

    useEffect(() => {
        if (token) {
            fetchTemplates();
            fetchWabaAccounts();
        }
    }, [token]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wabaDropdownRef.current && !wabaDropdownRef.current.contains(event.target)) {
                setIsWabaDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleCreate = async (data) => {
        try {
            const config = { headers: { 'x-auth-token': token } };
            await axios.post(`${API_URL}/templates`, data, config);
            setIsFormOpen(false);
            setEditingTemplate(null);
            fetchTemplates();
        } catch (err) {
            console.error('Create error:', err);
            alert('Failed to create template');
        }
    };

    const handleSync = async () => {
        try {
            setSyncing(true);
            setSyncMessage(null);
            const config = { headers: { 'x-auth-token': token } };
            const res = await axios.get(`${API_URL}/templates/sync`, config);
            setSyncMessage(res.data.message);
            fetchTemplates();
            setTimeout(() => setSyncMessage(null), 5000);
        } catch (err) {
            console.error('Sync error:', err);
            const errorMsg = err.response?.data?.msg || 'Failed to sync templates';
            alert(errorMsg);
        } finally {
            setSyncing(false);
        }
    };

    useEffect(() => {
        setHeader({
            title: 'Templates',
            subtitle: 'Manage WhatsApp message templates',
            actions: (
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? 'Syncing…' : 'Sync'}
                    </button>
                    <button
                        onClick={() => { setEditingTemplate(null); setIsFormOpen(true); }}
                        className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus size={14} />
                        New Template
                    </button>
                </div>
            )
        });
        return () => setHeader({ title: '', subtitle: null, actions: null });
    }, [syncing]);

    // Filter Logic
    const toggleWabaFilter = (wabaId) => {
        setFilterWaba(prev => {
            if (prev.includes(wabaId)) {
                return prev.filter(id => id !== wabaId);
            } else {
                return [...prev, wabaId];
            }
        });
    };

    const filteredTemplates = templates.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = filterCategory === 'ALL' || t.category === filterCategory;
        const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;

        // WABA Filter Logic: If filterWaba is empty, show all. Else, must match one of selected IDs.
        // t.wabaId is an object populated from backend { _id, name, ... } or null
        const matchesWaba = filterWaba.length === 0 || (t.wabaId && filterWaba.includes(t.wabaId._id));

        return matchesSearch && matchesCategory && matchesStatus && matchesWaba;
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'APPROVED': return 'bg-green-100 text-green-700 border-green-200';
            case 'PENDING': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'REJECTED': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            {syncMessage && (
                <div className="mb-2 text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg inline-block">
                    ✓ {syncMessage}
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-2 flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center">
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search template name..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:border-green-500 outline-none text-sm"
                    />
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
                    {/* WABA Multi-Select Dropdown */}
                    <div className="relative" ref={wabaDropdownRef}>
                        <button
                            onClick={() => setIsWabaDropdownOpen(!isWabaDropdownOpen)}
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm outline-none bg-white w-full sm:min-w-[180px] ${filterWaba.length > 0
                                    ? 'border-green-500 text-green-700 bg-green-50'
                                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                        >
                            <span className="truncate max-w-[140px]">
                                {filterWaba.length === 0
                                    ? 'All WABA Accounts'
                                    : `${filterWaba.length} Account${filterWaba.length > 1 ? 's' : ''} Selected`}
                            </span>
                            <ChevronDown size={16} className={`transition-transform ${isWabaDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isWabaDropdownOpen && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="p-2 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider pl-2">Filter by WABA</span>
                                    {filterWaba.length > 0 && (
                                        <button
                                            onClick={() => setFilterWaba([])}
                                            className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-60 overflow-y-auto p-1">
                                    {wabaAccounts.length === 0 ? (
                                        <div className="p-3 text-sm text-gray-400 text-center">No accounts found</div>
                                    ) : (
                                        wabaAccounts.map(account => {
                                            const isSelected = filterWaba.includes(account._id);
                                            return (
                                                <button
                                                    key={account._id}
                                                    onClick={() => toggleWabaFilter(account._id)}
                                                    className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isSelected
                                                            ? 'bg-green-50 text-green-800 font-medium'
                                                            : 'text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white'
                                                        }`}>
                                                        {isSelected && <Check size={12} className="text-white" />}
                                                    </div>
                                                    <span className="truncate">{account.name}</span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="flex-1 sm:flex-none px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 focus:border-green-500 outline-none bg-white"
                    >
                        <option value="ALL">All Status</option>
                        <option value="APPROVED">Approved</option>
                        <option value="PENDING">Pending</option>
                        <option value="REJECTED">Rejected</option>
                    </select>
                    <select
                        value={filterCategory}
                        onChange={e => setFilterCategory(e.target.value)}
                        className="flex-1 sm:flex-none px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 focus:border-green-500 outline-none bg-white"
                    >
                        <option value="ALL">All Categories</option>
                        <option value="MARKETING">Marketing</option>
                        <option value="UTILITY">Utility</option>
                        <option value="AUTHENTICATION">Authentication</option>
                    </select>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                    <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
                    <p className="text-gray-500 font-medium animate-pulse">Loading templates...</p>
                </div>
            ) : filteredTemplates.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
                    <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <FileText size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">
                        {templates.length === 0 ? "No templates yet" : "No templates found"}
                    </h3>
                    <p className="text-gray-500 max-w-sm mx-auto mb-6">
                        {templates.length === 0
                            ? "Create your first WhatsApp template to start messaging customers"
                            : "Try adjusting your filters or search query"}
                    </p>
                    {templates.length === 0 && (
                        <button
                            onClick={() => setIsFormOpen(true)}
                            className="text-green-600 font-bold hover:underline"
                        >
                            Create Template
                        </button>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Template Name</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">WABA</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Category</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Language</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredTemplates.map(template => (
                                    <tr key={template._id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-800 text-sm">{template.name}</div>
                                            <div className="text-xs text-gray-400 font-mono mt-0.5">Last updated: {new Date(template.updatedAt).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {template.wabaId ? (
                                                <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded border border-primary-100">
                                                    {template.wabaId.name || 'Unknown'}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                                {template.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {template.language}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide ${getStatusColor(template.status)}`}>
                                                {template.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingTemplate(template);
                                                        setIsFormOpen(true);
                                                    }}
                                                    className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                    title={template.status === 'APPROVED' ? "View Template" : "Edit Template"}
                                                >
                                                    {template.status === 'APPROVED' ? <FileText size={16} /> : <AlertCircle size={16} />}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const copy = { ...template, name: `${template.name}_copy`, status: 'PENDING' };
                                                        setEditingTemplate(copy);
                                                        setIsFormOpen(true);
                                                    }}
                                                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                                    title="Duplicate"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isFormOpen && (
                <TemplateForm
                    onClose={() => {
                        setIsFormOpen(false);
                        setEditingTemplate(null);
                    }}
                    onSubmit={handleCreate}
                    initialData={editingTemplate}
                    wabaAccounts={wabaAccounts}
                />
            )}
        </div>
    );
};

export default Templates;
