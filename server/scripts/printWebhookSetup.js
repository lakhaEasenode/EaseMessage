const dotenv = require('dotenv');
const { getServerBaseUrl, getApiBaseUrl, getFrontendBaseUrl, getWebhookUrls } = require('../config/publicUrls');

dotenv.config();

const urls = getWebhookUrls();

console.log('EaseMessage Webhook Setup');
console.log('-------------------------');
console.log(`Public server URL : ${getServerBaseUrl()}`);
console.log(`Public API URL    : ${getApiBaseUrl()}`);
console.log(`Frontend URL      : ${getFrontendBaseUrl()}`);
console.log('');
console.log('Webhook endpoints');
console.log(`Stripe    : ${urls.stripe}`);
console.log(`Razorpay  : ${urls.razorpay}`);
console.log(`WhatsApp  : ${urls.whatsapp}`);
console.log('');
console.log('Suggested ngrok command');
console.log(`ngrok http ${process.env.PORT || 3301}`);
console.log('');
console.log('Recommended Stripe events');
console.log('- checkout.session.completed');
console.log('- customer.subscription.created');
console.log('- customer.subscription.updated');
console.log('- customer.subscription.deleted');
console.log('- invoice.created');
console.log('- invoice.finalized');
console.log('- invoice.updated');
console.log('- invoice.payment_failed');
console.log('- invoice.paid');
console.log('');
console.log('Recommended Razorpay events');
console.log('- payment_link.paid');
console.log('- payment_link.expired');
console.log('- payment.failed');
console.log('- payment.captured');
