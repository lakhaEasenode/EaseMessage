import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Smartphone, CheckCircle, ShieldCheck, AlertTriangle } from 'lucide-react';

const COLORS = ['#22c55e', '#eab308', '#ef4444', '#9ca3af']; // Green, Yellow, Red, Gray
const VERIFY_COLORS = ['#3b82f6', '#d1d5db', '#8b5cf6']; // Blue, Gray, Purple

const WhatsAppHeader = ({ accounts }) => {

    // Calculate Stats
    const stats = useMemo(() => {
        let totalNumbers = 0;
        let qualityCounts = { GREEN: 0, YELLOW: 0, RED: 0, UNKNOWN: 0 };
        let verifyCounts = { VERIFIED: 0, NOT_VERIFIED: 0, UNKNOWN: 0 };

        accounts.forEach(acc => {
            acc.phoneNumbers.forEach(num => {
                totalNumbers++;

                // Quality
                const quality = num.qualityRating || 'UNKNOWN';
                qualityCounts[quality] = (qualityCounts[quality] || 0) + 1;

                // Verification
                const status = num.codeVerificationStatus || 'UNKNOWN';
                verifyCounts[status] = (verifyCounts[status] || 0) + 1;
            });
        });

        // Format for Recharts
        const qualityData = Object.keys(qualityCounts)
            .filter(key => qualityCounts[key] > 0)
            .map(key => ({ name: key, value: qualityCounts[key] }));

        const verifyData = Object.keys(verifyCounts)
            .filter(key => verifyCounts[key] > 0)
            .map(key => ({ name: key, value: verifyCounts[key] }));

        return { totalNumbers, qualityData, verifyData };
    }, [accounts]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">

            {/* KPI 1: Total Accounts */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between h-32">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Accounts</p>
                        <h2 className="text-3xl font-bold text-gray-800 mt-2">{accounts.length}</h2>
                    </div>
                    <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                        <Smartphone size={20} />
                    </div>
                </div>
            </div>

            {/* KPI 2: Total Phone Numbers */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between h-32">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Phone Numbers</p>
                        <h2 className="text-3xl font-bold text-gray-800 mt-2">{stats.totalNumbers}</h2>
                    </div>
                    <div className="w-10 h-10 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center">
                        <CheckCircle size={20} />
                    </div>
                </div>
            </div>

            {/* Chart 1: Quality Rating */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 h-32 flex items-center">
                <div className="w-full h-full flex items-center">
                    <div className="w-1/2 h-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.qualityData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={25}
                                    outerRadius={40}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.qualityData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="w-1/2 pl-2">
                        <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
                            <ShieldCheck size={12} /> Quality
                        </p>
                        <div className="space-y-1">
                            {stats.qualityData.slice(0, 3).map((entry, index) => (
                                <div key={entry.name} className="flex items-center justify-between text-[10px] text-gray-500">
                                    <span className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                        {entry.name}
                                    </span>
                                    <span className="font-bold">{entry.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart 2: Verification Status */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 h-32 flex items-center">
                <div className="w-full h-full flex items-center">
                    <div className="w-1/2 h-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.verifyData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={25}
                                    outerRadius={40}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.verifyData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={VERIFY_COLORS[index % VERIFY_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="w-1/2 pl-2">
                        <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
                            <AlertTriangle size={12} /> Status
                        </p>
                        <div className="space-y-1">
                            {stats.verifyData.slice(0, 3).map((entry, index) => (
                                <div key={entry.name} className="flex items-center justify-between text-[10px] text-gray-500">
                                    <span className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: VERIFY_COLORS[index % VERIFY_COLORS.length] }}></div>
                                        {entry.name}
                                    </span>
                                    <span className="font-bold">{entry.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppHeader;
