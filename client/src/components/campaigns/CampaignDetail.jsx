import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { X, Send, Trash2, Phone, FileText, Users, CheckCircle, Clock, AlertCircle, Play, Pause, Square, RotateCcw, Loader, XCircle, Calendar } from 'lucide-react';
import AuthContext from '../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

const CampaignDetail = ({ campaignId, onClose }) => {
    const { token } = useContext(AuthContext);
    const [campaign, setCampaign] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

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

    // Poll for updates when campaign is running or queued
    useEffect(() => {
        if (!campaign || !['running', 'queued'].includes(campaign.status)) return;
        const interval = setInterval(fetchCampaign, 3000);
        return () => clearInterval(interval);
    }, [campaign?.status]);

    const handleAction = async (action) => {
        setActionLoading(action);
        try {
            if (action === 'delete') {
                if (!confirm('Are you sure you want to delete this campaign?')) {
                    setActionLoading(null);
                    return;
                }
                await axios.delete(`${API_URL}/campaigns/${campaignId}`, config);
                onClose();
                return;
            }

            await axios.post(`${API_URL}/campaigns/${campaignId}/${action}`, {}, config);
            fetchCampaign();
        } catch (err) {
            console.error(`Error ${action} campaign:`, err);
            alert(err.response?.data?.msg || `Failed to ${action} campaign`);
        } finally {
            setActionLoading(null);
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            draft: 'bg-gray-100 text-gray-700 border-gray-200',
            scheduled: 'bg-primary-50 text-primary-700 border-primary-200',
            queued: 'bg-yellow-50 text-yellow-700 border-yellow-200',
            running: 'bg-purple-50 text-purple-700 border-purple-200',
            paused: 'bg-orange-50 text-orange-700 border-orange-200',
            completed: 'bg-green-50 text-green-700 border-green-200',
            failed: 'bg-red-50 text-red-700 border-red-200',
            cancelled: 'bg-gray-100 text-gray-500 border-gray-200'
        };
        const icons = {
            draft: <FileText size={14} />,
            scheduled: <Clock size={14} />,
            queued: <Loader size={14} className="animate-spin" />,
            running: <Send size={14} className="animate-pulse" />,
            paused: <Pause size={14} />,
            completed: <CheckCircle size={14} />,
            failed: <AlertCircle size={14} />,
            cancelled: <XCircle size={14} />
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
                    <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
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

                        {/* Progress Bar for running/queued campaigns */}
                        {['running', 'queued'].includes(campaign.status) && campaign.stats.totalToSend > 0 && (
                            <div className="bg-purple-50 rounded-xl p-4">
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="font-bold text-purple-700">Progress</span>
                                    <span className="font-bold text-purple-700">
                                        {Math.round((campaign.stats.processed / campaign.stats.totalToSend) * 100)}%
                                    </span>
                                </div>
                                <div className="w-full bg-purple-200 rounded-full h-3">
                                    <div
                                        className="h-3 rounded-full bg-purple-600 transition-all"
                                        style={{ width: `${(campaign.stats.processed / campaign.stats.totalToSend) * 100}%` }}
                                    />
                                </div>
                                <p className="text-xs text-purple-600 mt-2">
                                    {campaign.stats.processed} of {campaign.stats.totalToSend} messages processed
                                </p>
                            </div>
                        )}

                        {/* Error Message */}
                        {campaign.errorMessage && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <div className="flex items-center gap-2">
                                    <AlertCircle size={16} className="text-red-500" />
                                    <span className="text-sm font-medium text-red-700">{campaign.errorMessage}</span>
                                </div>
                            </div>
                        )}

                        {/* Info Grid */}
                        <div className="grid grid-cols-1 gap-4">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <div className="w-9 h-9 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center">
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
                                    {campaign.stats.skippedOptOut > 0 && (
                                        <p className="text-xs text-orange-500 mt-0.5">
                                            {campaign.stats.skippedOptOut} contacts skipped (not opted in)
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Timestamps */}
                        {(campaign.startedAt || campaign.completedAt) && (
                            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                                {campaign.startedAt && (
                                    <span className="flex items-center gap-1">
                                        <Calendar size={12} />
                                        Started: {new Date(campaign.startedAt).toLocaleString()}
                                    </span>
                                )}
                                {campaign.completedAt && (
                                    <span className="flex items-center gap-1">
                                        <CheckCircle size={12} />
                                        Completed: {new Date(campaign.completedAt).toLocaleString()}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Stats */}
                        {(campaign.stats.sent > 0 || campaign.stats.failed > 0 || campaign.stats.totalToSend > 0) && (
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Stats</h4>
                                <StatBar
                                    label="Sent"
                                    value={campaign.stats.sent}
                                    total={campaign.stats.totalToSend || (campaign.stats.sent + campaign.stats.failed)}
                                    color="bg-primary-500"
                                />
                                <StatBar
                                    label="Delivered"
                                    value={campaign.stats.delivered}
                                    total={campaign.stats.sent}
                                    color="bg-green-500"
                                />
                                <StatBar
                                    label="Read"
                                    value={campaign.stats.read}
                                    total={campaign.stats.sent}
                                    color="bg-emerald-500"
                                />
                                {campaign.stats.failed > 0 && (
                                    <StatBar
                                        label="Failed"
                                        value={campaign.stats.failed}
                                        total={campaign.stats.totalToSend || (campaign.stats.sent + campaign.stats.failed)}
                                        color="bg-red-500"
                                    />
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-3 pt-2">
                            {/* Start — only for draft campaigns */}
                            {campaign.status === 'draft' && (
                                <button
                                    onClick={() => handleAction('start')}
                                    disabled={actionLoading}
                                    className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl font-bold transition-colors disabled:opacity-50"
                                >
                                    {actionLoading === 'start' ? <Loader size={18} className="animate-spin" /> : <Play size={18} />}
                                    Start Campaign
                                </button>
                            )}

                            {/* Pause — only for running campaigns */}
                            {campaign.status === 'running' && (
                                <button
                                    onClick={() => handleAction('pause')}
                                    disabled={actionLoading}
                                    className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-bold transition-colors disabled:opacity-50"
                                >
                                    {actionLoading === 'pause' ? <Loader size={18} className="animate-spin" /> : <Pause size={18} />}
                                    Pause
                                </button>
                            )}

                            {/* Resume — only for paused campaigns */}
                            {campaign.status === 'paused' && (
                                <button
                                    onClick={() => handleAction('resume')}
                                    disabled={actionLoading}
                                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-bold transition-colors disabled:opacity-50"
                                >
                                    {actionLoading === 'resume' ? <Loader size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                                    Resume
                                </button>
                            )}

                            {/* Cancel — for running, paused, or queued campaigns */}
                            {['running', 'paused', 'queued'].includes(campaign.status) && (
                                <button
                                    onClick={() => handleAction('cancel')}
                                    disabled={actionLoading}
                                    className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-xl font-bold transition-colors border border-red-200 disabled:opacity-50"
                                >
                                    {actionLoading === 'cancel' ? <Loader size={18} className="animate-spin" /> : <Square size={18} />}
                                    Cancel
                                </button>
                            )}

                            {/* Delete — only for draft or scheduled */}
                            {['draft', 'scheduled'].includes(campaign.status) && (
                                <button
                                    onClick={() => handleAction('delete')}
                                    disabled={actionLoading}
                                    className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-xl font-bold transition-colors border border-red-200 disabled:opacity-50"
                                >
                                    {actionLoading === 'delete' ? <Loader size={18} className="animate-spin" /> : <Trash2 size={18} />}
                                    Delete
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
