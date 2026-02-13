import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { ArrowLeft, ArrowRight, Save, Calendar, Clock, Check } from 'lucide-react';
import AuthContext from '../../context/AuthContext';
import PhoneNumberSelector from './PhoneNumberSelector';
import TemplateSelector from './TemplateSelector';
import AudienceSelector from './AudienceSelector';
import CampaignSummary from './CampaignSummary';

const CreateCampaign = ({ onCancel, onSuccess }) => {
    const { token } = useContext(AuthContext);
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Data for selectors
    const [phoneNumbers, setPhoneNumbers] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [lists, setLists] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        phoneNumberId: '',
        templateId: '',
        listId: '',
        scheduledAt: '',
        sendingInterval: 0
    });

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';
    const config = { headers: { 'x-auth-token': token } };

    // Fetch Initial Data (Phones & Lists)
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                setLoading(true);
                const [accountsRes, listsRes] = await Promise.all([
                    axios.get(`${API_URL}/whatsapp/accounts`, config),
                    axios.get(`${API_URL}/lists`, config)
                ]);

                // Flatten phone numbers
                const allPhones = accountsRes.data.flatMap(account => account.phoneNumbers || []);
                setPhoneNumbers(allPhones);
                setLists(listsRes.data);
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Failed to load required data.');
            } finally {
                setLoading(false);
            }
        };

        if (token) fetchInitialData();
    }, [token]);

    // Fetch Templates when Phone changes
    useEffect(() => {
        if (formData.phoneNumberId) {
            const fetchTemplates = async () => {
                try {
                    setLoading(true);
                    const res = await axios.get(`${API_URL}/campaigns/templates/${formData.phoneNumberId}`, config);
                    setTemplates(res.data);
                    // Reset template if phone changes
                    setFormData(prev => ({ ...prev, templateId: '' }));
                } catch (err) {
                    console.error('Error fetching templates:', err);
                    setError('Failed to load templates for selected phone.');
                } finally {
                    setLoading(false);
                }
            };
            fetchTemplates();
        } else {
            setTemplates([]);
        }
    }, [formData.phoneNumberId]);

    const handleNext = () => {
        setStep(prev => prev + 1);
    };

    const handleBack = () => {
        setStep(prev => prev - 1);
    };

    const handleSubmit = async () => {
        try {
            setSubmitting(true);
            const payload = { ...formData };
            // Convert local datetime to UTC ISO string for the backend
            if (payload.scheduledAt) {
                payload.scheduledAt = new Date(payload.scheduledAt).toISOString();
            }
            await axios.post(`${API_URL}/campaigns`, payload, config);
            onSuccess();
        } catch (err) {
            console.error('Error creating campaign:', err);
            setError(err.response?.data?.msg || 'Failed to create campaign');
            setSubmitting(false);
        }
    };

    const isStepValid = () => {
        switch (step) {
            case 1:
                return (
                    formData.name.trim().length > 0 &&
                    formData.phoneNumberId !== '' &&
                    formData.templateId !== '' &&
                    formData.listId !== ''
                );
            case 2:
                // Scheduling is optional, so always valid unless logic requires future date validation
                return true;
            default:
                return false;
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-20">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between sticky top-0 z-10 bg-white/80 backdrop-blur-md py-4 border-b border-gray-100">
                <div>
                    <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2 text-sm">
                        <ArrowLeft size={16} /> Back to Campaigns
                    </button>
                    <h2 className="text-2xl font-bold text-gray-900">
                        {step === 1 ? 'Campaign Details' : 'Review & Schedule'}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`h-2 rounded-full transition-all ${step >= 1 ? 'w-8 bg-blue-600' : 'w-2 bg-gray-200'}`} />
                    <div className={`h-2 rounded-full transition-all ${step >= 2 ? 'w-8 bg-blue-600' : 'w-2 bg-gray-200'}`} />
                </div>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 mb-6 flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-sm font-bold underline">Dismiss</button>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
                {loading && step === 1 && phoneNumbers.length === 0 ? (
                    <div className="h-[400px] flex items-center justify-center">
                        <p className="animate-pulse text-gray-400 font-bold">Loading resources...</p>
                    </div>
                ) : (
                    <div className="p-8">
                        {/* STEP 1: Details */}
                        {step === 1 && (
                            <div className="space-y-12">
                                {/* Name Section */}
                                <div className="max-w-xl">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Campaign Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full text-lg px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                        placeholder="e.g. Summer Promo 2026"
                                        autoFocus
                                    />
                                </div>

                                {/* Phone Section */}
                                <div>
                                    <PhoneNumberSelector
                                        phoneNumbers={phoneNumbers}
                                        selectedPhoneId={formData.phoneNumberId}
                                        onSelect={(id) => setFormData({ ...formData, phoneNumberId: id })}
                                    />
                                </div>

                                {/* Template Section - Valid only if phone selected */}
                                {formData.phoneNumberId && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <TemplateSelector
                                            templates={templates}
                                            selectedTemplateId={formData.templateId}
                                            onSelect={(id) => setFormData({ ...formData, templateId: id })}
                                        />
                                    </div>
                                )}

                                {/* Audience Section - Valid only if template selected (optional flow, but good for progression) */}
                                {formData.templateId && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <AudienceSelector
                                            lists={lists}
                                            selectedListId={formData.listId}
                                            onSelect={(id) => setFormData({ ...formData, listId: id })}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STEP 2: Schedule & Review */}
                        {step === 2 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                <div className="space-y-8">
                                    <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                                            <Clock className="text-blue-600" size={20} />
                                            Scheduling Options
                                        </h3>

                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">Start Date & Time</label>
                                                <div className="relative">
                                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                    <input
                                                        type="datetime-local"
                                                        value={formData.scheduledAt}
                                                        onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2">Leave empty to send immediately.</p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">Gap Between Messages (Seconds)</label>
                                                <div className="relative">
                                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                                    {/* Using type="number" with min="0" */}
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={formData.sendingInterval}
                                                        onChange={(e) => setFormData({ ...formData, sendingInterval: parseInt(e.target.value) || 0 })}
                                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2">Delay between each message sent. Useful for avoiding rate limits.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-sm text-yellow-800">
                                        <strong>Note:</strong> Campaigns are processed in the background. Large lists might take some time to complete.
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-gray-800 mb-6">Campaign Summary</h3>
                                    <CampaignSummary
                                        formData={formData}
                                        selectedPhone={phoneNumbers.find(p => p._id === formData.phoneNumberId)}
                                        selectedTemplate={templates.find(t => t._id === formData.templateId)}
                                        selectedList={lists.find(l => l._id === formData.listId)}
                                        onSubmit={handleSubmit} /* Passed but handled by parent footer for consistency */
                                        submitting={submitting}
                                        hideButton={true} /* We use main footer button */
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 z-20">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    {step > 1 ? (
                        <button
                            onClick={handleBack}
                            className="px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2"
                        >
                            <ArrowLeft size={20} /> Back
                        </button>
                    ) : <div></div>}

                    {step < 2 ? (
                        <button
                            onClick={handleNext}
                            disabled={!isStepValid()}
                            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:scale-100 hover:scale-105 active:scale-95 flex items-center gap-2"
                        >
                            Next Step <ArrowRight size={20} />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {submitting ? (
                                <span className="animate-spin text-white">⏳</span>
                            ) : (
                                <Check size={20} />
                            )}
                            {formData.scheduledAt ? 'Schedule Campaign' : 'Launch Campaign'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreateCampaign;
