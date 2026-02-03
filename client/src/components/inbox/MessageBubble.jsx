import { Check, CheckCheck } from 'lucide-react';

const MessageBubble = ({ message, isOwn }) => {
    const isTemplate = message.type === 'template';

    // Parse content if it's a template (sometimes stored as stringified JSON or plain text)
    let displayContent = message.content;
    if (isTemplate && message.content.startsWith('Template: ')) {
        displayContent = (
            <div className="space-y-1">
                <span className="text-xs font-bold uppercase opacity-70 block mb-1">
                    Template Message
                </span>
                {message.content.replace('Template: ', '')}
            </div>
        );
    }

    return (
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
            <div
                className={`max-w-[70%] px-4 py-2 rounded-2xl shadow-sm relative group ${isOwn
                        ? 'bg-green-100 text-gray-800 rounded-tr-none'
                        : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                    }`}
            >
                <div className="text-sm leading-relaxed break-words">
                    {displayContent}
                </div>

                <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] text-gray-500">
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isOwn && (
                        <span className={`flex ml-0.5 ${message.status === 'read' ? 'text-blue-500' : 'text-gray-400'}`}>
                            {message.status === 'read' ? <CheckCheck size={14} /> : <Check size={14} />}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;
