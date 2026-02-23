import { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { MessageSquare, Send, Users, CheckCircle, Loader } from 'lucide-react';
import KPICard from '../components/KPICard';
import DashboardChart from '../components/DashboardChart';
import AuthContext from '../context/AuthContext';

const Dashboard = () => {
    const { token } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        kpis: {
            totalContacts: 0,
            activeCampaigns: 0,
            totalSent: 0,
            openRate: 0
        },
        chartData: [],
        recentCampaigns: []
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const config = {
                    headers: {
                        'x-auth-token': token
                    }
                };
                const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3301/api'}/dashboard`, config);
                setData(res.data);
            } catch (err) {
                console.error("Error fetching dashboard data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token]);

    const kpis = [
        { title: 'Total Messages Sent', value: data.kpis.totalSent, change: 0, icon: Send, color: 'bg-primary-500' },
        { title: 'Active Campaigns', value: data.kpis.activeCampaigns, change: 0, icon: MessageSquare, color: 'bg-purple-500' },
        { title: 'Total Contacts', value: data.kpis.totalContacts, change: 0, icon: Users, color: 'bg-orange-500' },
        { title: 'Open Rate', value: `${data.kpis.openRate}%`, change: 0, icon: CheckCircle, color: 'bg-green-500' },
    ];

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Loader className="animate-spin text-primary-600" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Dashboard Overview</h1>
                <div className="flex gap-2">
                    <button className="bg-white px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border shadow-sm">
                        Export Report
                    </button>
                    <button className="bg-primary-600 px-4 py-2 rounded-lg text-sm font-medium text-white shadow-lg shadow-primary-200">
                        Create Campaign
                    </button>
                </div>
            </div>

            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {kpis.map((kpi, index) => (
                    <KPICard key={index} {...kpi} />
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <DashboardChart data={data.chartData} />
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Campaigns</h3>
                    <div className="space-y-4">
                        {data.recentCampaigns.length === 0 ? (
                            <p className="text-gray-500 text-sm">No campaigns yet.</p>
                        ) : (
                            data.recentCampaigns.map((campaign) => (
                                <div key={campaign._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold">
                                            {campaign.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-gray-900">{campaign.name}</h4>
                                            <p className="text-xs text-gray-500">Status: {campaign.status}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${campaign.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-800'
                                        }`}>
                                        {campaign.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
