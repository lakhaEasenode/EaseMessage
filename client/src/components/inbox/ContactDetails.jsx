import { User, Phone, Mail, MapPin, Calendar, Tag, Clock, ChevronLeft } from 'lucide-react';

const ContactDetails = ({ contact, onBack }) => {
    if (!contact) {
        return (
            <div className="w-80 border-l border-gray-200 bg-white h-full p-6 hidden lg:flex flex-col items-center justify-center text-gray-400">
                <User size={48} className="mb-4 text-gray-200" />
                <p className="text-sm font-medium">Select a contact to view details</p>
            </div>
        );
    }

    return (
        <div className="w-full md:w-80 border-l border-gray-200 bg-white h-full flex flex-col overflow-y-auto">
            {/* Header / Profile */}
            <div className="p-8 flex flex-col items-center border-b border-gray-100 relative">
                {/* Back Button (Mobile Only) */}
                <button
                    onClick={onBack}
                    className="absolute top-4 left-4 md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                    <ChevronLeft size={24} />
                </button>

                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-blue-600 text-3xl font-bold mb-4 shadow-inner">
                    {contact.firstName.charAt(0)}
                </div>
                <h2 className="text-xl font-bold text-gray-800 text-center">
                    {contact.firstName} {contact.lastName}
                </h2>
                <div className={`mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${contact.conversationStatus === 'open' ? 'bg-blue-100 text-blue-700' :
                    contact.conversationStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                    }`}>
                    {contact.conversationStatus || 'open'}
                </div>
            </div>

            {/* Info List */}
            <div className="p-6 space-y-6">
                {/* Info List */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <User size={12} /> Contact Info
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm text-gray-700 bg-white p-2 rounded-lg border border-gray-100">
                            <Phone size={16} className="text-blue-500" />
                            <span className="font-medium">{contact.phoneNumber}</span>
                        </div>
                        {contact.email && (
                            <div className="flex items-center gap-3 text-sm text-gray-700 bg-white p-2 rounded-lg border border-gray-100">
                                <Mail size={16} className="text-blue-500" />
                                <span className="truncate">{contact.email}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-3 text-sm text-gray-700 bg-white p-2 rounded-lg border border-gray-100">
                            <MapPin size={16} className="text-blue-500" />
                            <span>{contact.countryCode === '+1' ? 'United States' : 'International'}</span>
                        </div>
                    </div>
                </div>

                {/* Tags */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Tag size={12} /> Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {contact.tags && contact.tags.length > 0 ? (
                            contact.tags.map((tag, index) => (
                                <span key={index} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white text-gray-700 text-xs font-semibold border border-gray-200 shadow-sm">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                    {tag}
                                </span>
                            ))
                        ) : (
                            <span className="text-xs text-gray-400 italic">No tags</span>
                        )}
                    </div>
                </div>

                {/* Meta */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Clock size={12} /> History
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 text-xs text-gray-600">
                            <Calendar size={14} className="text-gray-400" />
                            <span>Created {new Date(contact.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-600">
                            <div className={`w-2 h-2 rounded-full ${contact.optedIn ? 'bg-green-500 ring-2 ring-green-200' : 'bg-red-500 ring-2 ring-red-200'}`} />
                            <span className="font-medium">{contact.optedIn ? 'Opted In' : 'Not Opted In'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactDetails;
