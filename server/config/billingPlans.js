const plans = {
    Free: {
        name: 'Free',
        key: 'Free',
        description: 'Basic messaging for very small teams',
        contactLimit: 100,
        features: ['Up to 100 contacts', 'Basic messaging', 'Standard support'],
        sortOrder: 1,
        prices: {
            usd: {
                monthly: { amount: 0, priceId: process.env.STRIPE_PRICE_FREE_MONTHLY_USD || 'price_free_monthly_usd' },
                yearly: { amount: 0, priceId: process.env.STRIPE_PRICE_FREE_YEARLY_USD || 'price_free_yearly_usd' }
            },
            inr: {
                monthly: { amount: 0, priceId: process.env.STRIPE_PRICE_FREE_MONTHLY_INR || 'price_free_monthly_inr' },
                yearly: { amount: 0, priceId: process.env.STRIPE_PRICE_FREE_YEARLY_INR || 'price_free_yearly_inr' }
            }
        }
    },
    Starter: {
        name: 'Starter',
        key: 'Starter',
        description: 'For smaller teams starting campaigns',
        contactLimit: 1000,
        features: ['Up to 1,000 contacts', 'Advanced messaging', 'Priority support'],
        sortOrder: 2,
        prices: {
            usd: {
                monthly: { amount: 29, priceId: process.env.STRIPE_PRICE_STARTER_MONTHLY_USD || 'price_starter_monthly_usd' },
                yearly: { amount: 290, priceId: process.env.STRIPE_PRICE_STARTER_YEARLY_USD || 'price_starter_yearly_usd' }
            },
            inr: {
                monthly: { amount: 2900, priceId: process.env.STRIPE_PRICE_STARTER_MONTHLY_INR || 'price_starter_monthly_inr' },
                yearly: { amount: 29000, priceId: process.env.STRIPE_PRICE_STARTER_YEARLY_INR || 'price_starter_yearly_inr' }
            }
        }
    },
    Growth: {
        name: 'Growth',
        key: 'Growth',
        description: 'For growing businesses and custom templates',
        contactLimit: 20000,
        features: ['Up to 20,000 contacts', 'Custom templates', 'Dedicated account manager'],
        sortOrder: 3,
        prices: {
            usd: {
                monthly: { amount: 49, priceId: process.env.STRIPE_PRICE_GROWTH_MONTHLY_USD || 'price_growth_monthly_usd' },
                yearly: { amount: 490, priceId: process.env.STRIPE_PRICE_GROWTH_YEARLY_USD || 'price_growth_yearly_usd' }
            },
            inr: {
                monthly: { amount: 4900, priceId: process.env.STRIPE_PRICE_GROWTH_MONTHLY_INR || 'price_growth_monthly_inr' },
                yearly: { amount: 49000, priceId: process.env.STRIPE_PRICE_GROWTH_YEARLY_INR || 'price_growth_yearly_inr' }
            }
        }
    },
    Pro: {
        name: 'Pro',
        key: 'Pro',
        description: 'For large teams with API access',
        contactLimit: 100000,
        features: ['Up to 100,000 contacts', 'API access', '24/7 Phone support'],
        sortOrder: 4,
        prices: {
            usd: {
                monthly: { amount: 129, priceId: process.env.STRIPE_PRICE_PRO_MONTHLY_USD || 'price_pro_monthly_usd' },
                yearly: { amount: 1290, priceId: process.env.STRIPE_PRICE_PRO_YEARLY_USD || 'price_pro_yearly_usd' }
            },
            inr: {
                monthly: { amount: 12900, priceId: process.env.STRIPE_PRICE_PRO_MONTHLY_INR || 'price_pro_monthly_inr' },
                yearly: { amount: 129000, priceId: process.env.STRIPE_PRICE_PRO_YEARLY_INR || 'price_pro_yearly_inr' }
            }
        }
    },
    Enterprise: {
        name: 'Enterprise',
        key: 'Enterprise',
        description: 'Custom enterprise billing and support',
        contactLimit: 9999999,
        features: ['Custom volume pricing', 'Dedicated onboarding', 'Custom SLA'],
        sortOrder: 5,
        prices: {
            usd: {
                monthly: { amount: 0, priceId: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY_USD || 'price_enterprise_monthly_usd' },
                yearly: { amount: 0, priceId: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY_USD || 'price_enterprise_yearly_usd' }
            },
            inr: {
                monthly: { amount: 0, priceId: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY_INR || 'price_enterprise_monthly_inr' },
                yearly: { amount: 0, priceId: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY_INR || 'price_enterprise_yearly_inr' }
            }
        }
    }
};

const getBillingCurrency = (countryCode = '') => countryCode === 'IN' ? 'inr' : 'usd';

const getPlanConfig = (planName = 'Free') => plans[planName] || plans.Free;

const getPriceConfig = ({ planName, countryCode, billingCycle }) => {
    const plan = getPlanConfig(planName);
    const currency = getBillingCurrency(countryCode);
    return {
        plan,
        currency,
        billingCycle,
        ...plan.prices[currency][billingCycle]
    };
};

module.exports = {
    BILLING_PLANS: plans,
    getPlanConfig,
    getPriceConfig,
    getBillingCurrency
};
