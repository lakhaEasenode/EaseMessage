import { Search, Filter, Plus } from 'lucide-react';

const ConversationList = ({ conversations, activeId, onSelect, filter, setFilter, onNewMessage }) => {

    // Helper to format time
    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (days === 1) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString();
        }
    };

    return (
        <div className="w-80 border-r border-gray-200 h-full flex flex-col bg-white">
            {/* Header / Search */}
            <div className="p-4 border-b border-gray-100">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Inbox</h2>
                    <button
                        onClick={onNewMessage}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm active:scale-95"
                        title="New Message"
                    >
                        <Plus size={20} />
                    </button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search messages..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    />
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
                    {['all', 'open', 'pending', 'resolved'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors ${filter === f
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
                {conversations.map((conv) => (
                    <div
                        key={conv.contact._id}
                        onClick={() => onSelect(conv)}
                        className={`p-4 border-b border-gray-50 cursor-pointer transition-all duration-200 ${activeId === conv.contact._id
                            ? 'bg-blue-50/80 border-l-4 border-l-blue-600 shadow-sm'
                            : 'border-l-4 border-l-transparent hover:bg-gray-50 hover:pl-5'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <h3 className={`font-bold text-sm truncate pr-2 ${activeId === conv.contact._id ? 'text-blue-700' : 'text-gray-800'}`}>
                                {conv.contact.firstName} {conv.contact.lastName}
                            </h3>
                            {conv.lastMessage && (
                                <span className="text-[10px] text-gray-400 whitespace-nowrap font-medium">
                                    {formatTime(conv.lastMessage.timestamp)}
                                </span>
                            )}
                        </div>
                        <div className="flex justify-between items-center">
                            <p className={`text-sm truncate max-w-[180px] ${activeId === conv.contact._id ? 'text-blue-600/80' : 'text-gray-500'}`}>
                                {conv.lastMessage
                                    ? (conv.lastMessage.type === 'template' ? `Template: ${conv.lastMessage.content?.replace('Template: ', '') || 'Message'}` : conv.lastMessage.content)
                                    : 'Start a conversation'
                                }
                            </p>
                        </div>
                    </div>
                ))}

                {conversations.length === 0 && (
                    <div className="p-8 text-center text-gray-400 text-sm">
                        No conversations found
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConversationList;
