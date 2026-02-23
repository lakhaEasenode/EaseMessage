import { Rocket, Edit } from 'lucide-react';

const CampaignSummary = ({ formData, selectedPhone, selectedTemplate, selectedList, onSubmit, submitting, hideButton }) => {
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Rocket className="text-primary-600" size={24} />
                Review & Launch Campaign
            </h3>

            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 space-y-6">
                {/* Campaign Name */}
                <div className="flex justify-between items-start border-b border-gray-200 pb-4">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Campaign Name</p>
                        <h4 className="text-lg font-bold text-gray-900">{formData.name}</h4>
                    </div>
                </div>

                {/* Sender */}
                <div className="flex justify-between items-start border-b border-gray-200 pb-4">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Sender</p>
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">{selectedPhone?.verifiedName}</span>
                            <span className="text-gray-400 text-sm">({selectedPhone?.displayPhoneNumber})</span>
                        </div>
                    </div>
                </div>

                {/* Template */}
                <div className="flex justify-between items-start border-b border-gray-200 pb-4">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Message Template</p>
                        <h4 className="font-medium text-gray-800">{selectedTemplate?.name}</h4>
                        <p className="text-xs text-gray-500 mt-1 italic max-w-md line-clamp-2">
                            "{selectedTemplate?.components?.find(c => c.type === 'BODY')?.text}"
                        </p>
                    </div>
                </div>

                {/* Audience */}
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Target Audience</p>
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">{selectedList?.name}</span>
                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                {selectedList?.contactCount} Contacts
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 flex items-start gap-3">
                <div className="p-1 bg-primary-100 rounded-full text-primary-600 mt-0.5">
                    <Rocket size={16} />
                </div>
                <div>
                    <h5 className="text-sm font-bold text-primary-900">Ready to launch?</h5>
                    <p className="text-xs text-primary-700 mt-1">
                        Your campaign will be created as a Draft. You can schedule it or send it manually later from the dashboard.
                    </p>
                </div>
            </div>

            {!hideButton && (
                <button
                    onClick={onSubmit}
                    disabled={submitting}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-xl font-bold hover:scale-[1.01] active:scale-[0.99] transition-all shadow-xl shadow-primary-600/20 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                >
                    {submitting ? 'Creating Campaign...' : 'Make It Real 🚀'}
                </button>
            )}
        </div>
    );
};

export default CampaignSummary;
