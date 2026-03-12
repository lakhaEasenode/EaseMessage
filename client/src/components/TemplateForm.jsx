import { useState, useEffect, useRef } from 'react';
import { X, Info, ChevronLeft, Video, Phone, Plus, Camera, Mic, Smile, Bold, Italic, Strikethrough, Paperclip, SmilePlus, Search, User, ChevronDown, Globe, PhoneCall, Trash2, ExternalLink, Upload, FileText, Image, Film, Loader2 } from 'lucide-react';
import axios from 'axios';

// Contact attribute definitions derived from the Contact data model
const CONTACT_ATTRIBUTES = [
    { key: 'FIRSTNAME', label: 'FIRSTNAME', type: 'Text' },
    { key: 'LASTNAME', label: 'LASTNAME', type: 'Text' },
    { key: 'PHONE_NUMBER', label: 'PHONE_NUMBER', type: 'Text' },
    { key: 'COUNTRY_CODE', label: 'COUNTRY_CODE', type: 'Text' },
    { key: 'EMAIL', label: 'EMAIL', type: 'Text' },
    { key: 'COMPANY_NAME', label: 'COMPANY_NAME', type: 'Text' },
    { key: 'OPTED_IN', label: 'OPTED_IN', type: 'Boolean' },
    { key: 'OPT_IN_SOURCE', label: 'OPT_IN_SOURCE', type: 'Category' },
    { key: 'TAGS', label: 'TAGS', type: 'Text' },
    { key: 'SHEET_NAME', label: 'SHEET_NAME', type: 'Text' },
    { key: 'CONVERSATION_STATUS', label: 'CONVERSATION_STATUS', type: 'Category' },
];

const TYPE_COLORS = {
    Text: 'bg-blue-50 text-blue-600 border-blue-100',
    Boolean: 'bg-amber-50 text-amber-600 border-amber-100',
    Category: 'bg-purple-50 text-purple-600 border-purple-100',
};

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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

const TemplateForm = ({ onClose, onSubmit, initialData, wabaAccounts = [] }) => {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('MARKETING');
    const [language, setLanguage] = useState('en_US');
    const [body, setBody] = useState('');
    const [previewBody, setPreviewBody] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    // WABA selection
    const [selectedWabaId, setSelectedWabaId] = useState('');

    // Section toggles
    const [showHeader, setShowHeader] = useState(false);
    const [headerText, setHeaderText] = useState('');
    const [showFooter, setShowFooter] = useState(false);
    const [footerText, setFooterText] = useState('');
    const [showButtons, setShowButtons] = useState(false);
    const [buttonType, setButtonType] = useState('call_to_action');

    // Body media attachment (renders as HEADER component in API)
    const [bodyMediaFormat, setBodyMediaFormat] = useState(''); // '', 'IMAGE', 'VIDEO', 'DOCUMENT'
    const [bodyMediaFile, setBodyMediaFile] = useState(null); // { handle, fileName, fileSize, mediaType }
    const [bodyMediaPreviewUrl, setBodyMediaPreviewUrl] = useState('');
    const [bodyMediaUploading, setBodyMediaUploading] = useState(false);
    const [bodyMediaError, setBodyMediaError] = useState('');
    const bodyMediaFileRef = useRef(null);

    // CTA buttons state (max 2)
    const [ctaButtons, setCtaButtons] = useState([
        { actionType: 'visit_website', text: '', urlType: 'static', url: '', phoneNumber: '' }
    ]);

    // Quick reply buttons state (max 3)
    const [quickReplyButtons, setQuickReplyButtons] = useState([{ text: '' }]);

    // Variable panel state
    const [showVariablePanel, setShowVariablePanel] = useState(false);
    const [variableSearch, setVariableSearch] = useState('');
    const [selectedAttribute, setSelectedAttribute] = useState(null);
    const [fallbackValue, setFallbackValue] = useState('');
    const [isAttrDropdownOpen, setIsAttrDropdownOpen] = useState(false);
    const attrDropdownRef = useRef(null);

    const bodyRef = useRef(null);
    const cursorPosRef = useRef({ start: 0, end: 0 });

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setCategory(initialData.category);
            setLanguage(initialData.language);
            setBody(initialData.body);
            if (initialData.wabaId?._id) {
                setSelectedWabaId(initialData.wabaId._id);
            }
            // Restore header/footer/buttons from existing components
            if (initialData.components && Array.isArray(initialData.components)) {
                const headerComp = initialData.components.find(c => c.type === 'HEADER');
                if (headerComp) {
                    if (headerComp.format === 'TEXT') {
                        setShowHeader(true);
                        setHeaderText(headerComp.text || '');
                    } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
                        // Media was stored as header in API — show it in body media section
                        setBodyMediaFormat(headerComp.format);
                    }
                }
                const footerComp = initialData.components.find(c => c.type === 'FOOTER');
                if (footerComp) {
                    setShowFooter(true);
                    setFooterText(footerComp.text || '');
                }
                const buttonsComp = initialData.components.find(c => c.type === 'BUTTONS');
                if (buttonsComp && buttonsComp.buttons?.length > 0) {
                    setShowButtons(true);
                    const firstBtn = buttonsComp.buttons[0];
                    if (firstBtn.type === 'QUICK_REPLY') {
                        setButtonType('quick_reply');
                        setQuickReplyButtons(buttonsComp.buttons.map(b => ({ text: b.text || '' })));
                    } else {
                        setButtonType('call_to_action');
                        setCtaButtons(buttonsComp.buttons.map(b => ({
                            actionType: b.type === 'PHONE_NUMBER' ? 'call_phone' : 'visit_website',
                            text: b.text || '',
                            urlType: 'static',
                            url: b.url || '',
                            phoneNumber: b.phone_number || ''
                        })));
                    }
                }
            }
        }
    }, [initialData]);

    // Auto-select first WABA if none selected
    useEffect(() => {
        if (!selectedWabaId && wabaAccounts.length > 0) {
            setSelectedWabaId(wabaAccounts[0]._id);
        }
    }, [wabaAccounts, selectedWabaId]);

    useEffect(() => {
        setPreviewBody(body);
    }, [body]);

    // Close attribute dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (attrDropdownRef.current && !attrDropdownRef.current.contains(e.target)) {
                setIsAttrDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const buildComponents = () => {
        const components = [];

        // HEADER component — media takes priority over text header (API allows only one HEADER)
        if (bodyMediaFormat && bodyMediaFile) {
            components.push({
                type: 'HEADER',
                format: bodyMediaFormat,
                headerHandle: bodyMediaFile.handle,
            });
        } else if (showHeader && headerText.trim()) {
            components.push({
                type: 'HEADER',
                format: 'TEXT',
                text: headerText.trim()
            });
        }

        // BODY component (always included)
        components.push({
            type: 'BODY',
            text: body
        });

        // FOOTER component
        if (showFooter && footerText.trim()) {
            components.push({
                type: 'FOOTER',
                text: footerText.trim()
            });
        }

        // BUTTONS component
        if (showButtons) {
            if (buttonType === 'call_to_action') {
                const buttons = ctaButtons
                    .filter(btn => btn.text.trim())
                    .map(btn => {
                        if (btn.actionType === 'visit_website') {
                            return {
                                type: 'URL',
                                text: btn.text.trim(),
                                url: btn.url.trim()
                            };
                        }
                        return {
                            type: 'PHONE_NUMBER',
                            text: btn.text.trim(),
                            phone_number: btn.phoneNumber.trim()
                        };
                    });
                if (buttons.length > 0) {
                    components.push({ type: 'BUTTONS', buttons });
                }
            } else if (buttonType === 'quick_reply') {
                const buttons = quickReplyButtons
                    .filter(btn => btn.text.trim())
                    .map(btn => ({ type: 'QUICK_REPLY', text: btn.text.trim() }));
                if (buttons.length > 0) {
                    components.push({ type: 'BUTTONS', buttons });
                }
            }
        }

        return components;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitError('');
        setSubmitting(true);
        try {
            const components = buildComponents();
            await onSubmit({ name, category, language, body, components, wabaId: selectedWabaId });
        } catch (err) {
            const msg = err.response?.data?.msg || err.message || 'Failed to create template. Please try again.';
            setSubmitError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const saveCursorPosition = () => {
        const textarea = bodyRef.current;
        if (textarea) {
            cursorPosRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd };
        }
    };

    const insertAtCursor = (before, after = '') => {
        const textarea = bodyRef.current;
        if (!textarea) return;
        const { start, end } = cursorPosRef.current;
        const selected = body.substring(start, end);
        const newText = body.substring(0, start) + before + selected + after + body.substring(end);
        setBody(newText);
        setTimeout(() => {
            textarea.focus();
            const cursorPos = start + before.length + selected.length + after.length;
            textarea.setSelectionRange(cursorPos, cursorPos);
            cursorPosRef.current = { start: cursorPos, end: cursorPos };
        }, 0);
    };

    const openVariablePanel = () => {
        setSelectedAttribute(null);
        setFallbackValue('');
        setVariableSearch('');
        setIsAttrDropdownOpen(false);
        setShowVariablePanel(true);
    };

    const handleInsertVariable = () => {
        if (!selectedAttribute) return;
        const count = (body.match(/{{(\d+)}}/g) || []).length + 1;
        insertAtCursor(`{{${count}}}`);
        setShowVariablePanel(false);
    };

    const handleEmojiClick = () => {
        const textarea = bodyRef.current;
        if (!textarea) return;
        textarea.focus();
        const { start, end } = cursorPosRef.current;
        textarea.setSelectionRange(start, end);
        if (typeof textarea.showPicker === 'function') {
            try { textarea.showPicker(); } catch { /* silently fail */ }
        }
    };

    // Body media upload handler
    const MEDIA_ACCEPT = {
        IMAGE: 'image/jpeg,image/png',
        VIDEO: 'video/mp4',
        DOCUMENT: 'application/pdf',
    };

    const handleBodyMediaUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setBodyMediaError('');
        setBodyMediaUploading(true);
        const blobUrl = URL.createObjectURL(file);

        const formData = new FormData();
        formData.append('file', file);
        if (selectedWabaId) formData.append('wabaId', selectedWabaId);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(
                `${API_URL}/upload/media-handle`,
                formData,
                {
                    headers: {
                        'x-auth-token': token,
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );
            setBodyMediaFile(res.data);
            setBodyMediaPreviewUrl(blobUrl);
        } catch (err) {
            URL.revokeObjectURL(blobUrl);
            const msg = err.response?.data?.msg || 'Upload failed. Please try again.';
            setBodyMediaError(msg);
        } finally {
            setBodyMediaUploading(false);
            if (bodyMediaFileRef.current) bodyMediaFileRef.current.value = '';
        }
    };

    const removeBodyMedia = () => {
        if (bodyMediaPreviewUrl) URL.revokeObjectURL(bodyMediaPreviewUrl);
        setBodyMediaFile(null);
        setBodyMediaPreviewUrl('');
        setBodyMediaFormat('');
        setBodyMediaError('');
    };

    const [showMediaPicker, setShowMediaPicker] = useState(false);
    const mediaPickerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (mediaPickerRef.current && !mediaPickerRef.current.contains(e.target)) {
                setShowMediaPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredAttributes = CONTACT_ATTRIBUTES.filter(attr =>
        attr.label.toLowerCase().includes(variableSearch.toLowerCase())
    );

    const updateCtaButton = (index, field, value) => {
        setCtaButtons(prev => prev.map((btn, i) => i === index ? { ...btn, [field]: value } : btn));
    };

    const addCtaButton = () => {
        if (ctaButtons.length < 2) {
            setCtaButtons(prev => [...prev, { actionType: 'visit_website', text: '', urlType: 'static', url: '', phoneNumber: '' }]);
        }
    };

    const removeCtaButton = (index) => {
        if (ctaButtons.length > 1) {
            setCtaButtons(prev => prev.filter((_, i) => i !== index));
        }
    };

    const updateQuickReply = (index, text) => {
        setQuickReplyButtons(prev => prev.map((btn, i) => i === index ? { text } : btn));
    };

    const addQuickReply = () => {
        if (quickReplyButtons.length < 3) {
            setQuickReplyButtons(prev => [...prev, { text: '' }]);
        }
    };

    const removeQuickReply = (index) => {
        if (quickReplyButtons.length > 1) {
            setQuickReplyButtons(prev => prev.filter((_, i) => i !== index));
        }
    };

    const isEdit = !!initialData;
    const isApproved = initialData?.status === 'APPROVED';
    const selectedWaba = wabaAccounts.find(w => w._id === selectedWabaId);
    const wabaName = selectedWaba?.name || wabaAccounts[0]?.name || 'WhatsApp Business';
    const wabaInitial = wabaName.charAt(0).toUpperCase();

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex overflow-hidden animate-in zoom-in duration-200 relative">

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

                        {submitError && (
                            <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-xl text-sm mb-6 flex gap-3">
                                <Info className="shrink-0 mt-0.5" size={16} />
                                <div>
                                    <span className="font-bold block mb-1">Template Creation Failed</span>
                                    {submitError}
                                </div>
                            </div>
                        )}

                        <form id="templateForm" onSubmit={handleSubmit} className="space-y-5">
                            {/* WABA Account Selector */}
                            {wabaAccounts.length > 0 && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">WhatsApp Business Account</label>
                                    <select
                                        value={selectedWabaId}
                                        onChange={e => setSelectedWabaId(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 outline-none transition-all text-sm bg-white"
                                        disabled={isApproved}
                                        required
                                    >
                                        {wabaAccounts.map(waba => (
                                            <option key={waba._id} value={waba._id}>{waba.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Template Name */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Template Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => {
                                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                                        setName(val);
                                    }}
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
                                        <option value="hi">Hindi</option>
                                    </select>
                                </div>
                            </div>

                            {/* Header Section — text only */}
                            <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80">
                                    <span className="text-sm font-semibold text-gray-700">Header</span>
                                    <ToggleSwitch enabled={showHeader} onChange={setShowHeader} disabled={isApproved || !!bodyMediaFile} />
                                </div>
                                <div className={`transition-all duration-300 ease-in-out ${showHeader ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                                    <div className="px-4 py-3 border-t border-gray-100">
                                        {bodyMediaFile && (
                                            <p className="text-[10px] text-amber-600 mb-2">Media attachment is set — text header will be ignored. Remove the media to use a text header.</p>
                                        )}
                                        <input
                                            type="text"
                                            value={headerText}
                                            onChange={e => setHeaderText(e.target.value)}
                                            placeholder="Enter header text"
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 outline-none transition-all text-sm"
                                            disabled={isApproved || !!bodyMediaFile}
                                            maxLength={60}
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1">Max 60 characters. Text header for your template.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Body Section — with media upload via Paperclip */}
                            <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80">
                                    <span className="text-sm font-semibold text-gray-700">Body</span>
                                    <span className="text-xs text-gray-400">Required</span>
                                </div>
                                <div className="px-4 py-3 border-t border-gray-100">
                                    <textarea
                                        ref={bodyRef}
                                        value={body}
                                        onChange={e => {
                                            setBody(e.target.value);
                                            saveCursorPosition();
                                        }}
                                        onSelect={saveCursorPosition}
                                        onBlur={saveCursorPosition}
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
                                                onClick={openVariablePanel}
                                                disabled={isApproved}
                                                className="px-2 py-1 text-xs font-mono font-bold text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Insert variable"
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
                                                onClick={handleEmojiClick}
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
                                            {/* Attachment / Media picker */}
                                            <div className="relative" ref={mediaPickerRef}>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowMediaPicker(!showMediaPicker)}
                                                    disabled={isApproved || bodyMediaUploading}
                                                    className={`p-1.5 rounded-md transition-colors disabled:opacity-50 ${bodyMediaFile ? 'text-green-600 bg-green-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                                                    title="Attach media"
                                                >
                                                    {bodyMediaUploading ? (
                                                        <Loader2 size={15} className="animate-spin" />
                                                    ) : (
                                                        <Paperclip size={15} />
                                                    )}
                                                </button>

                                                {showMediaPicker && !bodyMediaFile && (
                                                    <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-xl border border-gray-100 z-20 overflow-hidden w-48">
                                                        <div className="p-1">
                                                            {[
                                                                { key: 'IMAGE', label: 'Image', icon: Image, hint: 'JPG, PNG' },
                                                                { key: 'VIDEO', label: 'Video', icon: Film, hint: 'MP4' },
                                                                { key: 'DOCUMENT', label: 'Document', icon: FileText, hint: 'PDF' },
                                                            ].map(fmt => (
                                                                <button
                                                                    key={fmt.key}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setBodyMediaFormat(fmt.key);
                                                                        setShowMediaPicker(false);
                                                                        setTimeout(() => bodyMediaFileRef.current?.click(), 100);
                                                                    }}
                                                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                                                >
                                                                    <fmt.icon size={15} className="text-gray-400" />
                                                                    <span className="font-medium text-xs">{fmt.label}</span>
                                                                    <span className="text-[10px] text-gray-400 ml-auto">{fmt.hint}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-xs text-gray-400 tabular-nums">
                                            {body.length}<span className="text-gray-300">/</span>950
                                        </span>
                                    </div>

                                    {/* Hidden file input for body media */}
                                    <input
                                        ref={bodyMediaFileRef}
                                        type="file"
                                        accept={MEDIA_ACCEPT[bodyMediaFormat] || ''}
                                        onChange={handleBodyMediaUpload}
                                        className="hidden"
                                        disabled={isApproved || bodyMediaUploading}
                                    />

                                    {/* Uploaded media preview */}
                                    {bodyMediaFile && (
                                        <div className="mt-3 border border-gray-200 rounded-lg p-3 flex items-center gap-3 bg-gray-50/50">
                                            {bodyMediaFormat === 'IMAGE' && bodyMediaPreviewUrl ? (
                                                <img
                                                    src={bodyMediaPreviewUrl}
                                                    alt="Attachment"
                                                    className="w-14 h-14 rounded-lg object-cover border border-gray-200"
                                                />
                                            ) : (
                                                <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                                                    {bodyMediaFormat === 'VIDEO' ? <Film size={22} className="text-gray-400" /> : <FileText size={22} className="text-gray-400" />}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-gray-700 truncate">{bodyMediaFile.fileName}</p>
                                                <p className="text-[10px] text-gray-400">{(bodyMediaFile.fileSize / 1024).toFixed(1)} KB</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={removeBodyMedia}
                                                disabled={isApproved}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}

                                    {bodyMediaUploading && (
                                        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                                            <Loader2 size={14} className="animate-spin text-green-500" />
                                            Uploading media to WhatsApp...
                                        </div>
                                    )}

                                    {bodyMediaError && (
                                        <p className="text-xs text-red-500 mt-2">{bodyMediaError}</p>
                                    )}
                                </div>
                            </div>

                            {/* Footer Section */}
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

                            {/* Buttons Section */}
                            <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80">
                                    <span className="text-sm font-semibold text-gray-700">Buttons</span>
                                    <ToggleSwitch enabled={showButtons} onChange={setShowButtons} disabled={isApproved} />
                                </div>
                                <div className={`transition-all duration-300 ease-in-out ${showButtons ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
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

                                        {/* CTA Buttons Form */}
                                        {buttonType === 'call_to_action' && (
                                            <div className="space-y-3 pt-1">
                                                {ctaButtons.map((btn, idx) => (
                                                    <div key={idx} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                                                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50/60 border-b border-gray-100">
                                                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Button {idx + 1}</span>
                                                            {ctaButtons.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeCtaButton(idx)}
                                                                    disabled={isApproved}
                                                                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="p-3 space-y-2.5">
                                                            <div>
                                                                <label className="block text-[11px] font-medium text-gray-500 mb-1">Type of action</label>
                                                                <div className="flex gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateCtaButton(idx, 'actionType', 'visit_website')}
                                                                        disabled={isApproved}
                                                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-all disabled:opacity-50 ${btn.actionType === 'visit_website'
                                                                            ? 'border-green-500 bg-green-50 text-green-700'
                                                                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                                                            }`}
                                                                    >
                                                                        <Globe size={12} />
                                                                        Visit website
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateCtaButton(idx, 'actionType', 'call_phone')}
                                                                        disabled={isApproved}
                                                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-all disabled:opacity-50 ${btn.actionType === 'call_phone'
                                                                            ? 'border-green-500 bg-green-50 text-green-700'
                                                                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                                                            }`}
                                                                    >
                                                                        <PhoneCall size={12} />
                                                                        Call phone number
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[11px] font-medium text-gray-500 mb-1">Button text</label>
                                                                <input
                                                                    type="text"
                                                                    value={btn.text}
                                                                    onChange={e => updateCtaButton(idx, 'text', e.target.value)}
                                                                    placeholder={btn.actionType === 'visit_website' ? 'e.g. Visit our store' : 'e.g. Call us now'}
                                                                    className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/10 outline-none text-xs"
                                                                    disabled={isApproved}
                                                                    maxLength={25}
                                                                />
                                                            </div>
                                                            {btn.actionType === 'visit_website' && (
                                                                <>
                                                                    <div>
                                                                        <label className="block text-[11px] font-medium text-gray-500 mb-1">URL type</label>
                                                                        <select
                                                                            value={btn.urlType}
                                                                            onChange={e => updateCtaButton(idx, 'urlType', e.target.value)}
                                                                            className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 focus:border-green-500 outline-none text-xs bg-white"
                                                                            disabled={isApproved}
                                                                        >
                                                                            <option value="static">Static</option>
                                                                            <option value="dynamic">Dynamic</option>
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[11px] font-medium text-gray-500 mb-1">Website URL</label>
                                                                        <input
                                                                            type="url"
                                                                            value={btn.url}
                                                                            onChange={e => updateCtaButton(idx, 'url', e.target.value)}
                                                                            placeholder="https://example.com"
                                                                            className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/10 outline-none text-xs"
                                                                            disabled={isApproved}
                                                                        />
                                                                    </div>
                                                                </>
                                                            )}
                                                            {btn.actionType === 'call_phone' && (
                                                                <div>
                                                                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Phone number</label>
                                                                    <input
                                                                        type="tel"
                                                                        value={btn.phoneNumber}
                                                                        onChange={e => updateCtaButton(idx, 'phoneNumber', e.target.value)}
                                                                        placeholder="+1 (555) 123-4567"
                                                                        className="w-full px-2.5 py-1.5 rounded-md border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/10 outline-none text-xs"
                                                                        disabled={isApproved}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                {ctaButtons.length < 2 && (
                                                    <button
                                                        type="button"
                                                        onClick={addCtaButton}
                                                        disabled={isApproved}
                                                        className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 px-2 py-1.5 rounded-md transition-colors disabled:opacity-50"
                                                    >
                                                        <Plus size={13} />
                                                        Add another button
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Quick Reply Buttons Form */}
                                        {buttonType === 'quick_reply' && (
                                            <div className="space-y-3 pt-1">
                                                {quickReplyButtons.map((btn, idx) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={btn.text}
                                                            onChange={e => updateQuickReply(idx, e.target.value)}
                                                            placeholder={`Button ${idx + 1} text`}
                                                            className="flex-1 px-2.5 py-1.5 rounded-md border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/10 outline-none text-xs"
                                                            disabled={isApproved}
                                                            maxLength={25}
                                                        />
                                                        {quickReplyButtons.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeQuickReply(idx)}
                                                                disabled={isApproved}
                                                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {quickReplyButtons.length < 3 && (
                                                    <button
                                                        type="button"
                                                        onClick={addQuickReply}
                                                        disabled={isApproved}
                                                        className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-green-50 px-2 py-1.5 rounded-md transition-colors disabled:opacity-50"
                                                    >
                                                        <Plus size={13} />
                                                        Add another button
                                                    </button>
                                                )}
                                            </div>
                                        )}
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
                                disabled={submitting}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-white transition-all text-sm disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="templateForm"
                                disabled={isApproved || submitting}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    isEdit ? 'Save Changes' : 'Submit Template'
                                )}
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
                                    {/* Text header in preview */}
                                    {showHeader && headerText && (
                                        <div className="px-2.5 pt-2.5 pb-1">
                                            <p className="text-[13px] font-semibold text-gray-900">{headerText}</p>
                                        </div>
                                    )}
                                    {/* Media preview (from body attachment) */}
                                    {bodyMediaFormat === 'IMAGE' && bodyMediaFile && bodyMediaPreviewUrl && (
                                        <img src={bodyMediaPreviewUrl} alt="Attachment" className="w-full h-36 object-cover" />
                                    )}
                                    {bodyMediaFormat === 'VIDEO' && bodyMediaFile && (
                                        <div className="w-full h-36 bg-gray-900 flex items-center justify-center">
                                            <Film size={32} className="text-white/60" />
                                        </div>
                                    )}
                                    {bodyMediaFormat === 'DOCUMENT' && bodyMediaFile && (
                                        <div className="w-full h-24 bg-gray-100 flex items-center justify-center gap-2 border-b border-gray-200">
                                            <FileText size={20} className="text-gray-400" />
                                            <span className="text-xs text-gray-500 truncate max-w-[60%]">{bodyMediaFile.fileName}</span>
                                        </div>
                                    )}
                                    {bodyMediaFormat && !bodyMediaFile && (
                                        <div className="w-full h-28 bg-gray-100 flex items-center justify-center">
                                            <div className="text-center">
                                                <Upload size={20} className="text-gray-300 mx-auto mb-1" />
                                                <span className="text-[10px] text-gray-400">Upload {bodyMediaFormat.toLowerCase()}</span>
                                            </div>
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
                                                <div className="divide-y divide-gray-100">
                                                    {ctaButtons.map((btn, idx) => (
                                                        <div key={idx} className="flex items-center justify-center gap-1.5 py-2 text-[12px] text-[#0088cc] font-medium">
                                                            {btn.actionType === 'visit_website' ? (
                                                                <><ExternalLink size={12} /> {btn.text || 'Visit website'}</>
                                                            ) : (
                                                                <><PhoneCall size={12} /> {btn.text || 'Call phone'}</>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-gray-100">
                                                    {quickReplyButtons.map((btn, idx) => (
                                                        <div key={idx} className="text-center py-2 text-[12px] text-[#0088cc] font-medium">
                                                            {btn.text || `Button ${idx + 1}`}
                                                        </div>
                                                    ))}
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

                {/* Insert Variable Slide-Over Panel */}
                <div
                    className={`absolute top-0 right-0 h-full w-full sm:w-[380px] bg-white shadow-2xl border-l border-gray-200 z-10 flex flex-col transition-transform duration-300 ease-in-out ${showVariablePanel ? 'translate-x-0' : 'translate-x-full'}`}
                >
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <h4 className="font-bold text-gray-800 text-base">Insert variable</h4>
                        <button
                            type="button"
                            onClick={() => setShowVariablePanel(false)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        <div>
                            <h5 className="text-sm font-semibold text-gray-800 mb-1">Attributes</h5>
                            <p className="text-xs text-gray-400 mb-3">Choose the attribute that will be personalized</p>

                            <div className="relative" ref={attrDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsAttrDropdownOpen(!isAttrDropdownOpen)}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${selectedAttribute
                                        ? 'border-green-500 bg-green-50/30 text-gray-800'
                                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {selectedAttribute ? (
                                            <>
                                                <User size={14} className="text-gray-400" />
                                                <span className="text-gray-800 font-medium">{selectedAttribute.label}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${TYPE_COLORS[selectedAttribute.type]}`}>
                                                    {selectedAttribute.type}
                                                </span>
                                            </>
                                        ) : (
                                            <span>Search or type an attribute</span>
                                        )}
                                    </div>
                                    <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isAttrDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isAttrDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-20 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                                        <div className="p-2 border-b border-gray-50">
                                            <div className="relative">
                                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input
                                                    type="text"
                                                    value={variableSearch}
                                                    onChange={e => setVariableSearch(e.target.value)}
                                                    placeholder="Search attributes..."
                                                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 focus:border-green-500 outline-none text-xs"
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-52 overflow-y-auto p-1">
                                            {filteredAttributes.length === 0 ? (
                                                <div className="px-3 py-4 text-center text-xs text-gray-400">No attributes found</div>
                                            ) : (
                                                filteredAttributes.map(attr => (
                                                    <button
                                                        key={attr.key}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedAttribute(attr);
                                                            setIsAttrDropdownOpen(false);
                                                            setVariableSearch('');
                                                        }}
                                                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${selectedAttribute?.key === attr.key
                                                            ? 'bg-green-50 text-green-800'
                                                            : 'text-gray-700 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        <User size={14} className="text-gray-400 shrink-0" />
                                                        <span className="flex-1 font-medium text-xs">{attr.label}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${TYPE_COLORS[attr.type]}`}>
                                                            {attr.type}
                                                        </span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <h5 className="text-sm font-semibold text-gray-800 mb-1">Value if empty</h5>
                            <p className="text-xs text-gray-400 mb-3">
                                If the contact does not have a value for this attribute, this default will be used instead
                            </p>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={fallbackValue}
                                    onChange={e => {
                                        if (e.target.value.length <= 40) setFallbackValue(e.target.value);
                                    }}
                                    placeholder="Default value"
                                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 outline-none transition-all text-sm pr-14"
                                    maxLength={40}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 tabular-nums">
                                    {fallbackValue.length}<span className="text-gray-300">/</span>40
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 border-t border-gray-100 bg-gray-50">
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowVariablePanel(false)}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-white transition-all text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleInsertVariable}
                                disabled={!selectedAttribute}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemplateForm;
