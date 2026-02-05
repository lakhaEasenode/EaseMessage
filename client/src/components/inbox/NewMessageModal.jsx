import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Search, X, MessageSquarePlus, User, Loader2 } from 'lucide-react';
import AuthContext from '../../context/AuthContext';

const NewMessageModal = ({ isOpen, onClose, onSelect }) => {
    const { token } = useContext(AuthContext);
    const [step, setStep] = useState(1); // 1: Select Contact, 2: Select Template
    const [searchQuery, setSearchQuery] = useState('');
    const [contacts, setContacts] = useState([]);
    const [filteredContacts, setFilteredContacts] = useState([]);
    const [selectedContact, setSelectedContact] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

    useEffect(() => {
        if (isOpen) {
            fetchContacts();
            setStep(1);
            setSearchQuery('');
            setSelectedContact(null);
        }
    }, [isOpen]);

    const fetchContacts = async () => {
        try {
            setLoading(true);
            const config = { headers: { 'x-auth-token': token } };
            const res = await axios.get(`${API_URL}/contacts`, config);
            setContacts(res.data);
            setFilteredContacts(res.data);
        } catch (err) {
            console.error("Failed to load contacts", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchTemplates = async () => {
        try {
            setLoading(true);
            const config = { headers: { 'x-auth-token': token } };

            // 1. Fetch Templates and Accounts in parallel
            const [templatesRes, accountsRes] = await Promise.all([
                axios.get(`${API_URL}/templates`, config),
                axios.get(`${API_URL}/whatsapp/accounts`, config)
            ]);

            const allTemplates = templatesRes.data;
            const accounts = accountsRes.data;

            // 2. Find Default WABA
            let defaultWabaId = null;
            for (const acc of accounts) {
                if (acc.phoneNumbers && acc.phoneNumbers.some(p => p.isDefault)) {
                    defaultWabaId = acc._id;
                    break;
                }
            }

            // 3. Filter Templates
            const approved = allTemplates.filter(t => t.status === 'APPROVED');

            if (defaultWabaId) {
                const filtered = approved.filter(t => {
                    // t.wabaId can be populated object or ID string
                    const tWabaId = t.wabaId && (t.wabaId._id || t.wabaId);
                    return tWabaId === defaultWabaId;
                });
                setTemplates(filtered);
            } else {
                // If no default account, maybe show all or none? 
                // Showing all might confuse user if they can't send.
                // But let's fallback to approved only if no default set (though buttons shouldn't work then)
                setTemplates(approved);
            }

        } catch (err) {
            console.error("Failed to load templates", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        const query = e.target.value.toLowerCase();
        setSearchQuery(query);
        const filtered = contacts.filter(c =>
            c.firstName.toLowerCase().includes(query) ||
            c.lastName?.toLowerCase().includes(query) ||
            c.phoneNumber.includes(query)
        );
        setFilteredContacts(filtered);
    };

    const handleSelectContact = (contact) => {
        setSelectedContact(contact);
        fetchTemplates();
        setStep(2);
    };

    const handleSelectTemplate = (template) => {
        onSelect(selectedContact, template);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        <MessageSquarePlus className="text-blue-600" size={20} />
                        {step === 1 ? 'New Conversation' : 'Select Template'}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-0">
                    {step === 1 ? (
                        <div className="p-4">
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search contacts..."
                                    value={searchQuery}
                                    onChange={handleSearch}
                                    autoFocus
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" /></div>
                            ) : (
                                <div className="space-y-1">
                                    {filteredContacts.map(contact => (
                                        <div
                                            key={contact._id}
                                            onClick={() => handleSelectContact(contact)}
                                            className="flex items-center gap-3 p-3 hover:bg-blue-50 rounded-xl cursor-pointer transition-colors group"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 flex items-center justify-center font-bold text-sm group-hover:from-blue-100 group-hover:to-blue-200 group-hover:text-blue-600 transition-colors">
                                                {contact.firstName.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-800 text-sm">{contact.firstName} {contact.lastName}</div>
                                                <div className="text-xs text-gray-500">{contact.phoneNumber}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredContacts.length === 0 && (
                                        <p className="text-center text-gray-400 py-8 text-sm">No contacts found</p>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-4">
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                    {selectedContact.firstName.charAt(0)}
                                </div>
                                <div className="text-sm">
                                    <span className="text-gray-500">To: </span>
                                    <span className="font-bold text-gray-800">{selectedContact.firstName} {selectedContact.lastName}</span>
                                </div>
                                <button onClick={() => setStep(1)} className="ml-auto text-xs font-bold text-blue-600 hover:underline">Change</button>
                            </div>

                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Approved Templates</p>

                            {loading ? (
                                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" /></div>
                            ) : (
                                <div className="space-y-3">
                                    {templates.map(template => (
                                        <div
                                            key={template._id}
                                            onClick={() => handleSelectTemplate(template)}
                                            className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-all active:scale-[0.99]"
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <h4 className="font-bold text-sm text-gray-800">{template.name}</h4>
                                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">{template.language}</span>
                                            </div>
                                            <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">{template.body}</p>
                                        </div>
                                    ))}
                                    {templates.length === 0 && (
                                        <p className="text-center text-gray-400 py-8 text-sm">No approved templates found.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NewMessageModal;
