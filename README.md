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
```
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
PORT=3301
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
