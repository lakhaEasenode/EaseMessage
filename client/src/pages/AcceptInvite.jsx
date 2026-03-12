import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, LoaderCircle, Mail, Users } from 'lucide-react';
import AuthContext from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

const AcceptInvite = () => {
    const [searchParams] = useSearchParams();
    const tokenParam = searchParams.get('token') || '';
    const navigate = useNavigate();
    const { isAuthenticated, token, refreshWorkspaces } = useContext(AuthContext);

    const [invite, setInvite] = useState(null);
    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const fetchInvitation = async () => {
            if (!tokenParam) {
                setError('Invitation link is missing.');
                setLoading(false);
                return;
            }

            try {
                const res = await axios.get(`${API_URL}/workspaces/invitations/${tokenParam}`);
                setInvite(res.data.invitation);
            } catch (err) {
                setError(err.response?.data?.msg || 'Invitation not found');
            } finally {
                setLoading(false);
            }
        };

        fetchInvitation();
    }, [tokenParam]);

    const handleAccept = async () => {
        if (!tokenParam) return;

        setAccepting(true);
        setError('');

        try {
            await axios.post(`${API_URL}/workspaces/invitations/${tokenParam}/accept`, {}, {
                headers: {
                    'x-auth-token': token
                }
            });
            await refreshWorkspaces();
            setSuccess('Invitation accepted. Redirecting to your workspace...');
            setTimeout(() => navigate('/settings'), 1500);
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to accept invitation');
        } finally {
            setAccepting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="flex items-center gap-3 text-gray-600">
                    <LoaderCircle className="animate-spin" size={20} />
                    Loading invitation...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-emerald-50 px-4 py-12">
            <div className="mx-auto max-w-xl rounded-3xl border border-gray-100 bg-white p-8 shadow-xl">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 text-primary-600">
                    {success ? <CheckCircle2 size={28} /> : <Users size={28} />}
                </div>

                <h1 className="text-2xl font-bold text-gray-900">
                    {success ? 'Invitation accepted' : 'Workspace invitation'}
                </h1>

                {invite && (
                    <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <p className="text-sm text-gray-500">You have been invited to join</p>
                        <p className="mt-1 text-lg font-semibold text-gray-900">{invite.workspace.name}</p>
                        <p className="mt-1 text-sm text-gray-600">{invite.workspace.companyName || 'No company name added yet'}</p>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-primary-100 px-3 py-1 font-semibold uppercase tracking-wide text-primary-700">
                                {invite.role}
                            </span>
                            <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">
                                Expires {new Date(invite.expiresAt).toLocaleDateString()}
                            </span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                            <Mail size={16} />
                            {invite.email}
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        {success}
                    </div>
                )}

                {!success && (
                    <div className="mt-6 space-y-3">
                        {isAuthenticated ? (
                            <button
                                onClick={handleAccept}
                                disabled={accepting}
                                className="w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
                            >
                                {accepting ? 'Accepting...' : 'Accept invitation'}
                            </button>
                        ) : (
                            <>
                                <Link
                                    to={`/login?invite=${encodeURIComponent(tokenParam)}`}
                                    className="block w-full rounded-xl bg-primary-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-primary-700"
                                >
                                    Sign in to accept
                                </Link>
                                <Link
                                    to={`/register?invite=${encodeURIComponent(tokenParam)}`}
                                    className="block w-full rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-center text-sm font-semibold text-primary-700 transition hover:bg-primary-100"
                                >
                                    Create account to accept
                                </Link>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AcceptInvite;
