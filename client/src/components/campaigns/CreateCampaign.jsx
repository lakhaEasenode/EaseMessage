import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { ArrowLeft, Save, Calendar, Clock, Check, Loader } from 'lucide-react';
import AuthContext from '../../context/AuthContext';
import PhoneNumberSelector from './PhoneNumberSelector';
import TemplateSelector from './TemplateSelector';
import AudienceSelector from './AudienceSelector';

const MIN_INTERVAL = parseInt(import.meta.env.VITE_MIN_INTERVAL || '10');
const MAX_INTERVAL = parseInt(import.meta.env.VITE_MAX_INTERVAL || '60');

const CreateCampaign = ({ onCancel, onSuccess }) => {
    const { token } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const [phoneNumbers, setPhoneNumbers] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [lists, setLists] = useState([]);

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

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                setLoading(true);
                const [accountsRes, listsRes] = await Promise.all([
                    axios.get(`${API_URL}/whatsapp/accounts`, config),
                    axios.get(`${API_URL}/lists`, config)
                ]);
                const allPhones = accountsRes.data.flatMap(account => account.phoneNumbers || []);
                setPhoneNumbers(allPhones);
                setLists(listsRes.data);
            } catch (err) {
                setError('Failed to load required data.');
            } finally {
                setLoading(false);
            }
        };
        if (token) fetchInitialData();
    }, [token]);

    useEffect(() => {
        if (!formData.phoneNumberId) { setTemplates([]); return; }
        const fetchTemplates = async () => {
            try {
                setLoading(true);
                const res = await axios.get(`${API_URL}/campaigns/templates/${formData.phoneNumberId}`, config);
                setTemplates(res.data);
                setFormData(prev => ({ ...prev, templateId: '' }));
            } catch (err) {
                setError('Failed to load templates for selected phone.');
            } finally {
                setLoading(false);
            }
        };
        fetchTemplates();
    }, [formData.phoneNumberId]);

    const isValid = formData.name.trim() && formData.phoneNumberId && formData.templateId && formData.listId;

    const handleSubmit = async (asDraft = false) => {
        setError(null);
        setSubmitting(true);
        try {
            const payload = { ...formData };
            if (payload.scheduledAt) {
                payload.scheduledAt = new Date(payload.scheduledAt).toISOString();
            }
            if (asDraft) payload.forceDraft = true;
            await axios.post(`${API_URL}/campaigns`, payload, config);
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to create campaign');
        } finally {
            setSubmitting(false);
        }
    };

    const handleIntervalChange = (val) => {
        const n = parseInt(val) || 0;
        setFormData(prev => ({ ...prev, sendingInterval: n }));
    };

    const intervalError = formData.sendingInterval > 0 &&
        (formData.sendingInterval < MIN_INTERVAL || formData.sendingInterval > MAX_INTERVAL);

    if (loading && phoneNumbers.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <Loader className="animate-spin text-primary-600" size={28} />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onCancel}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-xl font-bold text-gray-900">New Campaign</h2>
            </div>

            {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-xl border border-red-100 flex items-center justify-between text-sm">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="font-bold underline ml-4">Dismiss</button>
                </div>
            )}

            {/* Campaign Name */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Campaign Name</label>
                <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 outline-none transition-all text-sm"
                    placeholder="e.g. Summer Promo 2026"
                    autoFocus
                />
            </div>

            {/* Phone Number */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <PhoneNumberSelector
                    phoneNumbers={phoneNumbers}
                    selectedPhoneId={formData.phoneNumberId}
                    onSelect={(id) => setFormData({ ...formData, phoneNumberId: id })}
                />
            </div>

            {/* Template — appears after phone selected */}
            {formData.phoneNumberId && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {loading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400 py-4 justify-center">
                            <Loader size={16} className="animate-spin" /> Loading templates...
                        </div>
                    ) : (
                        <TemplateSelector
                            templates={templates}
                            selectedTemplateId={formData.templateId}
                            onSelect={(id) => setFormData({ ...formData, templateId: id })}
                        />
                    )}
                </div>
            )}

            {/* Audience — appears after template selected */}
            {formData.templateId && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <AudienceSelector
                        lists={lists}
                        selectedListId={formData.listId}
                        onSelect={(id) => setFormData({ ...formData, listId: id })}
                    />
                </div>
            )}

            {/* Scheduling */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Scheduling</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date & Time</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="datetime-local"
                                value={formData.scheduledAt}
                                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 outline-none transition-all text-sm"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Leave empty to send immediately.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Gap Between Messages
                            <span className="text-gray-400 font-normal ml-1">(0 or {MIN_INTERVAL}–{MAX_INTERVAL}s)</span>
                        </label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="number"
                                min="0"
                                max={MAX_INTERVAL}
                                value={formData.sendingInterval}
                                onChange={(e) => handleIntervalChange(e.target.value)}
                                className={`w-full pl-9 pr-3 py-2.5 rounded-lg border outline-none transition-all text-sm ${intervalError ? 'border-red-400 focus:ring-red-500/10 focus:border-red-500' : 'border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10'}`}
                                placeholder="0"
                            />
                        </div>
                        {intervalError ? (
                            <p className="text-xs text-red-500 mt-1">Must be 0 (no delay) or between {MIN_INTERVAL}–{MAX_INTERVAL} seconds.</p>
                        ) : (
                            <p className="text-xs text-gray-400 mt-1">Delay between each message to avoid rate limits.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pb-6">
                <button
                    onClick={onCancel}
                    className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                >
                    Cancel
                </button>
                <button
                    onClick={() => handleSubmit(true)}
                    disabled={!isValid || submitting || intervalError}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold transition-colors disabled:opacity-40"
                >
                    <Save size={16} />
                    Save as Draft
                </button>
                <button
                    onClick={() => handleSubmit(false)}
                    disabled={!isValid || submitting || intervalError}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold transition-colors shadow-sm disabled:opacity-40"
                >
                    {submitting ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
                    {formData.scheduledAt ? 'Schedule Campaign' : 'Create Campaign'}
                </button>
            </div>
        </div>
    );
};

export default CreateCampaign;
