import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { X, Send, Trash2, Phone, FileText, Users, CheckCircle, Clock, AlertCircle, Play } from 'lucide-react';
import AuthContext from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

const CampaignDetail = ({ campaignId, onClose }) => {
    const { token } = useContext(AuthContext);
    const [campaign, setCampaign] = useState(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);

    const config = { headers: { 'x-auth-token': token } };

    const fetchCampaign = async () => {
        try {
            const res = await axios.get(`${API_URL}/campaigns/${campaignId}`, config);
            setCampaign(res.data);
        } catch (err) {
            console.error('Error fetching campaign:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCampaign();
    }, [campaignId]);

    // Poll for updates when campaign is running
    useEffect(() => {
        if (!campaign || campaign.status !== 'running') return;
        const interval = setInterval(fetchCampaign, 5000);
        return () => clearInterval(interval);
    }, [campaign?.status]);

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this campaign?')) return;
        try {
            setDeleting(true);
            await axios.delete(`${API_URL}/campaigns/${campaignId}`, config);
            onClose();
        } catch (err) {
            console.error('Error deleting campaign:', err);
            alert(err.response?.data?.msg || 'Failed to delete campaign');
        } finally {
            setDeleting(false);
        }
    };

    const handleStart = async () => {
        try {
            await axios.post(`${API_URL}/campaigns/${campaignId}/start`, {}, config);
            fetchCampaign();
        } catch (err) {
            console.error('Error starting campaign:', err);
            alert(err.response?.data?.msg || 'Failed to start campaign');
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            draft: 'bg-gray-100 text-gray-700 border-gray-200',
            scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
            running: 'bg-purple-50 text-purple-700 border-purple-200',
            completed: 'bg-green-50 text-green-700 border-green-200',
            failed: 'bg-red-50 text-red-700 border-red-200'
        };
        const icons = {
            draft: <FileText size={14} />,
            scheduled: <Clock size={14} />,
            running: <Send size={14} className="animate-pulse" />,
            completed: <CheckCircle size={14} />,
            failed: <AlertCircle size={14} />
        };
        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border ${styles[status] || styles.draft} uppercase tracking-wide`}>
                {icons[status] || icons.draft}
                {status}
            </span>
        );
    };

    const StatBar = ({ label, value, total, color }) => {
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
            <div className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">{label}</span>
                    <span className="font-bold text-gray-800">{value} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">Campaign Details</h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {loading ? (
                    <div className="p-12 text-center">
                        <p className="text-gray-500 animate-pulse">Loading...</p>
                    </div>
                ) : !campaign ? (
                    <div className="p-12 text-center">
                        <p className="text-gray-500">Campaign not found</p>
                    </div>
                ) : (
                    <div className="p-6 space-y-6">
                        {/* Name & Status */}
                        <div className="flex items-start justify-between">
                            <h3 className="text-xl font-bold text-gray-900">{campaign.name}</h3>
                            {getStatusBadge(campaign.status)}
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-1 gap-4">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                                    <Phone size={18} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Sender</p>
                                    <p className="text-sm font-bold text-gray-800">
                                        {campaign.phoneNumberId?.displayPhoneNumber || 'Unknown'}
                                        {campaign.phoneNumberId?.verifiedName && (
                                            <span className="text-gray-500 font-normal ml-1">({campaign.phoneNumberId.verifiedName})</span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <div className="w-9 h-9 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Template</p>
                                    <p className="text-sm font-bold text-gray-800">
                                        {campaign.templateId?.name || 'Unknown'}
                                        {campaign.templateId?.category && (
                                            <span className="text-gray-500 font-normal ml-1">({campaign.templateId.category})</span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <div className="w-9 h-9 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
                                    <Users size={18} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Audience</p>
                                    <p className="text-sm font-bold text-gray-800">
                                        {campaign.listId?.name || 'Unknown'}
                                        <span className="text-gray-500 font-normal ml-1">({campaign.listId?.contactCount || 0} contacts)</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Stats */}
                        {(campaign.stats.sent > 0 || campaign.stats.failed > 0) && (
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Stats</h4>
                                <StatBar label="Sent" value={campaign.stats.sent} total={campaign.stats.sent + campaign.stats.failed} color="bg-blue-500" />
                                <StatBar label="Delivered" value={campaign.stats.delivered} total={campaign.stats.sent} color="bg-green-500" />
                                <StatBar label="Read" value={campaign.stats.read} total={campaign.stats.sent} color="bg-emerald-500" />
                                <StatBar label="Failed" value={campaign.stats.failed} total={campaign.stats.sent + campaign.stats.failed} color="bg-red-500" />
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            {campaign.status === 'draft' && (
                                <button
                                    onClick={handleStart}
                                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold transition-colors"
                                >
                                    <Play size={18} />
                                    Start Campaign
                                </button>
                            )}
                            {['draft', 'scheduled'].includes(campaign.status) && (
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-xl font-bold transition-colors border border-red-200"
                                >
                                    <Trash2 size={18} />
                                    {deleting ? 'Deleting...' : 'Delete'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CampaignDetail;
