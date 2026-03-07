const KPICard = ({ title, value, change, icon: Icon, color }) => {
    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 glass-effect">
            <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-500 leading-snug line-clamp-2">{title}</p>
                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
                </div>
                <div className={`p-2 rounded-lg shrink-0 ${color}`}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
            </div>
            <div className="mt-3 flex items-center text-sm">
                <span className={change >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                    {change >= 0 ? "+" : ""}{change}%
                </span>
                <span className="text-gray-400 ml-2">vs last month</span>
            </div>
        </div>
    );
};

export default KPICard;
