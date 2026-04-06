import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

const useFacebookSDK = (token) => {
    const [isReady, setIsReady] = useState(!!window.FB);
    const [isLoading, setIsLoading] = useState(false);
    const configRef = useRef(null);

    const loadSDK = useCallback(async () => {
        if (window.FB) {
            setIsReady(true);
            return;
        }

        if (isLoading) return;
        setIsLoading(true);

        try {
            // Fetch app ID and config ID from backend
            const config = { headers: { 'x-auth-token': token } };
            const res = await axios.get(`${API_URL}/whatsapp/embedded-signup-config`, config);
            configRef.current = res.data;

            window.fbAsyncInit = function () {
                window.FB.init({
                    appId: configRef.current.appId,
                    cookie: true,
                    xfbml: true,
                    version: 'v24.0',
                });
                setIsReady(true);
                setIsLoading(false);
            };

            const script = document.createElement('script');
            script.src = 'https://connect.facebook.net/en_US/sdk.js';
            script.async = true;
            script.defer = true;
            script.crossOrigin = 'anonymous';
            document.body.appendChild(script);

            script.onerror = () => {
                setIsLoading(false);
                console.error('Failed to load Facebook SDK');
            };
        } catch (err) {
            setIsLoading(false);
            console.error('Failed to fetch Embedded Signup config:', err);
        }
    }, [isLoading, token]);

    return { isReady, isLoading, loadSDK, configRef };
};

export default useFacebookSDK;
