import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Contacts from './pages/Contacts';
import WhatsAppAccounts from './pages/WhatsAppAccounts';
import Templates from './pages/Templates';
import AuthContext, { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './components/Toast';

// Placeholder Pages
import Campaigns from './pages/Campaigns';
import Inbox from './pages/Inbox';
import Settings from './pages/Settings';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useContext(AuthContext);

  if (loading) return <div className="p-10">Loading...</div>;

  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
      <ToastProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/whatsapp-accounts" element={<WhatsAppAccounts />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </Router>
      </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
