import { ChevronDown, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const StatusSelector = ({ status, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    const statuses = [
        { value: 'open', label: 'Open', icon: AlertCircle, color: 'text-primary-600', bg: 'bg-primary-100' },
        { value: 'pending', label: 'Pending', icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
        { value: 'resolved', label: 'Resolved', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
    ];

    const current = statuses.find(s => s.value === status) || statuses[0];

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${current.color} ${current.bg} border-transparent hover:brightness-95`}
            >
                <current.icon size={14} />
                <span className="capitalize">{current.label}</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-1">
                        {statuses.map((s) => (
                            <button
                                key={s.value}
                                onClick={() => {
                                    onChange(s.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${status === s.value ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <div className={`p-1 rounded-full ${s.bg} ${s.color}`}>
                                    <s.icon size={12} />
                                </div>
                                {s.label}
                                {status === s.value && <CheckCircle size={12} className="ml-auto text-gray-400" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StatusSelector;
