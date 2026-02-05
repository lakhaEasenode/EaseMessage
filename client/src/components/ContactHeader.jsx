import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Users, List as ListIcon, Loader2 } from 'lucide-react';
import AuthContext from '../context/AuthContext';

const ContactHeader = ({ refreshKey }) => {
    const { token } = useContext(AuthContext);
    const [stats, setStats] = useState({ totalContacts: 0, totalLists: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

    const fetchStats = async () => {
        try {
            setLoading(true);
            setError(null);
            const config = { headers: { 'x-auth-token': token } };
            const res = await axios.get(`${API_URL}/stats`, config);
            setStats(res.data);
        } catch (err) {
            console.error('Error fetching stats:', err);
            setError('Failed to load statistics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchStats();
        }
    }, [token, refreshKey]);

    return (
        <div className="mb-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Contacts Overview</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                {/* Total Contacts Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3 transition-all hover:shadow-md">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                        <Users size={20} />
                    </div>
                    <div className="flex-1">
                        <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Contacts</p>
                        {loading && !stats.totalContacts ? (
                            <div className="h-6 w-12 bg-gray-100 animate-pulse rounded mt-1"></div>
                        ) : (
                            <h3 className="text-xl font-bold text-gray-900">{stats.totalContacts}</h3>
                        )}
                    </div>
                </div>

                {/* Total Lists Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3 transition-all hover:shadow-md">
                    <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                        <ListIcon size={20} />
                    </div>
                    <div className="flex-1">
                        <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Total Lists</p>
                        {loading && !stats.totalLists ? (
                            <div className="h-6 w-12 bg-gray-100 animate-pulse rounded mt-1"></div>
                        ) : (
                            <h3 className="text-xl font-bold text-gray-900">{stats.totalLists}</h3>
                        )}
                    </div>
                </div>
            </div>

            {error && (
                <p className="text-red-500 text-xs mt-2 italic px-1">{error}</p>
            )}
        </div>
    );
};

export default ContactHeader;
