import { Phone, CheckCircle } from 'lucide-react';

const PhoneNumberSelector = ({ phoneNumbers, selectedPhoneId, onSelect }) => {
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Select Sender Phone Number</h3>

            <div className="grid grid-cols-1 gap-4">
                {phoneNumbers.map((phone) => (
                    <div
                        key={phone._id}
                        onClick={() => onSelect(phone._id)}
                        className={`relative flex items-center p-4 rounded-xl border-2 transition-all cursor-pointer ${selectedPhoneId === phone._id
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-gray-100 bg-white hover:border-primary-200 hover:bg-gray-50'
                            }`}
                    >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${selectedPhoneId === phone._id ? 'bg-primary-200 text-primary-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                            <Phone size={20} />
                        </div>

                        <div className="flex-1">
                            <h4 className="font-bold text-gray-900">{phone.verifiedName || 'Unknown Name'}</h4>
                            <p className="text-sm text-gray-500 font-mono">{phone.displayPhoneNumber}</p>
                        </div>

                        {selectedPhoneId === phone._id && (
                            <div className="text-primary-600">
                                <CheckCircle size={24} fill="currentColor" className="text-white" />
                            </div>
                        )}
                    </div>
                ))}

                {phoneNumbers.length === 0 && (
                    <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-500 mb-2">No phone numbers connected.</p>
                        <p className="text-sm text-gray-400">Please connect a WhatsApp Business Account first.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PhoneNumberSelector;
