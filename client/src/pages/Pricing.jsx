import React, { useState, useContext, useEffect } from 'react';
import { Check } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import axios from 'axios';
import { getCountryName } from '../data/countries';
import EnterpriseRequestModal from '../components/EnterpriseRequestModal';

const Pricing = () => {
    const { user, token, loadUser } = useContext(AuthContext);
    const [billingCycle, setBillingCycle] = useState('monthly');
    const [loadingPlan, setLoadingPlan] = useState(null);
    const [plans, setPlans] = useState([]);
    const [enterpriseModalOpen, setEnterpriseModalOpen] = useState(false);
    const [enterpriseLoading, setEnterpriseLoading] = useState(false);
    const currentBilling = user?.currentWorkspace?.billing || user?.billing;
    const currentPlan = currentBilling?.plan || 'Free';
    const currentCredits = currentBilling?.contactLimit ?? 100;
    const workspaceCountry = user?.currentWorkspace?.countryCode || 'IN';
    const isINRWorkspace = workspaceCountry === 'IN';
    const workspaceName = user?.currentWorkspace?.name || 'this workspace';
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

    useEffect(() => {
        // Look for Stripe success/canceled return URLs
        const query = new URLSearchParams(window.location.search);
        if (query.get('success')) {
            alert('Subscription successful! You will receive an email confirmation.');
            loadUser();
            // Remove query params
            window.history.replaceState(null, '', window.location.pathname);
        }
        if (query.get('canceled')) {
            alert('Checkout canceled. Your subscription was not processed.');
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, [loadUser]);

    useEffect(() => {
        if (!token) return;

        const fetchPlans = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3301/api'}/billing/plans`, {
                    headers: { 'x-auth-token': token }
                });
                setPlans(res.data?.plans || []);
            } catch (err) {
                console.error('Failed to load billing plans', err);
            }
        };

        fetchPlans();
    }, [token]);

    const handleEnterpriseRequest = async (note) => {
        if (!token) {
            alert('Please login to continue');
            return false;
        }

        setEnterpriseLoading(true);
        try {
            await axios.post(`${apiUrl}/billing/enterprise-request`, { note }, {
                headers: { 'x-auth-token': token }
            });
            alert('Enterprise request sent. Our team will contact you.');
            return true;
        } catch (err) {
            alert(err.response?.data?.msg || 'Failed to send enterprise request. Please try again.');
            return false;
        } finally {
            setEnterpriseLoading(false);
        }
    };

    const handleSubscribe = async (plan) => {
        if (!user) {
            alert('Please login to subscribe');
            return;
        }

        if (plan.name === 'Free') {
            return;
        }

        setLoadingPlan(plan.name);

        const config = {
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            }
        };

        try {
            if (isINRWorkspace && currentBilling?.stripeSubscriptionId) {
                const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3301/api'}/billing/india/change-plan`, { planName: plan.name, billingCycle }, config);
                await loadUser();
                if (res.data?.paymentUrl) {
                    window.open(res.data.paymentUrl, '_blank', 'noopener,noreferrer');
                } else {
                    alert('Plan updated. No immediate payment is due right now.');
                }
            } else {
                const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3301/api'}/billing/checkout/stripe-subscription`, { planName: plan.name, billingCycle }, config);
                if (res.data?.url) {
                    window.location.href = res.data.url;
                } else if (res.data?.paymentUrl) {
                    await loadUser();
                    window.open(res.data.paymentUrl, '_blank', 'noopener,noreferrer');
                } else {
                    await loadUser();
                }
            }
        } catch (err) {
            console.error('Subscription error:', err);
            alert(err.response?.data?.msg || 'Failed to initiate subscription checkout. Please try again.');
        } finally {
            setLoadingPlan(null);
        }
    };

    return (
        <div className="py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-4xl text-center">
                    <h2 className="text-base font-semibold leading-7 text-indigo-600">Pricing</h2>
                    <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                        Pricing plans for teams of all sizes
                    </p>
                    <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-3 text-sm">
                        <span className="font-semibold text-indigo-700">
                            Current plan: {currentPlan}
                        </span>
                        <span className="hidden sm:inline text-indigo-300">|</span>
                        <span className="font-medium text-gray-700">
                            Credits: {currentCredits.toLocaleString()}
                        </span>
                    </div>
                </div>
                
                {/* Billing Cycle Toggle */}
                <div className="mt-16 flex justify-center">
                    <div className="flex items-center gap-x-4">
                        <span className={`text-sm font-semibold ${billingCycle === 'monthly' ? 'text-indigo-600' : 'text-gray-500'}`}>Monthly</span>
                        <button
                            type="button"
                            className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                            role="switch"
                            aria-checked="false"
                            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                        >
                            <span
                                aria-hidden="true"
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${billingCycle === 'yearly' ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                        <span className={`text-sm font-semibold ${billingCycle === 'yearly' ? 'text-indigo-600' : 'text-gray-500'}`}>Yearly <span className="text-xs text-green-500 ml-1">(Save ~16%)</span></span>
                    </div>
                </div>

                <div className="mt-6 flex justify-center">
                    <div className="inline-flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
                        <span className="text-sm text-gray-500">Workspace country:</span>
                        <span className="text-sm font-semibold text-gray-900">{getCountryName(workspaceCountry)}</span>
                        <span className="hidden sm:inline text-gray-300">|</span>
                        <span className="text-sm font-semibold text-indigo-700">
                            Billing currency: {isINRWorkspace ? 'INR' : 'USD'}
                        </span>
                    </div>
                </div>

                {isINRWorkspace && (
                    <div className="mt-6 flex justify-center">
                        <div className="max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                            India workspaces use Stripe for subscription management and Razorpay payment links for invoice collection. Upgrades create a prorated invoice and payment link when money is due.
                        </div>
                    </div>
                )}

                <div className="isolate mx-auto mt-10 grid max-w-md grid-cols-1 gap-8 md:max-w-7xl md:grid-cols-4">
                    {plans.map((plan) => {
                        const isINR = isINRWorkspace;
                        const currencySymbol = isINR ? '₹' : '$';
                        const price = isINR ? plan.prices?.inr?.[billingCycle]?.amount : plan.prices?.usd?.[billingCycle]?.amount;
                        const isEnterprise = plan.name === 'Enterprise';
                        
                        return (
                            <div
                                key={plan.name}
                                className={`rounded-3xl p-8 ring-1 xl:p-10 ${plan.key === 'Growth' ? 'bg-gray-900 ring-gray-900' : 'ring-gray-200'}`}
                            >
                                <h3 id={plan.name} className={`text-lg font-semibold leading-8 ${plan.key === 'Growth' ? 'text-white' : 'text-gray-900'}`}>
                                    {plan.name}
                                </h3>
                                <p className={`mt-4 text-sm leading-6 ${plan.key === 'Growth' ? 'text-gray-300' : 'text-gray-500'}`}>
                                    Ideal for up to {plan.contactLimit.toLocaleString()} contacts.
                                </p>
                                <p className="mt-6 flex items-baseline gap-x-1">
                                    <span className={`text-4xl font-bold tracking-tight ${plan.key === 'Growth' ? 'text-white' : 'text-gray-900'}`}>
                                        {currencySymbol}{price}
                                    </span>
                                    <span className={`text-sm font-semibold leading-6 ${plan.key === 'Growth' ? 'text-gray-300' : 'text-gray-600'}`}>
                                        /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                                    </span>
                                </p>
                                {isEnterprise ? (
                                    <button
                                        type="button"
                                        onClick={() => setEnterpriseModalOpen(true)}
                                        className={`mt-6 block w-full rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 ${
                                            plan.key === 'Growth'
                                                ? 'bg-white text-gray-900 hover:bg-gray-100'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-500'
                                        }`}
                                    >
                                        Contact Us
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleSubscribe(plan)}
                                        disabled={loadingPlan === plan.name || currentPlan === plan.name}
                                        className={`mt-6 block w-full rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                                            plan.key === 'Growth'
                                                ? 'bg-white text-gray-900 hover:bg-gray-100 focus-visible:outline-white'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600'
                                        } ${currentPlan === plan.name ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {loadingPlan === plan.name ? 'Processing...' : currentPlan === plan.name ? 'Current Plan' : (plan.name === 'Free' ? 'Get Started' : currentPlan === 'Free' ? 'Buy Plan' : 'Upgrade Plan')}
                                    </button>
                                )}
                                <ul role="list" className={`mt-8 space-y-3 text-sm leading-6 ${plan.key === 'Growth' ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex gap-x-3">
                                            <Check className={`h-6 w-5 flex-none ${plan.key === 'Growth' ? 'text-indigo-400' : 'text-indigo-600'}`} aria-hidden="true" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>

                {/* Enterprise Section */}
                <div className="mx-auto mt-20 max-w-4xl rounded-3xl bg-gray-50 px-6 py-10 sm:py-16 lg:flex lg:items-center lg:p-20">
                    <div className="lg:w-0 lg:flex-1">
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Enterprise</h2>
                        <p className="mt-4 text-lg text-gray-600">
                            Need more than 100,000 contacts? Get a custom tailored solution with dedicated support and volume pricing.
                        </p>
                    </div>
                    <div className="mt-10 lg:ml-8 lg:mt-0 flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => setEnterpriseModalOpen(true)}
                            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-5 py-3 text-base font-medium text-white hover:bg-indigo-700"
                        >
                            Contact Us
                        </button>
                    </div>
                </div>
            </div>

            <EnterpriseRequestModal
                isOpen={enterpriseModalOpen}
                onClose={() => setEnterpriseModalOpen(false)}
                onSubmit={handleEnterpriseRequest}
                loading={enterpriseLoading}
                workspaceName={workspaceName}
            />
        </div>
    );
};

export default Pricing;
