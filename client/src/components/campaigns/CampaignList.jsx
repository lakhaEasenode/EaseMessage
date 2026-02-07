import { useState } from 'react';
import { Plus, Eye, Calendar, CheckCircle, Clock, AlertCircle, FileText, Send, User } from 'lucide-react';

const CampaignList = ({ campaigns, loading, onCreateEndpoint, onView }) => {

    const getStatusBadge = (status) => {
        const styles = {
            draft: 'bg-gray-100 text-gray-700 border-gray-200',
            scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
            running: 'bg-purple-50 text-purple-700 border-purple-200',
            completed: 'bg-green-50 text-green-700 border-green-200',
            failed: 'bg-red-50 text-red-700 border-red-200'
        };

        const icons = {
            draft: <FileText size={12} />,
            scheduled: <Clock size={12} />,
            running: <Send size={12} />,
            completed: <CheckCircle size={12} />,
            failed: <AlertCircle size={12} />
        };

        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${styles[status] || styles.draft} uppercase tracking-wide`}>
                {icons[status] || icons.draft}
                {status}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center min-h-[400px] flex items-center justify-center">
                <p className="text-gray-500 font-medium animate-pulse">Loading campaigns...</p>
            </div>
        );
    }

    if (campaigns.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                    <Send size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Campaigns Yet</h3>
                <p className="text-gray-500 max-w-sm mb-8">Create your first marketing campaign to get started reaching your customers efficiently.</p>
                <button
                    onClick={onCreateEndpoint}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 hover:scale-105 active:scale-95"
                >
                    <Plus size={20} />
                    Create Campaign
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50/50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Campaign Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Audience</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Stats</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {campaigns.map((campaign) => (
                            <tr key={campaign._id} className="hover:bg-blue-50/30 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-800 text-sm mb-1">{campaign.name}</span>
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                            <Calendar size={12} />
                                            {new Date(campaign.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {getStatusBadge(campaign.status)}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold">{campaign.listId?.name || 'Unknown List'}</span>
                                        <span className="text-xs text-gray-400">({campaign.listId?.contactCount || 0} contacts)</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {campaign.stats ? (
                                        <div className="flex items-center gap-3 text-xs">
                                            <div className="flex flex-col items-center">
                                                <span className="font-bold text-gray-800">{campaign.stats.sent}</span>
                                                <span className="text-gray-400 text-[10px] uppercase">Sent</span>
                                            </div>
                                            <div className="w-px h-6 bg-gray-100"></div>
                                            <div className="flex flex-col items-center">
                                                <span className="font-bold text-green-600">{campaign.stats.read}</span>
                                                <span className="text-gray-400 text-[10px] uppercase">Read</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-400">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => onView(campaign._id)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <Eye size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CampaignList;
