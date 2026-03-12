const trimTrailingSlash = (value = '') => value.replace(/\/+$/, '');

const getServerBaseUrl = () => trimTrailingSlash(
    process.env.PUBLIC_SERVER_URL ||
    process.env.WEBHOOK_PUBLIC_BASE_URL ||
    process.env.APP_BASE_URL ||
    `http://localhost:${process.env.PORT || 3301}`
);

const getApiBaseUrl = () => trimTrailingSlash(
    process.env.PUBLIC_API_URL ||
    `${getServerBaseUrl()}/api`
);

const getFrontendBaseUrl = () => trimTrailingSlash(
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_FRONTEND_URL ||
    'http://localhost:3300'
);

const getWebhookUrls = () => ({
    stripe: process.env.STRIPE_WEBHOOK_URL || `${getApiBaseUrl()}/billing/webhooks/stripe`,
    razorpay: process.env.RAZORPAY_WEBHOOK_URL || `${getApiBaseUrl()}/billing/webhooks/razorpay`,
    whatsapp: process.env.WHATSAPP_WEBHOOK_URL || `${getApiBaseUrl()}/whatsapp/webhook`
});

module.exports = {
    getServerBaseUrl,
    getApiBaseUrl,
    getFrontendBaseUrl,
    getWebhookUrls
};
