import { useState } from 'react';
import { X } from 'lucide-react';

const EnterpriseRequestModal = ({ isOpen, onClose, onSubmit, loading, workspaceName }) => {
    const [note, setNote] = useState('');

    if (!isOpen) {
        return null;
    }

    const handleClose = () => {
        setNote('');
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const shouldClose = await onSubmit(note);
        if (shouldClose !== false) {
            setNote('');
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4 py-6">
            <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Request Enterprise Plan</h2>
                        <p className="text-xs text-gray-500">
                            We will notify the admin for {workspaceName || 'this workspace'}.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600 transition hover:bg-gray-200"
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 p-5">
                    <div className="rounded-2xl border border-primary-100 bg-primary-50/60 p-4 text-sm text-gray-700">
                        Send an Enterprise request to the EaseMessage admin team. They will review your workspace and contact you directly.
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wide text-gray-700">Note for admin</label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={4}
                            placeholder="Share team size, expected usage, or any special requirement."
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                        />
                    </div>

                    <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
                        >
                            {loading ? 'Sending...' : 'Send Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EnterpriseRequestModal;
