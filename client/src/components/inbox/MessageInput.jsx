import { useState, useEffect } from 'react';
import { Send, Paperclip, FileText, AlertCircle } from 'lucide-react';
import axios from 'axios';

const MessageInput = ({ contactId, lastInboundTime, onSend }) => {
    const [message, setMessage] = useState('');
    const [isWindowExpired, setIsWindowExpired] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    // Check 24-hour window
    useEffect(() => {
        if (!lastInboundTime) {
            // If no inbound messages ever, window is technically "expired" for free-form (business initiated)
            // Unless we consider business-initiated rules. For safety, let's say "Expired/Template Required" if no recent inbound.
            setIsWindowExpired(true);
            return;
        }

        const checkWindow = () => {
            const lastTime = new Date(lastInboundTime).getTime();
            const now = Date.now();
            const diffHours = (now - lastTime) / (1000 * 60 * 60);
            setIsWindowExpired(diffHours >= 24);
        };

        checkWindow();
        const interval = setInterval(checkWindow, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [lastInboundTime]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!message.trim()) return;
        onSend('text', message);
        setMessage('');
    };

    const loadTemplates = async () => {
        if (templates.length > 0) {
            setShowTemplateModal(true);
            return;
        }

        try {
            setLoadingTemplates(true);
            const token = localStorage.getItem('token');
            if (!token) {
                console.error("No token found");
                return;
            }
            const config = { headers: { 'x-auth-token': token } };
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

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
                    const tWabaId = t.wabaId && (t.wabaId._id || t.wabaId);
                    return tWabaId === defaultWabaId;
                });
                setTemplates(filtered);
            } else {
                setTemplates(approved);
            }

            setShowTemplateModal(true);
        } catch (err) {
            console.error("Failed to load templates", err);
            alert("Failed to load templates");
        } finally {
            setLoadingTemplates(false);
        }
    };

    const handleSendTemplate = (template) => {
        onSend('template', null, {
            name: template.name,
            language: template.language,
            components: [] // Logic for variables would go here
        });
        setShowTemplateModal(false);
    };

    return (
        <div className="p-4 bg-white border-t border-gray-100">
            {isWindowExpired ? (
                <div className="bg-yellow-50 text-yellow-800 p-3 rounded-xl flex items-center justify-between mb-3 border border-yellow-100">
                    <div className="flex items-center gap-2 text-sm">
                        <AlertCircle size={16} />
                        <span>24-hour reply window expired. Send a template to continue.</span>
                    </div>
                    <button
                        onClick={loadTemplates}
                        className="bg-yellow-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-yellow-700 transition-colors"
                        disabled={loadingTemplates}
                    >
                        {loadingTemplates ? 'Loading...' : 'Select Template'}
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSend} className="flex gap-2 items-center">
                    <button
                        type="button"
                        className="p-3 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                    >
                        <Paperclip size={20} />
                    </button>
                    <button
                        type="button"
                        onClick={loadTemplates}
                        className="p-3 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                        title="Use Template"
                    >
                        <FileText size={20} />
                    </button>
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                    />
                    <button
                        type="submit"
                        disabled={!message.trim()}
                        className="p-3 bg-green-600 text-white rounded-xl shadow-lg shadow-green-600/20 hover:bg-green-700 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
                    >
                        <Send size={20} />
                    </button>
                </form>
            )}

            {/* Template Modal - Simplified */}
            {showTemplateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
                            <h3 className="font-bold text-gray-800">Select Template</h3>
                            <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-gray-600">Close</button>
                        </div>
                        <div className="overflow-y-auto p-4 flex-1 space-y-2">
                            {templates.map(t => (
                                <div
                                    key={t._id}
                                    onClick={() => handleSendTemplate(t)}
                                    className="p-4 border rounded-xl hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition-all group"
                                >
                                    <div className="font-bold text-sm text-gray-800 mb-1 group-hover:text-blue-700">{t.name}</div>
                                    <p className="text-xs text-gray-500 line-clamp-2">{t.body}</p>
                                </div>
                            ))}
                            {templates.length === 0 && <p className="text-center text-gray-400">No approved templates found.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MessageInput;
