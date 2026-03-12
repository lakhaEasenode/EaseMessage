import React, { useState, useContext, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import axios from 'axios';

const Pricing = () => {
    const { user, token } = useContext(AuthContext);
    const [billingCycle, setBillingCycle] = useState('monthly');
    const [country, setCountry] = useState('US'); // 'IN' for Razorpay, others for Stripe
    const [loadingPlan, setLoadingPlan] = useState(null);

    // Dynamically load Razorpay script
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        return () => {
            document.body.removeChild(script);
        };
    }, []);

    useEffect(() => {
        // Look for Stripe success/canceled return URLs
        const query = new URLSearchParams(window.location.search);
        if (query.get('success')) {
            alert('Subscription successful! You will receive an email confirmation.');
            // Remove query params
            window.history.replaceState(null, '', window.location.pathname);
        }
        if (query.get('canceled')) {
            alert('Checkout canceled. Your subscription was not processed.');
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, []);

    const plans = [
        {
            name: 'Free',
            priceINR: { monthly: 0, yearly: 0 },
            priceUSD: { monthly: 0, yearly: 0 },
            stripePriceId: { monthly: 'price_free_monthly', yearly: 'price_free_yearly' },
            razorpayPlanId: { monthly: 'plan_free_monthly', yearly: 'plan_free_yearly' },
            contactLimit: 100,
            features: ['Up to 100 contacts', 'Basic messaging', 'Standard support'],
        },
        {
            name: 'Starter',
            priceINR: { monthly: 2900, yearly: 29000 },
            priceUSD: { monthly: 29, yearly: 290 },
            stripePriceId: { monthly: 'price_starter_monthly_usd', yearly: 'price_starter_yearly_usd' },
            razorpayPlanId: { monthly: 'plan_starter_monthly_inr', yearly: 'plan_starter_yearly_inr' },
            contactLimit: 1000,
            features: ['Up to 1,000 contacts', 'Advanced messaging', 'Priority support'],
        },
        {
            name: 'Growth',
            priceINR: { monthly: 4900, yearly: 49000 },
            priceUSD: { monthly: 49, yearly: 490 },
            stripePriceId: { monthly: 'price_growth_monthly_usd', yearly: 'price_growth_yearly_usd' },
            razorpayPlanId: { monthly: 'plan_growth_monthly_inr', yearly: 'plan_growth_yearly_inr' },
            contactLimit: 20000,
            features: ['Up to 20,000 contacts', 'Custom templates', 'Dedicated account manager'],
            popular: true,
        },
        {
            name: 'Pro',
            priceINR: { monthly: 12900, yearly: 129000 },
            priceUSD: { monthly: 129, yearly: 1290 },
            stripePriceId: { monthly: 'price_pro_monthly_usd', yearly: 'price_pro_yearly_usd' },
            razorpayPlanId: { monthly: 'plan_pro_monthly_inr', yearly: 'plan_pro_yearly_inr' },
            contactLimit: 100000,
            features: ['Up to 100,000 contacts', 'API access', '24/7 Phone support'],
        }
    ];

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
            if (country === 'IN') {
                // Razorpay Flow
                const planId = plan.razorpayPlanId[billingCycle];
                const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3301/api'}/payments/checkout/razorpay`, { planId, planName: plan.name }, config);
                
                const { subscriptionId, keyId } = res.data;

                const options = {
                    key: keyId,
                    subscription_id: subscriptionId,
                    name: "EaseMessage",
                    description: `${plan.name} Plan (${billingCycle})`,
                    handler: function (response) {
                        alert(`Payment successful! Payment ID: ${response.razorpay_payment_id}`);
                        // Webhook will handle DB update, but we could reload user here
                    },
                    prefill: {
                        name: user.name || user.firstName,
                        email: user.email,
                    },
                    theme: {
                        color: "#4f46e5",
                    },
                };

                const rzp1 = new window.Razorpay(options);
                rzp1.open();
            } else {
                // Stripe Flow
                const priceId = plan.stripePriceId[billingCycle];
                const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3301/api'}/payments/checkout/stripe`, { priceId, planName: plan.name }, config);
                
                // Redirect to Stripe Checkout
                window.location.href = res.data.url;
            }
        } catch (err) {
            console.error('Subscription error:', err);
            alert('Failed to initiate subscription checkout. Please try again.');
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

                {/* Country Toggle for Testing/Demo */}
                <div className="mt-6 flex justify-center items-center gap-x-3">
                    <span className="text-sm text-gray-500">Billing Country:</span>
                    <select 
                        value={country} 
                        onChange={(e) => setCountry(e.target.value)}
                        className="rounded-md border-gray-300 py-1.5 pl-3 pr-10 text-gray-900 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    >
                        <option value="US">United States (USD - Stripe)</option>
                        <option value="IN">India (INR - Razorpay)</option>
                        <option value="UK">United Kingdom (USD - Stripe)</option>
                    </select>
                </div>

                <div className="isolate mx-auto mt-10 grid max-w-md grid-cols-1 gap-8 md:max-w-7xl md:grid-cols-4">
                    {plans.map((plan) => {
                        const isINR = country === 'IN';
                        const currencySymbol = isINR ? '₹' : '$';
                        const price = isINR ? plan.priceINR[billingCycle] : plan.priceUSD[billingCycle];
                        
                        return (
                            <div
                                key={plan.name}
                                className={`rounded-3xl p-8 ring-1 xl:p-10 ${plan.popular ? 'bg-gray-900 ring-gray-900' : 'ring-gray-200'}`}
                            >
                                <h3 id={plan.name} className={`text-lg font-semibold leading-8 ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                                    {plan.name}
                                </h3>
                                <p className="mt-4 text-sm leading-6 text-gray-500">
                                    Ideal for up to {plan.contactLimit.toLocaleString()} contacts.
                                </p>
                                <p className="mt-6 flex items-baseline gap-x-1">
                                    <span className={`text-4xl font-bold tracking-tight ${plan.popular ? 'text-white' : 'text-gray-900'}`}>
                                        {currencySymbol}{price}
                                    </span>
                                    <span className={`text-sm font-semibold leading-6 ${plan.popular ? 'text-gray-300' : 'text-gray-600'}`}>
                                        /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                                    </span>
                                </p>
                                <button
                                    onClick={() => handleSubscribe(plan)}
                                    disabled={loadingPlan === plan.name || (user?.subscription?.plan === plan.name)}
                                    className={`mt-6 block w-full rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                                        plan.popular
                                            ? 'bg-white text-gray-900 hover:bg-gray-100 focus-visible:outline-white'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600'
                                    } ${user?.subscription?.plan === plan.name ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {loadingPlan === plan.name ? 'Processing...' : user?.subscription?.plan === plan.name ? 'Current Plan' : (plan.name === 'Free' ? 'Get Started' : 'Subscribe')}
                                </button>
                                <ul role="list" className={`mt-8 space-y-3 text-sm leading-6 ${plan.popular ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex gap-x-3">
                                            <Check className={`h-6 w-5 flex-none ${plan.popular ? 'text-indigo-400' : 'text-indigo-600'}`} aria-hidden="true" />
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
                        <a
                            href="mailto:lakhendra@easexpense.com"
                            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-5 py-3 text-base font-medium text-white hover:bg-indigo-700"
                        >
                            Contact Us
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Pricing;
