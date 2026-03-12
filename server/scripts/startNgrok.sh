#!/bin/sh

PORT_VALUE="${PORT:-3301}"

if [ -n "$NGROK_AUTHTOKEN" ]; then
  ngrok config add-authtoken "$NGROK_AUTHTOKEN" >/dev/null 2>&1 || true
fi

echo "Starting ngrok for port ${PORT_VALUE}"
echo "After ngrok starts, copy the public URL into server/.env:"
echo "PUBLIC_SERVER_URL=https://your-ngrok-url.ngrok-free.app"
echo "PUBLIC_API_URL=https://your-ngrok-url.ngrok-free.app/api"
echo "STRIPE_WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app/api/billing/webhooks/stripe"
echo "RAZORPAY_WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app/api/billing/webhooks/razorpay"
echo "WHATSAPP_WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app/api/whatsapp/webhook"

ngrok http "$PORT_VALUE"
