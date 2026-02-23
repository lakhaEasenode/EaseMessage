import { useState, useEffect, useContext, useRef } from 'react';
import NewMessageModal from '../components/inbox/NewMessageModal';
import ContactDetails from '../components/inbox/ContactDetails';
import ConversationList from '../components/inbox/ConversationList';
import ChatWindow from '../components/inbox/ChatWindow';
import AuthContext from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../components/Toast';
import axios from 'axios';

const Inbox = () => {
    const { token } = useContext(AuthContext);
    const { isConnected, on } = useSocket();
    const toast = useToast();
    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
    const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat' | 'details'
    const [searchQuery, setSearchQuery] = useState('');
    const [drafts, setDrafts] = useState({}); // { contactId: 'draft text' }
    const [messagePagination, setMessagePagination] = useState(null);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

    // Keep a ref to activeConversation to avoid stale closures in socket handlers
    const activeConversationRef = useRef(activeConversation);
    useEffect(() => {
        activeConversationRef.current = activeConversation;
    }, [activeConversation]);

    // Fetch Conversations
    const fetchConversations = async () => {
        try {
            const config = { headers: { 'x-auth-token': token } };
            const res = await axios.get(`${API_URL}/messages/conversations`, config);
            setConversations(res.data);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching conversations:", err);
            setLoading(false);
        }
    };

    // Fetch Messages for active conversation (paginated — loads latest page)
    const fetchMessages = async (contactId, page = 1) => {
        try {
            const config = { headers: { 'x-auth-token': token } };
            const res = await axios.get(`${API_URL}/messages/${contactId}?page=${page}&limit=50`, config);
            const { messages: msgs, pagination } = res.data;
            if (page === 1) {
                setMessages(msgs);
            } else {
                // Prepend older messages when loading more history
                setMessages(prev => [...msgs, ...prev]);
            }
            setMessagePagination(pagination);
        } catch (err) {
            console.error("Error fetching messages:", err);
        }
    };

    const loadMoreMessages = () => {
        if (activeConversation && messagePagination?.hasMore) {
            fetchMessages(activeConversation.contact._id, messagePagination.page + 1);
        }
    };

    // Adaptive polling: slower when socket is connected, faster when disconnected
    useEffect(() => {
        if (token) {
            fetchConversations();
            const interval = setInterval(fetchConversations, isConnected ? 30000 : 10000);
            return () => clearInterval(interval);
        }
    }, [token, isConnected]);

    useEffect(() => {
        if (activeConversation && token) {
            fetchMessages(activeConversation.contact._id);
            const interval = setInterval(
                () => fetchMessages(activeConversation.contact._id),
                isConnected ? 30000 : 3000
            );
            return () => clearInterval(interval);
        }
    }, [activeConversation, token, isConnected]);

    // Socket event listeners
    useEffect(() => {
        if (!isConnected) return;

        const unsubs = [];

        // Inbound message
        unsubs.push(on('message:new', ({ message, contactId }) => {
            const active = activeConversationRef.current;
            if (active && active.contact._id === contactId) {
                setMessages(prev => prev.some(m => m._id === message._id) ? prev : [...prev, message]);
            }
            fetchConversations();
        }));

        // Outbound message from another tab
        unsubs.push(on('message:sent', ({ message, contactId }) => {
            const active = activeConversationRef.current;
            if (active && active.contact._id === contactId) {
                setMessages(prev => prev.some(m => m._id === message._id) ? prev : [...prev, message]);
            }
            fetchConversations();
        }));

        // Delivery status update
        unsubs.push(on('message:status', ({ messageId, contactId, status }) => {
            const active = activeConversationRef.current;
            if (active && active.contact._id === contactId) {
                setMessages(prev => prev.map(m =>
                    m._id === messageId ? { ...m, status } : m
                ));
            }
        }));

        // Conversation list changed
        unsubs.push(on('conversation:updated', () => {
            fetchConversations();
        }));

        return () => unsubs.forEach(unsub => unsub());
    }, [isConnected, on]);

    const handleSelectConversation = (conv) => {
        setActiveConversation(conv);
        setMobileView('chat');
        setMessagePagination(null);
    };

    const handleDraftChange = (contactId, text) => {
        setDrafts(prev => ({ ...prev, [contactId]: text }));
    };

    const handleSendMessage = async (type, content, templateData) => {
        if (!activeConversation) return;

        try {
            const config = { headers: { 'x-auth-token': token } };
            const payload = {
                contactId: activeConversation.contact._id,
                type,
                content,
                templateData
            };

            const res = await axios.post(`${API_URL}/messages/send`, payload, config);

            // Optimistically update or just re-fetch
            const newMsg = res.data;
            setMessages(prev => [...prev, newMsg]);

            // Update conversation list sort order if needed (re-fetch does this)
            fetchConversations();

        } catch (err) {
            console.error("Error sending message:", err);
            toast.error(err.response?.data?.msg || "Failed to send message");
        }
    };

    const handleStartNewConversation = async (contact, template) => {
        try {
            // Check if conversation already exists locally
            const existing = conversations.find(c => c.contact._id === contact._id);
            if (existing) {
                setActiveConversation(existing);
                setMobileView('chat');
                // We should still send the template if the user selected one, 
                // BUT usually clicking an existing contact just opens it. 
                // The UX "New Message" -> Select Existing -> Select Template -> Send implies sending it.
                // So let's send it.
            } else {
                // Create temporary optimistic conversation so UI updates immediately?
                // Or wait for send. Ideally send first.
            }

            const config = { headers: { 'x-auth-token': token } };
            const payload = {
                contactId: contact._id,
                type: 'template',
                content: null,
                templateData: {
                    name: template.name,
                    language: template.language,
                    components: []
                }
            };

            const res = await axios.post(`${API_URL}/messages/send`, payload, config);

            // Re-fetch conversations to get the new one (backend will now include it)
            await fetchConversations();

            // Set active
            // We need to find the new conversation object
            // Just fetching acts as refresh, but we need to set active
            // We can construct a matching object or fetch specific
            // Let's just set active to a constructed object matching the shape until refresh syncs
            const newConv = {
                contact: contact,
                lastMessage: res.data,
                sortTime: new Date()
            };
            setActiveConversation(newConv);
            setMobileView('chat');
            setMessages([res.data]); // Start with this message

        } catch (err) {
            console.error("Error starting conversation:", err);
            toast.error(err.response?.data?.msg || "Failed to start conversation");
        }
    };

    const handleStatusChange = async (newStatus) => {
        if (!activeConversation) return;

        console.log(`Updating status for contact ${activeConversation.contact._id} to ${newStatus}`);

        try {
            const config = { headers: { 'x-auth-token': token } };
            // Update Backend
            const res = await axios.put(`${API_URL}/contacts/${activeConversation.contact._id}/status`, { status: newStatus }, config);

            // Backend returns updated contact
            const updatedContact = res.data;

            // Updated Conversation Object
            const updatedConv = { ...activeConversation, contact: updatedContact };

            // Update Active Conversation State
            setActiveConversation(updatedConv);

            // Update List State
            setConversations(prev => prev.map(c =>
                c.contact._id === updatedContact._id ? updatedConv : c
            ));

        } catch (err) {
            console.error("Failed to update status", err);
            toast.error("Failed to update status: " + (err.response?.data?.msg || err.message));
        }
    };

    const filteredConversations = conversations.filter(c => {
        // Status filter
        if (filter !== 'all') {
            const status = c.contact.conversationStatus || 'open';
            if (status !== filter) return false;
        }
        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const name = `${c.contact.firstName} ${c.contact.lastName || ''}`.toLowerCase();
            const phone = c.contact.phoneNumber || '';
            if (!name.includes(query) && !phone.includes(query)) return false;
        }
        return true;
    });

    if (loading) {
        return <div className="flex items-center justify-center h-screen bg-gray-50">Loading Inbox...</div>;
    }

    return (
        // Flush layout: Gap only at top (handled by Layout pt-8). Full width/height elsewhere.
        // Added border-t for separation from the gray top gap.
        <div className="flex h-full overflow-hidden bg-white border-t border-gray-200 shadow-sm relative">
            {/* List View - Always visible on desktop, visible on mobile only if view is list */}
            <div className={`w-full md:w-auto md:flex-shrink-0 transition-all duration-300 ${mobileView === 'list' ? 'block' : 'hidden md:block'}`}>
                <ConversationList
                    conversations={filteredConversations}
                    activeId={activeConversation?.contact._id}
                    onSelect={handleSelectConversation}
                    filter={filter}
                    setFilter={setFilter}
                    onNewMessage={() => setIsNewMessageOpen(true)}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                />
            </div>

            {/* Chat View - Flex grow on desktop, visible on mobile only if view is chat */}
            <div className={`flex-1 transition-all duration-300 ${mobileView === 'chat' ? 'flex' : 'hidden md:flex'}`}>
                <ChatWindow
                    conversation={activeConversation}
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    onStatusChange={handleStatusChange}
                    onBack={() => setMobileView('list')}
                    onDetails={() => setMobileView('details')}
                    draft={activeConversation ? (drafts[activeConversation.contact._id] || '') : ''}
                    onDraftChange={handleDraftChange}
                    hasMoreMessages={messagePagination?.hasMore || false}
                    onLoadMore={loadMoreMessages}
                />
            </div>

            {/* Details View - Fixed width on desktop, full width on mobile if view is details */}
            <div className={`transition-all duration-300 ${mobileView === 'details' ? 'block w-full absolute inset-0 z-20 bg-white md:static md:w-auto md:block' : 'hidden lg:block'}`}>
                <ContactDetails
                    contact={activeConversation?.contact}
                    onBack={() => setMobileView('chat')}
                />
            </div>

            <NewMessageModal
                isOpen={isNewMessageOpen}
                onClose={() => setIsNewMessageOpen(false)}
                onSelect={handleStartNewConversation}
            />
        </div>
    );
};

export default Inbox;
