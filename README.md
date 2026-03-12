# EaseMessage

A comprehensive WhatsApp Business messaging platform built with React and Node.js.

## Project Structure

```
├── client/          # React frontend (Vite)
├── server/          # Node.js backend (Express)
└── README.md
```

## Features

- 📱 WhatsApp Business API integration
- 💬 Real-time messaging with 24-hour window tracking
- 📊 Campaign management
- 👥 Contact and list management
- 📋 Message templates
- 📈 Analytics dashboard

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB
- WhatsApp Business Account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/lakhaEasenode/EaseMessage.git
cd EaseMessage
```

2. Install dependencies for both client and server:
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

3. Set up environment variables:

**Server (.env)**:
```bash
cp server/.env.example server/.env
```

**Client (.env)**:
```
VITE_API_URL=http://localhost:3301/api
```

### Running the Application

1. Start the server:
```bash
cd server
node index.js
```

2. Start the client (in a new terminal):
```bash
cd client
npm run dev
```

The application will be available at `http://localhost:5173`

## Webhooks and ngrok

For local Stripe and Razorpay testing, expose the server with ngrok and then set the public URLs in `server/.env`.

1. Start the server:
```bash
cd server
npm run dev
```

2. Expose the API with ngrok:
```bash
cd server
npm run ngrok:start
```

3. Copy the public ngrok URL and update these env vars in `server/.env`:
```bash
PUBLIC_SERVER_URL=https://your-ngrok-url.ngrok-free.app
PUBLIC_API_URL=https://your-ngrok-url.ngrok-free.app/api
STRIPE_WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app/api/billing/webhooks/stripe
RAZORPAY_WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app/api/billing/webhooks/razorpay
WHATSAPP_WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app/api/whatsapp/webhook
```

4. Print the exact webhook config:
```bash
cd server
npm run webhooks:print
```

Webhook endpoints:
- Stripe: `/api/billing/webhooks/stripe`
- Razorpay: `/api/billing/webhooks/razorpay`
- WhatsApp verify: `GET /api/whatsapp/webhook`
- WhatsApp events: `POST /api/whatsapp/webhook`

Webhook config API:
- `GET /api/billing/webhook-config`

## Tech Stack

### Frontend
- React 18
- Vite
- TailwindCSS
- Axios
- Recharts
- Lucide Icons

### Backend
- Node.js
- Express
- MongoDB/Mongoose
- JWT Authentication
- WhatsApp Business API

## License

MIT
