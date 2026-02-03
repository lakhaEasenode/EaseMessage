import { useState, useEffect } from 'react';
import { X, Eye, Info, MessageSquare } from 'lucide-react';

const TemplateForm = ({ onClose, onSubmit, initialData }) => {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('MARKETING');
    const [language, setLanguage] = useState('en_US');
    const [body, setBody] = useState('');
    const [previewBody, setPreviewBody] = useState('');

    useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setCategory(initialData.category);
            setLanguage(initialData.language);
            setBody(initialData.body);
        }
    }, [initialData]);

    // Live Preview Logic (Highlight variables)
    useEffect(() => {
        let formatted = body;
        // Replace newlines with <br/> for display
        // Identify variables {{1}} and style them
        const variableRegex = /{{(\d+)}}/g;
        // We will just render it as is, but in a real app potentially highlight nicely
        setPreviewBody(formatted);
    }, [body]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ name, category, language, body });
    };

    const isEdit = !!initialData;
    const isApproved = initialData?.status === 'APPROVED';

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

                        <form id="templateForm" onSubmit={handleSubmit} className="space-y-6">
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

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Message Body</label>
                                <textarea
                                    value={body}
                                    onChange={e => setBody(e.target.value)}
                                    placeholder="Hello {{1}}, check out our new offer!"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/10 outline-none transition-all text-sm min-h-[150px] resize-y"
                                    disabled={isApproved}
                                    required
                                />
                                <div className="flex justify-between items-center mt-1">
                                    <p className="text-[10px] text-gray-400">Use {'{{1}}'}, {'{{2}}'} etc. for variables.</p>
                                    <button
                                        type="button"
                                        onClick={() => setBody(prev => `${prev} {{${(prev.match(/{{(\d+)}}/g) || []).length + 1}}}`)}
                                        className="text-[10px] font-bold text-green-600 hover:underline bg-green-50 px-2 py-1 rounded"
                                        disabled={isApproved}
                                    >
                                        + Add Variable
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>

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

                {/* Right Side: Preview */}
                <div className="hidden lg:flex w-1/2 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat bg-gray-100 items-center justify-center p-8 relative">
                    <div className="absolute inset-0 bg-gray-200/30 backdrop-blur-[1px]"></div>

                    <div className="relative w-full max-w-sm">
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-2">
                            <div className="bg-[#008069] text-white px-4 py-3 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                    <MessageSquare size={16} />
                                </div>
                                <div>
                                    <div className="text-sm font-bold">WhatsApp Business</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#dcf8c6] rounded-lg shadow-sm p-3 relative ml-auto max-w-[90%] before:content-[''] before:absolute before:top-0 before:-right-2 before:w-0 before:h-0 before:border-[8px] before:border-transparent before:border-t-[#dcf8c6] before:border-l-[#dcf8c6]">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">
                                {previewBody || <span className="text-gray-400 italic">Your message preview will appear here...</span>}
                            </p>
                            <div className="flex justify-end items-center gap-1 mt-1 text-[10px] text-gray-500">
                                <span>12:00 PM</span>
                                <span className="text-blue-500 font-bold">✓✓</span>
                            </div>
                        </div>

                        <div className="mt-8 text-center">
                            <span className="bg-black/40 text-white/90 text-[10px] px-3 py-1.5 rounded-full backdrop-blur-md">
                                Live Preview
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemplateForm;
