import { useState } from 'react';
import { Plus, Calendar, CheckCircle, Clock, AlertCircle, FileText, Send, Pause, XCircle, Loader, MoreVertical, Trash2, Edit2, Eye, PenLine, Copy } from 'lucide-react';

const CampaignList = ({ campaigns, loading, onCreateEndpoint, onView, onEdit, onDelete, onRename }) => {
    const [openMenu, setOpenMenu] = useState(null);

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
            draft: <FileText size={12} />,
            scheduled: <Clock size={12} />,
            queued: <Loader size={12} className="animate-spin" />,
            running: <Send size={12} className="animate-pulse" />,
            paused: <Pause size={12} />,
            completed: <CheckCircle size={12} />,
            failed: <AlertCircle size={12} />,
            cancelled: <XCircle size={12} />
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
                <div className="w-16 h-16 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center mb-4">
                    <Send size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Campaigns Yet</h3>
                <p className="text-gray-500 max-w-sm mb-8">Create your first marketing campaign to get started reaching your customers efficiently.</p>
                <button
                    onClick={onCreateEndpoint}
                    className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary-600/20 hover:scale-105 active:scale-95"
                >
                    <Plus size={20} />
                    Create Campaign
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {openMenu && <div className="fixed inset-0 z-[5]" onClick={() => setOpenMenu(null)} />}
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50/50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Campaign Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Audience</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Sent</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Delivered</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Failed</th>
                            <th className="px-4 py-4 w-12"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {campaigns.map((campaign) => {
                            const stats = campaign.stats || {};
                            const isEditable = ['draft', 'scheduled'].includes(campaign.status);

                            return (
                                <tr
                                    key={campaign._id}
                                    className="hover:bg-primary-50/30 transition-colors cursor-pointer group"
                                    onClick={() => onView(campaign._id)}
                                >
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
                                            <span className="text-xs text-gray-400">({campaign.listId?.contactCount || 0})</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-bold text-gray-700">{stats.sent ?? 0}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-bold text-green-600">{stats.delivered ?? 0}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-bold text-red-500">{stats.failed ?? 0}</span>
                                    </td>
                                    <td className="px-4 py-4 relative z-10" onClick={e => e.stopPropagation()}>
                                        <div className="relative">
                                            <button
                                                onClick={() => setOpenMenu(openMenu === campaign._id ? null : campaign._id)}
                                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                <MoreVertical size={18} />
                                            </button>
                                            {openMenu === campaign._id && (
                                                <div className="absolute right-0 top-8 bg-white shadow-xl rounded-xl border border-gray-100 z-20 w-44 py-1 overflow-hidden">
                                                    <button
                                                        onClick={() => { onRename(campaign); setOpenMenu(null); }}
                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                                    >
                                                        <PenLine size={15} />
                                                        Rename
                                                    </button>
                                                    <button
                                                        onClick={() => { isEditable ? onEdit(campaign._id) : onView(campaign._id); setOpenMenu(null); }}
                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                                    >
                                                        {isEditable ? <Edit2 size={15} /> : <Eye size={15} />}
                                                        {isEditable ? 'Edit' : 'View'}
                                                    </button>
                                                    <div className="h-px bg-gray-100 my-1" />
                                                    <button
                                                        onClick={() => { onDelete(campaign._id); setOpenMenu(null); }}
                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                                    >
                                                        <Trash2 size={15} />
                                                        Delete
                                                    </button>
                                                    <button
                                                        disabled
                                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 cursor-not-allowed"
                                                    >
                                                        <Copy size={15} />
                                                        Duplicate
                                                        <span className="ml-auto text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-medium">v2</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CampaignList;
