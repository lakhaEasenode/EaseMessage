import { useState, useEffect, useRef } from 'react';
import { X, Info, ChevronLeft, Video, Phone, Plus, Camera, Mic, Smile, Bold, Italic, Strikethrough, Paperclip, SmilePlus } from 'lucide-react';

// Inline toggle switch component
const ToggleSwitch = ({ enabled, onChange, disabled }) => (
    <button
        type="button"
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}
    >
        <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`}
        />
    </button>
);

const TemplateForm = ({ onClose, onSubmit, initialData, wabaAccounts = [] }) => {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('MARKETING');
    const [language, setLanguage] = useState('en_US');
    const [body, setBody] = useState('');
    const [previewBody, setPreviewBody] = useState('');

    // Section toggles
    const [showHeader, setShowHeader] = useState(false);
    const [headerText, setHeaderText] = useState('');
    const [showFooter, setShowFooter] = useState(false);
    const [footerText, setFooterText] = useState('');
    const [showButtons, setShowButtons] = useState(false);
    const [buttonType, setButtonType] = useState('call_to_action');

    const bodyRef = useRef(null);

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setCategory(initialData.category);
            setLanguage(initialData.language);
            setBody(initialData.body);
        }
    }, [initialData]);

    useEffect(() => {
        setPreviewBody(body);
    }, [body]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ name, category, language, body });
    };

    const insertAtCursor = (before, after = '') => {
        const textarea = bodyRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = body.substring(start, end);
        const newText = body.substring(0, start) + before + selected + after + body.substring(end);
        setBody(newText);
        setTimeout(() => {
            textarea.focus();
            const cursorPos = start + before.length + selected.length + after.length;
            textarea.setSelectionRange(cursorPos, cursorPos);
        }, 0);
    };

    const addVariable = () => {
        const count = (body.match(/{{(\d+)}}/g) || []).length + 1;
        insertAtCursor(`{{${count}}}`);
    };

    const isEdit = !!initialData;
    const isApproved = initialData?.status === 'APPROVED';
    const wabaName = initialData?.wabaId?.name || wabaAccounts[0]?.name || 'WhatsApp Business';
    const wabaInitial = wabaName.charAt(0).toUpperCase();

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex overflow-hidden animate-in zoom-in duration-200">

                {/* Left Side: Form */}
                <div className="w-full lg:w-1/2 flex flex-col border-r border-gray-100">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <h3 className="font-bold text-gray-800 text-lg">
                            {isEdit ? 'Edit Template' : 'Create New Template'}
                        </h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {isEdit && isApproved && (
                            <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 p-4 rounded-xl text-sm mb-6 flex gap-3">
                                <Info className="shrink-0 mt-0.5" size={16} />
                                <div>
                                    <span className="font-bold block mb-1">Editing Restricted</span>
                                    Approved templates cannot be edited directly. You can duplicate this to create a new version.
                                </div>
                            </div>
                        )}

                        <form id="templateForm" onSubmit={handleSubmit} className="space-y-5">
                            {/* Template Name */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Template Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. welcome_offer_v1"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 outline-none transition-all text-sm font-mono"
                                    disabled={isApproved}
                                    required
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Only lowercase letters, numbers, and underscores.</p>
                            </div>

                            {/* Category & Language */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                                    <select
                                        value={category}
                                        onChange={e => setCategory(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 outline-none transition-all text-sm bg-white"
                                        disabled={isApproved}
                                    >
                                        <option value="MARKETING">Marketing</option>
                                        <option value="UTILITY">Utility</option>
                                        <option value="AUTHENTICATION">Authentication</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Language</label>
                                    <select
                                        value={language}
                                        onChange={e => setLanguage(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 outline-none transition-all text-sm bg-white"
                                        disabled={isApproved}
                                    >
                                        <option value="en_US">English (US)</option>
                                        <option value="es_ES">Spanish</option>
                                        <option value="pt_BR">Portuguese (BR)</option>
                                    </select>
                                </div>
                            </div>

                            {/* ── Header Section ── */}
                            <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80">
                                    <span className="text-sm font-semibold text-gray-700">Header</span>
                                    <ToggleSwitch enabled={showHeader} onChange={setShowHeader} disabled={isApproved} />
                                </div>
                                <div className={`transition-all duration-300 ease-in-out ${showHeader ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                                    <div className="px-4 py-3 border-t border-gray-100">
                                        <input
                                            type="text"
                                            value={headerText}
                                            onChange={e => setHeaderText(e.target.value)}
                                            placeholder="Enter header text"
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 outline-none transition-all text-sm"
                                            disabled={isApproved}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ── Body Section ── */}
                            <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80">
                                    <span className="text-sm font-semibold text-gray-700">Body</span>
                                    <span className="text-xs text-gray-400">Required</span>
                                </div>
                                <div className="px-4 py-3 border-t border-gray-100">
                                    <textarea
                                        ref={bodyRef}
                                        value={body}
                                        onChange={e => setBody(e.target.value)}
                                        placeholder="Enter body text here"
                                        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 outline-none transition-all text-sm min-h-[120px] resize-y"
                                        disabled={isApproved}
                                        required
                                        maxLength={950}
                                    />
                                    {/* Formatting Toolbar */}
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={addVariable}
                                                disabled={isApproved}
                                                className="px-2 py-1 text-xs font-mono font-bold text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Add variable"
                                            >
                                                {'{{'}<span className="text-green-500">x</span>{'}}'}
                                            </button>
                                            <div className="w-px h-4 bg-gray-200 mx-1" />
                                            <button
                                                type="button"
                                                onClick={() => insertAtCursor('~', '~')}
                                                disabled={isApproved}
                                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                                                title="Strikethrough"
                                            >
                                                <Strikethrough size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isApproved}
                                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                                                title="Emoji"
                                            >
                                                <SmilePlus size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => insertAtCursor('*', '*')}
                                                disabled={isApproved}
                                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                                                title="Bold"
                                            >
                                                <Bold size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => insertAtCursor('_', '_')}
                                                disabled={isApproved}
                                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                                                title="Italic"
                                            >
                                                <Italic size={15} />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isApproved}
                                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
                                                title="Attachment"
                                            >
                                                <Paperclip size={15} />
                                            </button>
                                        </div>
                                        <span className="text-xs text-gray-400 tabular-nums">
                                            {body.length}<span className="text-gray-300">/</span>950
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* ── Footer Section ── */}
                            <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80">
                                    <span className="text-sm font-semibold text-gray-700">Footer</span>
                                    <ToggleSwitch enabled={showFooter} onChange={setShowFooter} disabled={isApproved} />
                                </div>
                                <div className={`transition-all duration-300 ease-in-out ${showFooter ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                                    <div className="px-4 py-3 border-t border-gray-100">
                                        <input
                                            type="text"
                                            value={footerText}
                                            onChange={e => setFooterText(e.target.value)}
                                            placeholder="Enter footer text"
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 outline-none transition-all text-sm"
                                            disabled={isApproved}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ── Buttons Section ── */}
                            <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80">
                                    <span className="text-sm font-semibold text-gray-700">Buttons</span>
                                    <ToggleSwitch enabled={showButtons} onChange={setShowButtons} disabled={isApproved} />
                                </div>
                                <div className={`transition-all duration-300 ease-in-out ${showButtons ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                                    <div className="px-4 py-3 border-t border-gray-100 space-y-3">
                                        <p className="text-xs text-gray-500">Choose button type</p>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setButtonType('call_to_action')}
                                                disabled={isApproved}
                                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all disabled:opacity-50 ${buttonType === 'call_to_action'
                                                    ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                                                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                Call to Action
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setButtonType('quick_reply')}
                                                disabled={isApproved}
                                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all disabled:opacity-50 ${buttonType === 'quick_reply'
                                                    ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                                                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                Quick Reply
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-gray-400">
                                            {buttonType === 'call_to_action'
                                                ? 'Add a URL or phone number button to your message.'
                                                : 'Add quick reply buttons for fast responses.'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Bottom action bar */}
                    <div className="p-6 border-t border-gray-100 bg-gray-50">
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-white transition-all text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="templateForm"
                                disabled={isApproved}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                {isEdit ? 'Save Changes' : 'Submit Template'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Side: Phone Preview */}
                <div className="hidden lg:flex w-1/2 bg-gray-100 items-center justify-center p-8">
                    <div className="w-[360px] bg-white rounded-[2.5rem] shadow-2xl border border-gray-200 overflow-hidden relative">
                        {/* Phone notch / status bar area */}
                        <div className="bg-white h-6"></div>

                        {/* WhatsApp Header */}
                        <div className="bg-white px-3 py-2 flex items-center gap-2 border-b border-gray-100">
                            <ChevronLeft size={22} className="text-[#0088cc] shrink-0" />
                            <div className="w-9 h-9 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                                <span className="text-white text-sm font-bold">{wabaInitial}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                    <span className="text-base font-semibold text-gray-900 truncate">{wabaName}</span>
                                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" fill="#25D366" />
                                        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                                <p className="text-xs text-green-500">online</p>
                            </div>
                            <Video size={20} className="text-[#0088cc] shrink-0" />
                            <Phone size={18} className="text-[#0088cc] shrink-0 ml-2" />
                        </div>

                        {/* Chat Area */}
                        <div
                            className="h-[420px] relative overflow-y-auto p-3"
                            style={{
                                backgroundColor: '#e5ddd5',
                                backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='p' width='40' height='40' patternUnits='userSpaceOnUse'%3E%3Cpath d='M20 5c1 0 2 1 2 2s-1 2-2 2-2-1-2-2 1-2 2-2zm-8 8c1.5 0 3 1 3 2.5s-1.5 2.5-3 2.5-3-1-3-2.5 1.5-2.5 3-2.5zm16 4c1 0 1.5.5 1.5 1.5S29 20 28 20s-1.5-.5-1.5-1.5S27 17 28 17zM8 28c1 0 2 1 2 2s-1 2-2 2-2-1-2-2 1-2 2-2zm22-2c.8 0 1.5.7 1.5 1.5S30.8 29 30 29s-1.5-.7-1.5-1.5S29.2 26 30 26zm-14 6c1 0 1.5.5 1.5 1.5S17 35 16 35s-1.5-.5-1.5-1.5S15 32 16 32z' fill='%23c9c1b6' fill-opacity='0.3'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='200' height='200' fill='url(%23p)'/%3E%3C/svg%3E")`,
                            }}
                        >
                            {/* Date pill */}
                            <div className="flex justify-center mb-3">
                                <span className="bg-white/90 text-[11px] text-gray-600 px-3 py-1 rounded-lg shadow-sm">
                                    {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                            </div>

                            {/* Message bubble */}
                            <div className="max-w-[85%]">
                                <div className="bg-white rounded-lg rounded-tl-none shadow-sm overflow-hidden">
                                    {/* Header in preview */}
                                    {showHeader && headerText && (
                                        <div className="px-2.5 pt-2.5 pb-1">
                                            <p className="text-[13px] font-semibold text-gray-900">{headerText}</p>
                                        </div>
                                    )}
                                    {/* Body in preview */}
                                    <div className="px-2.5 py-1.5">
                                        <p className="text-[13px] text-gray-800 whitespace-pre-wrap leading-relaxed">
                                            {previewBody || <span className="text-gray-400 italic">Your message preview will appear here...</span>}
                                        </p>
                                    </div>
                                    {/* Footer in preview */}
                                    {showFooter && footerText && (
                                        <div className="px-2.5 pb-1">
                                            <p className="text-[11px] text-gray-400">{footerText}</p>
                                        </div>
                                    )}
                                    {/* Timestamp */}
                                    <div className="flex justify-end items-center px-2.5 pb-1.5">
                                        <span className="text-[10px] text-gray-400">
                                            {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    {/* Buttons in preview */}
                                    {showButtons && (
                                        <div className="border-t border-gray-100">
                                            {buttonType === 'call_to_action' ? (
                                                <div className="text-center py-2 text-[12px] text-[#0088cc] font-medium">
                                                    Visit Website
                                                </div>
                                            ) : (
                                                <div className="flex divide-x divide-gray-100">
                                                    <div className="flex-1 text-center py-2 text-[12px] text-[#0088cc] font-medium">
                                                        Yes
                                                    </div>
                                                    <div className="flex-1 text-center py-2 text-[12px] text-[#0088cc] font-medium">
                                                        No
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Bottom Input Bar */}
                        <div className="bg-white px-2 py-2 flex items-center gap-2 border-t border-gray-100">
                            <Plus size={22} className="text-[#0088cc] shrink-0" />
                            <div className="flex-1 bg-gray-100 rounded-full px-4 py-1.5">
                                <span className="text-xs text-gray-400"></span>
                            </div>
                            <Smile size={20} className="text-[#0088cc] shrink-0" />
                            <Camera size={20} className="text-[#0088cc] shrink-0" />
                            <Mic size={20} className="text-[#0088cc] shrink-0" />
                        </div>

                        {/* Home indicator */}
                        <div className="flex justify-center py-2 bg-white">
                            <div className="w-28 h-1 bg-gray-900 rounded-full"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemplateForm;
