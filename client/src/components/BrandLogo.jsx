const BrandLogo = ({ compact = false, className = '', textClassName = '' }) => {
    return (
        <div className={`flex items-center gap-3 ${className}`}>
            <img
                src="/easemsg-favicon.svg"
                alt="EaseMessage"
                className={compact ? 'h-8 w-8 rounded-lg' : 'h-12 w-12 rounded-xl'}
            />
            {!compact && (
                <span className={`text-2xl font-bold text-gray-800 ${textClassName}`}>
                    EaseMessage
                </span>
            )}
        </div>
    );
};

export default BrandLogo;
