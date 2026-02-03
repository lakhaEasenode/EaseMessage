import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Users, List as ListIcon, Loader2, Plus, Eye, Edit, Trash2, X, ChevronDown, Upload, UserPlus } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import ContactHeader from '../components/ContactHeader';

const Contacts = () => {
    const { token } = useContext(AuthContext);
    const [view, setView] = useState('contacts'); // 'contacts' | 'lists'
    const [contacts, setContacts] = useState([]);
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isCreateListModalOpen, setIsCreateListModalOpen] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [createLoading, setCreateLoading] = useState(false);

    // Add Contact State
    const [isAddContactOpen, setIsAddContactOpen] = useState(false); // Dropdown state
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [addContactLoading, setAddContactLoading] = useState(false);
    const [newContact, setNewContact] = useState({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        email: '',
        countryCode: '+1',
        optedIn: true
    });

    // Refresh Trigger
    const [refreshKey, setRefreshKey] = useState(0);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const config = { headers: { 'x-auth-token': token } };

            if (view === 'contacts') {
                const res = await axios.get(`${API_URL}/contacts`, config);
                setContacts(res.data);
            } else {
                const res = await axios.get(`${API_URL}/lists`, config);
                setLists(res.data);
            }
        } catch (err) {
            console.error(`Error fetching ${view}:`, err);
            setError(`Failed to load ${view}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchData();
        }
    }, [token, view, refreshKey]);

    const handleCreateList = async (e) => {
        e.preventDefault();
        if (!newListName.trim()) return;

        try {
            setCreateLoading(true);
            const config = { headers: { 'x-auth-token': token } };
            await axios.post(`${API_URL}/lists`, { name: newListName }, config);

            setNewListName('');
            setIsCreateListModalOpen(false);
            setRefreshKey(prev => prev + 1); // Trigger refresh
            if (view !== 'lists') {
                setView('lists');
            }
        } catch (err) {
            console.error('Error creating list:', err);
            setError('Failed to create list');
        } finally {
            setCreateLoading(false);
        }
    };

    const handleAddContact = async (e) => {
        e.preventDefault();
        try {
            setAddContactLoading(true);
            const config = { headers: { 'x-auth-token': token } };

            await axios.post(`${API_URL}/contacts`, newContact, config);

            setIsManualModalOpen(false);
            setNewContact({
                firstName: '',
                lastName: '',
                phoneNumber: '',
                email: '',
                countryCode: '+1',
                optedIn: true
            });
            setRefreshKey(prev => prev + 1); // Trigger refresh
        } catch (err) {
            console.error('Error adding contact:', err);
            setError(err.response?.data?.msg || 'Failed to add contact');
        } finally {
            setAddContactLoading(false);
        }
    };

    const handleDeleteContact = async (id) => {
        if (!window.confirm('Are you sure you want to delete this contact?')) return;

        try {
            const config = { headers: { 'x-auth-token': token } };
            await axios.delete(`${API_URL}/contacts/${id}`, config);
            setRefreshKey(prev => prev + 1);
        } catch (err) {
            console.error('Error deleting contact:', err);
            setError('Failed to delete contact');
        }
    };

    const handleDeleteList = async (id) => {
        if (!window.confirm('Are you sure you want to delete this list?')) return;

        try {
            const config = { headers: { 'x-auth-token': token } };
            await axios.delete(`${API_URL}/lists/${id}`, config);
            setRefreshKey(prev => prev + 1);
        } catch (err) {
            console.error('Error deleting list:', err);
            setError('Failed to delete list');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Modular Header Component */}
            <ContactHeader refreshKey={refreshKey} />

            {/* View Toggle & Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                        onClick={() => setView('contacts')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'contacts'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Contacts
                    </button>
                    <button
                        onClick={() => setView('lists')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'lists'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Lists
                    </button>
                </div>

                <div className="relative">
                    {view === 'contacts' ? (
                        <>
                            <button
                                onClick={() => setIsAddContactOpen(!isAddContactOpen)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-all shadow-sm active:scale-95"
                            >
                                <Plus size={18} />
                                Add Contact
                                <ChevronDown size={16} className={`transition-transformDuration-200 ${isAddContactOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isAddContactOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20 animate-in fade-in slide-in-from-top-2">
                                    <button
                                        onClick={() => {
                                            setIsManualModalOpen(true);
                                            setIsAddContactOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors"
                                    >
                                        <UserPlus size={16} />
                                        Manual Entry
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsAddContactOpen(false);
                                            alert('CSV Upload coming soon!');
                                        }}
                                        className="w-full text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors border-t border-gray-50"
                                    >
                                        <Upload size={16} />
                                        Upload CSV
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <button
                            onClick={() => setIsCreateListModalOpen(true)}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-all shadow-sm active:scale-95"
                        >
                            <Plus size={18} />
                            Create List
                        </button>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 mb-6 flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={fetchData} className="text-sm font-bold underline">Retry</button>
                </div>
            )}

            {/* Data Table Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-[400px] gap-3">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                        <p className="text-gray-500 font-medium animate-pulse">Loading {view}...</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        {view === 'contacts' ? (
                            <table className="w-full text-left">
                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-left">Name</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-left">Phone</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-left">Email</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-left">Lists</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Opt-In</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {contacts.map((contact) => (
                                        <tr key={contact._id} className="hover:bg-blue-50/30 transition-colors group text-sm">
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-3 justify-start">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs shadow-sm">
                                                        {contact.firstName?.charAt(0)}
                                                    </div>
                                                    <div className="text-left leading-tight">
                                                        <div className="font-bold text-gray-800">{contact.firstName} {contact.lastName}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-left">
                                                <span className="font-mono text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                                    {contact.countryCode} {contact.phoneNumber}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-left">
                                                <div className="text-xs text-gray-600 truncate max-w-[180px]">{contact.email || '-'}</div>
                                            </td>
                                            <td className="px-6 py-3 text-left">
                                                <div className="flex flex-wrap gap-1 justify-start">
                                                    {contact.lists?.length > 0 ? (
                                                        <>
                                                            {contact.lists.slice(0, contact.lists.length > 3 ? 2 : 3).map(l => (
                                                                <span key={l._id} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 font-medium">
                                                                    {l.name}
                                                                </span>
                                                            ))}
                                                            {contact.lists.length > 3 && (
                                                                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200 font-bold">
                                                                    +{contact.lists.length - 2}
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">None</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold ${contact.optedIn ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {contact.optedIn ? 'SUBSCRIBED' : 'UNSUBSCRIBED'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex justify-end gap-1.5">
                                                    <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Eye size={16} /></button>
                                                    <button className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Edit size={16} /></button>
                                                    <button
                                                        onClick={() => handleDeleteContact(contact._id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete Contact"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {contacts.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Users className="text-gray-300" size={40} />
                                                    <p className="text-gray-400 text-sm font-medium">No contacts found.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="bg-gray-50/50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-left">List Name</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-left">Subscribers</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-left">Created Date</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {lists.map((list) => (
                                        <tr key={list._id} className="hover:bg-purple-50/30 transition-colors group text-sm">
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-3 justify-start">
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700 flex items-center justify-center font-bold shadow-sm">
                                                        <ListIcon size={14} />
                                                    </div>
                                                    <div className="font-bold text-gray-800">{list.name}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-left">
                                                <span className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
                                                    {list.contactCount} Members
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-left text-xs text-gray-500 font-medium">
                                                {new Date(list.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-3">
                                                <div className="flex justify-end gap-1.5">
                                                    <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Eye size={16} /></button>
                                                    <button className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Edit size={16} /></button>
                                                    <button
                                                        onClick={() => handleDeleteList(list._id)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete List"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {lists.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <ListIcon className="text-gray-300" size={48} />
                                                    <p className="text-gray-400 font-medium">No lists found.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
            {/* Create List Modal */}
            {isCreateListModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <ListIcon size={18} className="text-blue-600" />
                                Create New List
                            </h3>
                            <button
                                onClick={() => setIsCreateListModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateList} className="p-6">
                            <div className="mb-6">
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    List Name
                                </label>
                                <input
                                    type="text"
                                    value={newListName}
                                    onChange={(e) => setNewListName(e.target.value)}
                                    placeholder="e.g. VIP Customers, Spring Promo"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateListModalOpen(false)}
                                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-all text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createLoading || !newListName.trim()}
                                    className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                                >
                                    {createLoading ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <>
                                            <Plus size={18} />
                                            Create List
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manual Contact Modal */}
            {isManualModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <UserPlus size={18} className="text-blue-600" />
                                Add New Contact
                            </h3>
                            <button
                                onClick={() => setIsManualModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleAddContact} className="p-6">
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                        First Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={newContact.firstName}
                                        onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })}
                                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                                        placeholder="John"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                        Last Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newContact.lastName}
                                        onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
                                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                                        placeholder="Doe"
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                    Phone Number <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newContact.countryCode}
                                        onChange={(e) => setNewContact({ ...newContact, countryCode: e.target.value })}
                                        className="w-20 px-3 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm text-center"
                                        placeholder="+1"
                                    />
                                    <input
                                        type="tel"
                                        required
                                        value={newContact.phoneNumber}
                                        onChange={(e) => setNewContact({ ...newContact, phoneNumber: e.target.value })}
                                        className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                                        placeholder="555-0123"
                                    />
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={newContact.email}
                                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                                    placeholder="john@example.com"
                                />
                            </div>

                            <div className="mb-6 flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                <input
                                    type="checkbox"
                                    id="optIn"
                                    checked={newContact.optedIn}
                                    onChange={(e) => setNewContact({ ...newContact, optedIn: e.target.checked })}
                                    className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <label htmlFor="optIn" className="text-xs text-blue-800 font-medium cursor-pointer">
                                    I confirm that this contact has explicitly opted-in to receive messages.
                                </label>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsManualModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-all text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={addContactLoading}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                                >
                                    {addContactLoading ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <>
                                            <UserPlus size={18} />
                                            Add Contact
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

export default Contacts;
