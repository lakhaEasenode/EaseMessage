import { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import { MoreVertical, Phone, Video, ChevronLeft, Info } from 'lucide-react';

import StatusSelector from './StatusSelector';

const ChatWindow = ({ conversation, messages, onSendMessage, onStatusChange, onBack, onDetails }) => {
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (!conversation) {
        return (
            <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-gray-50 text-gray-400">
                <div className="bg-white p-6 rounded-full shadow-sm mb-4">
                    <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                </div>
                <p className="text-lg font-medium text-gray-500">Select a conversation to start messaging</p>
            </div>
        );
    }

    const { contact } = conversation;

    // Determine last inbound message for 24h window
    const lastInbound = messages
        .filter(m => m.direction === 'inbound')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

    return (
        <div className="flex-1 flex flex-col h-full bg-[#efeae2] relative w-full">
            {/* Header */}
            <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shadow-sm z-10 sticky top-0">
                <div className="flex items-center gap-3">
                    {/* Back Button (Mobile Only) */}
                    <button
                        onClick={onBack}
                        className="md:hidden p-1 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full"
                    >
                        <ChevronLeft size={24} />
                    </button>

                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold flex-shrink-0">
                        {contact.firstName.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                        <h3 className="font-bold text-gray-800 truncate">{contact.firstName} {contact.lastName}</h3>
                        <span className="text-xs text-gray-500 block truncate">
                            {contact.phoneNumber}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-gray-600">
                    <div className="hidden md:block">
                        <StatusSelector status={contact.conversationStatus || 'open'} onChange={onStatusChange} />
                    </div>

                    {/* Mobile Details Trigger */}
                    <button
                        onClick={onDetails}
                        className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <Info size={20} />
                    </button>

                    <div className="hidden md:flex items-center gap-2">
                        <div className="h-6 w-px bg-gray-200 mx-2"></div>
                        <button className="hover:bg-gray-100 p-2 rounded-lg transition-colors"><Phone size={20} /></button>
                        <button className="hover:bg-gray-100 p-2 rounded-lg transition-colors"><Video size={20} /></button>
                        <button className="hover:bg-gray-100 p-2 rounded-lg transition-colors"><MoreVertical size={20} /></button>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Background Pattern Overlay if needed, or just color */}
                {messages.map((msg) => (
                    <MessageBubble
                        key={msg._id}
                        message={msg}
                        isOwn={msg.direction === 'outbound'}
                    />
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            <MessageInput
                contactId={contact._id}
                lastInboundTime={lastInbound ? lastInbound.timestamp : null}
                onSend={onSendMessage}
            />
        </div>
    );
};

export default ChatWindow;
