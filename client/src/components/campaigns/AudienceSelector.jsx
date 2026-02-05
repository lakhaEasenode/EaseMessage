import { Users, CheckCircle } from 'lucide-react';

const AudienceSelector = ({ lists, selectedListId, onSelect }) => {
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Select Target Audience</h3>

            <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2">
                {lists.map((list) => (
                    <div
                        key={list._id}
                        onClick={() => onSelect(list._id)}
                        className={`group relative flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${selectedListId === list._id
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-gray-100 bg-white hover:border-purple-200 hover:bg-gray-50'
                            }`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-2.5 rounded-lg ${selectedListId === list._id ? 'bg-purple-200 text-purple-700' : 'bg-purple-50 text-purple-400 group-hover:bg-purple-100 group-hover:text-purple-600'
                                }`}>
                                <Users size={20} />
                            </div>

                            <div>
                                <h4 className="font-bold text-gray-900">{list.name}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs font-bold text-purple-600 bg-white px-2 py-0.5 rounded-full border border-purple-100 shadow-sm">
                                        {list.contactCount} Contacts
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        Created {new Date(list.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {selectedListId === list._id && (
                            <div className="text-purple-600">
                                <CheckCircle size={24} fill="white" />
                            </div>
                        )}
                    </div>
                ))}

                {lists.length === 0 && (
                    <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <Users className="text-gray-400 mx-auto mb-2" size={32} />
                        <p className="text-gray-500 font-medium">No contact lists found.</p>
                        <p className="text-sm text-gray-400 mt-1">Please create a list in the Contacts page first.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AudienceSelector;
