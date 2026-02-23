import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Rocket, Plus } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import CampaignList from '../components/campaigns/CampaignList';
import CreateCampaign from '../components/campaigns/CreateCampaign';

const Campaigns = () => {
    const { token } = useContext(AuthContext);
    const navigate = useNavigate();
    const [view, setView] = useState('list');
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [renameTarget, setRenameTarget] = useState(null);
    const [renameValue, setRenameValue] = useState('');

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';
    const config = { headers: { 'x-auth-token': token } };

    const fetchCampaigns = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_URL}/campaigns`, config);
            setCampaigns(res.data);
        } catch (err) {
            console.error('Error fetching campaigns:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token && view === 'list') fetchCampaigns();
    }, [token, view]);

    const handleDelete = async (campaignId) => {
        if (!confirm('Are you sure you want to delete this campaign?')) return;
        try {
            await axios.delete(`${API_URL}/campaigns/${campaignId}`, config);
            fetchCampaigns();
        } catch (err) {
            console.error('Error deleting campaign:', err);
            alert(err.response?.data?.msg || 'Failed to delete campaign');
        }
    };

    const handleRename = (campaign) => {
        setRenameTarget(campaign);
        setRenameValue(campaign.name);
    };

    const submitRename = async () => {
        if (!renameValue.trim() || renameValue === renameTarget.name) {
            setRenameTarget(null);
            return;
        }
        try {
            await axios.put(`${API_URL}/campaigns/${renameTarget._id}`, { name: renameValue.trim() }, config);
            fetchCampaigns();
        } catch (err) {
            console.error('Error renaming campaign:', err);
            alert(err.response?.data?.msg || 'Failed to rename campaign');
        } finally {
            setRenameTarget(null);
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            {/* Rename Modal */}
            {renameTarget && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setRenameTarget(null)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Rename Campaign</h3>
                        <input
                            autoFocus
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenameTarget(null); }}
                            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
                            placeholder="Campaign name"
                        />
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setRenameTarget(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                            <button onClick={submitRename} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold transition-colors">Rename</button>
                        </div>
                    </div>
                </div>
            )}

            {view === 'list' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                <Rocket className="text-primary-600" size={28} />
                                Campaigns
                            </h1>
                            <p className="text-gray-500 mt-1">Manage and schedule your marketing messages</p>
                        </div>
                        <button
                            onClick={() => setView('create')}
                            className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-bold"
                        >
                            <Plus size={20} />
                            Create Campaign
                        </button>
                    </div>

                    <CampaignList
                        campaigns={campaigns}
                        loading={loading}
                        onCreateEndpoint={() => setView('create')}
                        onView={(id) => navigate(`/campaigns/${id}`)}
                        onEdit={(id) => navigate(`/campaigns/${id}`)}
                        onDelete={handleDelete}
                        onRename={handleRename}
                    />
                </div>
            )}

            {view === 'create' && (
                <CreateCampaign
                    onCancel={() => setView('list')}
                    onSuccess={() => {
                        setView('list');
                        fetchCampaigns();
                    }}
                />
            )}
        </div>
    );
};

export default Campaigns;
