import { useState, useContext, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';

const Login = () => {
    const authContext = useContext(AuthContext);
    const { login, isAuthenticated } = authContext;
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const inviteToken = searchParams.get('invite') || '';

    const [user, setUser] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');

    const { email, password } = user;

    useEffect(() => {
        if (isAuthenticated) {
            navigate(inviteToken ? `/accept-invite?token=${encodeURIComponent(inviteToken)}` : '/');
        }
    }, [inviteToken, isAuthenticated, navigate]);

    const onChange = e => setUser({ ...user, [e.target.name]: e.target.value });

    const onSubmit = async e => {
        e.preventDefault();
            setError('');

        if (email === '' || password === '') {
            setError('Please fill in all fields');
            return;
        }

        try {
            await login({ email, password });
        } catch (err) {
            if (err.response?.data?.needsVerification) {
                const inviteSuffix = inviteToken ? `&invite=${encodeURIComponent(inviteToken)}` : '';
                navigate(`/verify-otp?email=${encodeURIComponent(err.response.data.email)}${inviteSuffix}`);
                return;
            }
            const errorMsg = err.response?.data?.msg || err.message || 'Login failed';
            setError(errorMsg);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-100">
                <div className="text-center">
                    <div className="flex justify-center mb-4">
                        <BrandLogo compact />
                    </div>
                    <h2 className="mt-2 text-3xl font-extrabold text-gray-900">
                        Sign in to your account
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Or{' '}
                        <Link to={inviteToken ? `/register?invite=${encodeURIComponent(inviteToken)}` : '/register'} className="font-medium text-primary-600 hover:text-primary-500">
                            create a new account
                        </Link>
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={onSubmit}>
                    {error && <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm text-center">{error}</div>}
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <input
                                type="email"
                                name="email"
                                value={email}
                                onChange={onChange}
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                                placeholder="Email address"
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                name="password"
                                value={password}
                                onChange={onChange}
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                                placeholder="Password"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end">
                        <div className="text-sm">
                            <Link to="/forgot-password" className="font-medium text-primary-600 hover:text-primary-500">
                                Forgot your password?
                            </Link>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        >
                            Sign in
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
