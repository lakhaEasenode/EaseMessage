import { FileText, CheckCircle, AlertTriangle } from 'lucide-react';

const TemplateSelector = ({ templates, selectedTemplateId, onSelect }) => {
    // Already filtered by backend, but safe to filter again here
    const approvedTemplates = templates.filter(t => t.status === 'APPROVED');

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Select Verified Template</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
                {approvedTemplates.map((template) => (
                    <div
                        key={template._id}
                        onClick={() => onSelect(template._id)}
                        className={`relative flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer ${selectedTemplateId === template._id
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-100 bg-white hover:border-green-200 hover:bg-gray-50'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className={`p-2 rounded-lg ${selectedTemplateId === template._id ? 'bg-green-200 text-green-700' : 'bg-gray-100 text-gray-500'
                                }`}>
                                <FileText size={18} />
                            </div>
                            {selectedTemplateId === template._id && (
                                <CheckCircle size={20} className="text-green-600" fill="white" />
                            )}
                        </div>

                        <h4 className="font-bold text-gray-900 mb-1">{template.name}</h4>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold text-gray-500 uppercase bg-gray-100 px-1.5 py-0.5 rounded">
                                {template.language || 'en'}
                            </span>
                            <span className="text-xs font-bold text-gray-400 uppercase">
                                {template.category}
                            </span>
                        </div>

                        <div className="bg-white/50 p-2 rounded border border-gray-200/50 mt-auto">
                            <p className="text-xs text-gray-500 line-clamp-3 italic">
                                "{template.components?.find(c => c.type === 'BODY')?.text || 'No preview available'}"
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {approvedTemplates.length === 0 && (
                <div className="p-8 text-center bg-yellow-50 rounded-xl border border-yellow-100 flex flex-col items-center">
                    <AlertTriangle className="text-yellow-500 mb-2" size={32} />
                    <h4 className="font-bold text-yellow-800 mb-1">No Verified Templates Found</h4>
                    <p className="text-sm text-yellow-700">
                        There are no APPROVED templates associated with this phone number.
                        Please go to Templates page to create or sync templates.
                    </p>
                </div>
            )}
        </div>
    );
};

export default TemplateSelector;
