import { useState } from 'react';
import { User, Phone, Mail, MapPin, Calendar, List, Clock, ChevronLeft, UserPlus, Save, X } from 'lucide-react';

const SaveContactForm = ({ contact, onSave, onCancel }) => {
    const [form, setForm] = useState({
        firstName: contact.firstName === 'Unknown' ? '' : contact.firstName,
        lastName: contact.lastName || '',
        countryCode: contact.countryCode || '',
        phoneNumber: contact.phoneNumber || '',
        email: contact.email || '',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.firstName.trim()) return;
        setSaving(true);
        await onSave(contact._id, {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            countryCode: form.countryCode.trim(),
            phoneNumber: form.phoneNumber.trim(),
            email: form.email.trim(),
            optInSource: 'manual',
        });
        setSaving(false);
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    <UserPlus size={14} className="text-amber-600" />
                    Save Contact
                </h3>
                <button type="button" onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                    <X size={16} />
                </button>
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">First Name *</label>
                <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400"
                    placeholder="First name"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Last Name</label>
                <input
                    type="text"
                    value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400"
                    placeholder="Last name"
                />
            </div>
            <div className="flex gap-2">
                <div className="w-24">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Country</label>
                    <input
                        type="text"
                        value={form.countryCode}
                        onChange={e => setForm(f => ({ ...f, countryCode: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400"
                        placeholder="91"
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                    <input
                        type="text"
                        value={form.phoneNumber}
                        onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400 bg-gray-50"
                        placeholder="Phone number"
                    />
                </div>
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400"
                    placeholder="email@example.com"
                />
            </div>
            <button
                type="submit"
                disabled={saving || !form.firstName.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 transition-colors"
            >
                <Save size={14} />
                {saving ? 'Saving...' : 'Save Contact'}
            </button>
        </form>
    );
};

const ContactDetails = ({ contact, onBack, onSaveContact }) => {
    const [showSaveForm, setShowSaveForm] = useState(false);
    const isUnsaved = contact?.optInSource === 'whatsapp_inbound';

    if (!contact) {
        return (
            <div className="w-80 border-l border-gray-200 bg-white h-full p-6 hidden lg:flex flex-col items-center justify-center text-gray-400">
                <User size={48} className="mb-4 text-gray-200" />
                <p className="text-sm font-medium">Select a contact to view details</p>
            </div>
        );
    }

    const handleSave = async (contactId, updates) => {
        await onSaveContact(contactId, updates);
        setShowSaveForm(false);
    };

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

                <div className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mb-4 shadow-inner ${isUnsaved
                    ? 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600'
                    : 'bg-gradient-to-br from-primary-50 to-primary-100 text-primary-600'
                    }`}>
                    {contact.firstName.charAt(0)}
                </div>
                <h2 className="text-xl font-bold text-gray-800 text-center">
                    {contact.firstName} {contact.lastName}
                </h2>

                {isUnsaved && !showSaveForm && (
                    <button
                        onClick={() => setShowSaveForm(true)}
                        className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full hover:bg-amber-100 transition-colors"
                    >
                        <UserPlus size={12} />
                        Save Contact
                    </button>
                )}

                {!isUnsaved && (
                    <div className={`mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${contact.conversationStatus === 'open' ? 'bg-primary-100 text-primary-700' :
                        contact.conversationStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                        }`}>
                        {contact.conversationStatus || 'open'}
                    </div>
                )}
            </div>

            {/* Save Contact Form (shown for unsaved contacts) */}
            {isUnsaved && showSaveForm && (
                <div className="border-b border-gray-100">
                    <SaveContactForm
                        contact={contact}
                        onSave={handleSave}
                        onCancel={() => setShowSaveForm(false)}
                    />
                </div>
            )}

            {/* Info List */}
            <div className="p-6 space-y-6">
                {/* Unsaved contact banner */}
                {isUnsaved && !showSaveForm && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                        <UserPlus size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-700">
                            This number messaged you but isn't saved as a contact yet. Save it to add a name, email, and assign to lists.
                        </p>
                    </div>
                )}

                {/* Contact Info */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <User size={12} /> Contact Info
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm text-gray-700 bg-white p-2 rounded-lg border border-gray-100">
                            <Phone size={16} className="text-primary-500" />
                            <span className="font-medium">{contact.phoneNumber}</span>
                        </div>
                        {contact.email && (
                            <div className="flex items-center gap-3 text-sm text-gray-700 bg-white p-2 rounded-lg border border-gray-100">
                                <Mail size={16} className="text-primary-500" />
                                <span className="truncate">{contact.email}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-3 text-sm text-gray-700 bg-white p-2 rounded-lg border border-gray-100">
                            <MapPin size={16} className="text-primary-500" />
                            <span>{contact.countryCode === '+1' ? 'United States' : 'International'}</span>
                        </div>
                    </div>
                </div>

                {/* Lists */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <List size={12} /> Lists
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {contact.lists && contact.lists.length > 0 ? (
                            contact.lists.map((list) => (
                                <span key={list._id || list} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white text-gray-700 text-xs font-semibold border border-gray-200 shadow-sm">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary-500"></div>
                                    {list.name || list}
                                </span>
                            ))
                        ) : (
                            <span className="text-xs text-gray-400 italic">Not in any list</span>
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
