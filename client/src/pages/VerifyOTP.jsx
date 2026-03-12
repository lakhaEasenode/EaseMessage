import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { MessageSquare, CheckCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

const VerifyOTP = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const email = searchParams.get('email') || '';
    const inviteToken = searchParams.get('invite') || '';

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const inputRefs = useRef([]);

    useEffect(() => {
        if (!email) {
            navigate('/register');
        }
        // Start with 60s cooldown
        setResendCooldown(60);
    }, [email, navigate]);

    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    const handleChange = (index, value) => {
        if (value.length > 1) {
            // Handle paste
            const digits = value.replace(/\D/g, '').slice(0, 6).split('');
            const newOtp = [...otp];
            digits.forEach((digit, i) => {
                if (index + i < 6) newOtp[index + i] = digit;
            });
            setOtp(newOtp);
            const focusIndex = Math.min(index + digits.length, 5);
            inputRefs.current[focusIndex]?.focus();
            return;
        }

        if (value && !/^\d$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        const otpString = otp.join('');

        if (otpString.length !== 6) {
            setError('Please enter the complete 6-digit OTP');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await axios.post(`${API_URL}/auth/verify-otp`, { email, otp: otpString });
            setSuccess(res.data.msg);
            const loginPath = inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : '/login';
            setTimeout(() => navigate(loginPath), 2000);
        } catch (err) {
            setError(err.response?.data?.msg || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0) return;

        setError('');
        try {
            const res = await axios.post(`${API_URL}/auth/resend-otp`, { email });
            setSuccess(res.data.msg);
            setResendCooldown(60);
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to resend OTP');
        }
    };

    if (success && success.includes('verified')) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
                <div className="max-w-md w-full bg-white p-10 rounded-xl shadow-lg border border-gray-100 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle size={32} className="text-green-600" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
                    <p className="text-gray-600 mb-4">Your account has been verified successfully.</p>
                    <p className="text-sm text-gray-500">Redirecting to login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-100">
                <div className="text-center">
                    <div className="flex justify-center mb-4">
                        <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold">
                            <MessageSquare size={24} />
                        </div>
                    </div>
                    <h2 className="mt-2 text-2xl font-extrabold text-gray-900">
                        Verify your email
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        We've sent a 6-digit code to
                    </p>
                    <p className="text-sm font-semibold text-primary-600">{email}</p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleVerify}>
                    {error && (
                        <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm text-center">
                            {error}
                        </div>
                    )}
                    {success && !success.includes('verified') && (
                        <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm text-center">
                            {success}
                        </div>
                    )}

                    <div className="flex justify-center gap-2 sm:gap-3">
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => (inputRefs.current[index] = el)}
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={6}
                                value={digit}
                                onChange={(e) => handleChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-all"
                                autoFocus={index === 0}
                            />
                        ))}
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? 'Verifying...' : 'Verify Email'}
                        </button>
                    </div>

                    <div className="text-center space-y-3">
                        <p className="text-sm text-gray-500">
                            Didn't receive the code?{' '}
                            {resendCooldown > 0 ? (
                                <span className="text-gray-400">
                                    Resend in {resendCooldown}s
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleResend}
                                    className="font-medium text-primary-600 hover:text-primary-500 inline-flex items-center gap-1"
                                >
                                    <RefreshCw size={14} />
                                    Resend OTP
                                </button>
                            )}
                        </p>
                        <p className="text-sm">
                            <Link to={inviteToken ? `/register?invite=${encodeURIComponent(inviteToken)}` : '/register'} className="font-medium text-gray-500 hover:text-gray-700">
                                ← Back to Register
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VerifyOTP;
