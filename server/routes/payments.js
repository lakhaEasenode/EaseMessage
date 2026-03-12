const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Razorpay = require('razorpay');
const auth = require('../middleware/auth');
const User = require('../models/User');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_id',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
});

// Helper to determine contact limits based on plan name
const getContactLimit = (planName) => {
  switch (planName) {
    case 'Free': return 100;
    case 'Starter': return 1000;
    case 'Growth': return 20000;
    case 'Pro': return 100000;
    case 'Enterprise': return 9999999;
    default: return 100;
  }
};

// @route   POST /api/payments/checkout/stripe
// @desc    Create Stripe Checkout Session for Subscription
// @access  Private
router.post('/checkout/stripe', auth, async (req, res) => {
  try {
    const { priceId, planName } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3300'}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3300'}/pricing?canceled=true`,
      client_reference_id: user.id.toString(),
      customer_email: user.email,
      metadata: {
        planName,
        userId: user.id.toString(),
      }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe Checkout Error:', err);
    res.status(500).send('Server Error');
  }
});


// @route   POST /api/payments/checkout/razorpay
// @desc    Create Razorpay Subscription
// @access  Private
router.post('/checkout/razorpay', auth, async (req, res) => {
  try {
    const { planId, planName } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Razorpay Subscription Creation
    const subscriptionOptions = {
      plan_id: planId,
      customer_notify: 1,
      total_count: 120, // 10 years max roughly
      notes: {
        userId: user.id.toString(),
        planName
      }
    };

    const subscription = await razorpay.subscriptions.create(subscriptionOptions);

    res.json({
      subscriptionId: subscription.id,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Razorpay Checkout Error:', err);
    res.status(500).send('Server Error');
  }
});


// @route   POST /api/payments/webhook/stripe
// @desc    Stripe Webhook Handler
// @access  Public
// Note: This must receive the raw body. Make sure index.js configures express.raw for this route.
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Stripe Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id || session.metadata.userId;
      const planName = session.metadata.planName;

      if (userId) {
        await User.findByIdAndUpdate(userId, {
          'subscription.plan': planName || 'Starter',
          'subscription.status': 'active',
          'subscription.gateway': 'stripe',
          'subscription.stripeCustomerId': session.customer,
          'subscription.stripeSubscriptionId': session.subscription,
          'subscription.contactLimit': getContactLimit(planName)
        });
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      await User.findOneAndUpdate(
        { 'subscription.stripeSubscriptionId': subscription.id },
        { 
          'subscription.status': 'canceled',
          'subscription.plan': 'Free',
          'subscription.contactLimit': 100
        }
      );
    }

    // Return a 200 response to acknowledge receipt of the event
    res.send();
  } catch (err) {
    console.error('Webhook processing error', err);
    res.status(500).send('Webhook handler error');
  }
});

// @route   POST /api/payments/webhook/razorpay
// @desc    Razorpay Webhook Handler
// @access  Public
router.post('/webhook/razorpay', express.json(), async (req, res) => {
  // Validate signature
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_webhook_secret';
  const signature = req.headers['x-razorpay-signature'];
  
  const expectedSignature = crypto.createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (expectedSignature !== signature) {
    return res.status(400).send('Invalid signature');
  }

  const { event, payload } = req.body;

  try {
    if (event === 'subscription.charged') {
      const subscriptionInfo = payload.subscription.entity;
      const userId = subscriptionInfo.notes.userId;
      const planName = subscriptionInfo.notes.planName || 'Starter';

      if (userId) {
        await User.findByIdAndUpdate(userId, {
           'subscription.plan': planName,
           'subscription.status': 'active',
           'subscription.gateway': 'razorpay',
           'subscription.razorpayCustomerId': subscriptionInfo.customer_id,
           'subscription.razorpaySubscriptionId': subscriptionInfo.id,
           'subscription.contactLimit': getContactLimit(planName)
        });
      }
    } else if (event === 'subscription.cancelled') {
      const subscriptionInfo = payload.subscription.entity;
      await User.findOneAndUpdate(
        { 'subscription.razorpaySubscriptionId': subscriptionInfo.id },
        { 
          'subscription.status': 'canceled',
          'subscription.plan': 'Free',
          'subscription.contactLimit': 100
        }
      );
    }

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Razorpay Webhook Error', err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
