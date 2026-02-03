import { useState, useEffect, useContext } from 'react';
import NewMessageModal from '../components/inbox/NewMessageModal';
import ContactDetails from '../components/inbox/ContactDetails';
import ConversationList from '../components/inbox/ConversationList';
import ChatWindow from '../components/inbox/ChatWindow';
import AuthContext from '../context/AuthContext';
import axios from 'axios';

const Inbox = () => {
    const { token } = useContext(AuthContext);
    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
    const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat' | 'details'

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

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

    // Fetch Messages for active conversation
    const fetchMessages = async (contactId) => {
        try {
            const config = { headers: { 'x-auth-token': token } };
            const res = await axios.get(`${API_URL}/messages/${contactId}`, config);
            setMessages(res.data);
        } catch (err) {
            console.error("Error fetching messages:", err);
        }
    };

    useEffect(() => {
        if (token) {
            fetchConversations();
            // Poll for new conversations every 10 seconds
            const interval = setInterval(fetchConversations, 10000);
            return () => clearInterval(interval);
        }
    }, [token]);

    useEffect(() => {
        if (activeConversation && token) {
            fetchMessages(activeConversation.contact._id);
            // Poll for new messages every 3 seconds
            const interval = setInterval(() => fetchMessages(activeConversation.contact._id), 3000);
            return () => clearInterval(interval);
        }
    }, [activeConversation, token]);

    const handleSelectConversation = (conv) => {
        setActiveConversation(conv);
        setMobileView('chat');
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
            alert(err.response?.data?.msg || "Failed to send message");
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
            alert(err.response?.data?.msg || "Failed to start conversation");
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
            alert("Failed to update status: " + (err.response?.data?.msg || err.message));
        }
    };

    const filteredConversations = conversations.filter(c => {
        if (filter === 'all') return true;
        // Default to 'open' if undefined
        const status = c.contact.conversationStatus || 'open';
        return status === filter;
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
