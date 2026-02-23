import { useState } from 'react';
import { Search, Plus, CheckCircle, Clock, AlertCircle, ChevronDown, Layers } from 'lucide-react';

const ConversationList = ({ conversations, activeId, onSelect, filter, setFilter, onNewMessage, searchQuery, onSearchChange }) => {
    const [isFilterOpen, setIsFilterOpen] = useState(false);

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

    const getStatusConfig = (status) => {
        switch (status) {
            case 'resolved':
                return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100', border: 'border-green-200' };
            case 'pending':
                return { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100', border: 'border-yellow-200' };
            case 'open':
            default:
                return { icon: AlertCircle, color: 'text-primary-500', bg: 'bg-primary-100', border: 'border-primary-200' };
        }
    };

    const filterOptions = [
        { id: 'all', label: 'All Messages', icon: Layers, color: 'text-gray-600' },
        { id: 'open', label: 'Open', icon: AlertCircle, color: 'text-primary-500' },
        { id: 'pending', label: 'Pending', icon: Clock, color: 'text-yellow-600' },
        { id: 'resolved', label: 'Resolved', icon: CheckCircle, color: 'text-green-500' }
    ];

    const currentFilter = filterOptions.find(f => f.id === filter) || filterOptions[0];
    const FilterIcon = currentFilter.icon;

    return (
        <div className="w-72 border-r border-gray-200 h-full flex flex-col bg-white">
            {/* Header / Search */}
            <div className="p-3 border-b border-gray-100 bg-white z-10 sticky top-0">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xl font-bold text-gray-900 tracking-tight">Inbox</h2>
                    <button
                        onClick={onNewMessage}
                        className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all shadow-md active:scale-95 group"
                        title="New Message"
                    >
                        <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>
                <div className="relative group mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-600 transition-colors" size={14} />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-gray-100 border-none rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 transition-all text-xs font-medium placeholder:text-gray-400"
                    />
                </div>

                {/* Filter Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <FilterIcon size={14} className={currentFilter.color} />
                            <span className="text-xs font-bold text-gray-700">{currentFilter.label}</span>
                        </div>
                        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isFilterOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setIsFilterOpen(false)}
                            />
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-lg shadow-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                {filterOptions.map((opt) => {
                                    const Icon = opt.icon;
                                    const isSelected = filter === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => {
                                                setFilter(opt.id);
                                                setIsFilterOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${isSelected ? 'bg-primary-50/50' : 'hover:bg-gray-50'
                                                }`}
                                        >
                                            <Icon size={14} className={opt.color} />
                                            <span className={`text-xs ${isSelected ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>
                                                {opt.label}
                                            </span>
                                            {isSelected && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {conversations.map((conv) => {
                    const status = conv.contact.conversationStatus || 'open';
                    const statusConfig = getStatusConfig(status);
                    const StatusIcon = statusConfig.icon;
                    const isActive = activeId === conv.contact._id;
                    const unread = conv.unreadCount || 0;

                    return (
                        <div
                            key={conv.contact._id}
                            onClick={() => onSelect(conv)}
                            className={`p-3 border-b border-gray-50 cursor-pointer transition-all duration-200 relative ${isActive
                                ? 'bg-primary-50/60'
                                : 'hover:bg-gray-50'
                                }`}
                        >
                            {isActive && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary-600 rounded-r-full" />}

                            <div className="flex justify-between items-start mb-0.5 relative">
                                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                    <h3 className={`text-sm truncate ${unread > 0 ? 'font-extrabold text-gray-900' : 'font-bold text-gray-900'}`}>
                                        {conv.contact.firstName} {conv.contact.lastName}
                                    </h3>
                                    <StatusIcon size={12} className={statusConfig.color} />
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {conv.lastMessage && (
                                        <span className={`text-[10px] whitespace-nowrap pt-0.5 ${unread > 0 ? 'text-green-600 font-bold' : 'text-gray-400 font-medium'}`}>
                                            {formatTime(conv.lastMessage.timestamp)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-between items-end">
                                <p className={`text-xs truncate max-w-[180px] leading-relaxed ${unread > 0 ? 'font-semibold text-gray-800' : (isActive ? 'text-gray-700' : 'text-gray-500')}`}>
                                    {conv.lastMessage
                                        ? (conv.lastMessage.type === 'template' ?
                                            <span className="flex items-center gap-1.5">
                                                <span className="px-1 py-0 rounded bg-gray-100 text-[9px] font-bold text-gray-500 border border-gray-200 uppercase tracking-wider">TMP</span>
                                                <span className="truncate">{conv.lastMessage.content?.replace('Template: ', '') || 'Template Message'}</span>
                                            </span>
                                            : conv.lastMessage.content)
                                        : <span className="italic opacity-80">Start a conversation</span>
                                    }
                                </p>
                                {unread > 0 && (
                                    <span className="ml-2 min-w-[20px] h-5 flex items-center justify-center bg-green-500 text-white text-[10px] font-bold rounded-full px-1.5 flex-shrink-0">
                                        {unread > 99 ? '99+' : unread}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}

                {conversations.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-center px-6">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <AlertCircle className="text-gray-300" size={32} />
                        </div>
                        <h3 className="text-gray-900 font-bold mb-1">No messages</h3>
                        <p className="text-gray-400 text-xs max-w-[180px]">Messages matching your filter will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConversationList;
