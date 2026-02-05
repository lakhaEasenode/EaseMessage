import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Rocket, Plus } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import CampaignList from '../components/campaigns/CampaignList';
import CreateCampaign from '../components/campaigns/CreateCampaign';

const Campaigns = () => {
    const { token } = useContext(AuthContext);
    const [view, setView] = useState('list'); // 'list' | 'create'
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(false);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

    const fetchCampaigns = async () => {
        try {
            setLoading(true);
            const config = { headers: { 'x-auth-token': token } };
            const res = await axios.get(`${API_URL}/campaigns`, config);
            setCampaigns(res.data);
        } catch (err) {
            console.error('Error fetching campaigns:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token && view === 'list') {
            fetchCampaigns();
        }
    }, [token, view]);

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {view === 'list' && (
                <>
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                <Rocket className="text-blue-600" size={28} />
                                Campaigns
                            </h1>
                            <p className="text-gray-500 mt-1">Manage and schedule your marketing messages</p>
                        </div>
                        <button
                            onClick={() => setView('create')}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-bold"
                        >
                            <Plus size={20} />
                            Create Campaign
                        </button>
                    </div>

                    <CampaignList
                        campaigns={campaigns}
                        loading={loading}
                        onCreateEndpoint={() => setView('create')}
                    />
                </>
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
