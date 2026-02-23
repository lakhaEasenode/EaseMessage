import { useState, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

const useApprovedTemplates = () => {
    const { token } = useContext(AuthContext);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchTemplates = async () => {
        if (templates.length > 0) return templates;

        try {
            setLoading(true);
            if (!token) {
                console.error('No token found');
                return [];
            }

            const config = { headers: { 'x-auth-token': token } };

            const [templatesRes, accountsRes] = await Promise.all([
                axios.get(`${API_URL}/templates`, config),
                axios.get(`${API_URL}/whatsapp/accounts`, config)
            ]);

            const allTemplates = templatesRes.data;
            const accounts = accountsRes.data;

            // Find the WABA that owns the default phone number
            let defaultWabaId = null;
            for (const acc of accounts) {
                if (acc.phoneNumbers && acc.phoneNumbers.some(p => p.isDefault)) {
                    defaultWabaId = acc._id;
                    break;
                }
            }

            // Filter to only APPROVED templates for the default WABA
            const approved = allTemplates.filter(t => t.status === 'APPROVED');

            let result;
            if (defaultWabaId) {
                result = approved.filter(t => {
                    const tWabaId = t.wabaId && (t.wabaId._id || t.wabaId);
                    return tWabaId === defaultWabaId;
                });
            } else {
                result = approved;
            }

            setTemplates(result);
            return result;
        } catch (err) {
            console.error('Failed to load templates', err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const resetTemplates = () => setTemplates([]);

    return { templates, loading, fetchTemplates, resetTemplates };
};

export default useApprovedTemplates;
