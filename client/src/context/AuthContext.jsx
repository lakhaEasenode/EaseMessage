import { createContext, useReducer, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const initialState = {
    token: localStorage.getItem('token'),
    isAuthenticated: null,
    loading: true,
    user: null
};

const authReducer = (state, action) => {
    console.log('AuthReducer called:', action.type, action.payload);
    switch (action.type) {
        case 'USER_LOADED':
            return {
                ...state,
                isAuthenticated: true,
                loading: false,
                user: action.payload
            };
        case 'REGISTER_SUCCESS':
        case 'LOGIN_SUCCESS':
            console.log('Setting token in localStorage:', action.payload.token);
            localStorage.setItem('token', action.payload.token);
            console.log('Token set, new state:', { token: action.payload.token, isAuthenticated: true });
            return {
                ...state,
                ...action.payload,
                isAuthenticated: true,
                loading: false
            };
        case 'REGISTER_FAIL':
        case 'AUTH_ERROR':
        case 'LOGIN_FAIL':
        case 'LOGOUT':
            localStorage.removeItem('token');
            return {
                ...state,
                token: null,
                isAuthenticated: false,
                loading: false,
                user: null
            };
        default:
            return state;
    }
};

export const AuthProvider = ({ children }) => {
    const [state, dispatch] = useReducer(authReducer, initialState);

    useEffect(() => {
        // Only try to load user if a token exists in local storage
        if (localStorage.getItem('token')) {
            loadUser();
        } else {
            dispatch({ type: 'AUTH_ERROR' });
        }
    }, []);

    const loadUser = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            dispatch({ type: 'AUTH_ERROR' });
            return;
        }

        const config = {
            headers: {
                'x-auth-token': token
            }
        };

        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3301/api'}/auth/user`, config);
            dispatch({
                type: 'USER_LOADED',
                payload: res.data
            });
        } catch (err) {
            dispatch({ type: 'AUTH_ERROR' });
        }
    };

    const register = async formData => {
        const config = {
            headers: {
                'Content-Type': 'application/json'
            }
        };

        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3301/api'}/auth/register`, formData, config);

            dispatch({
                type: 'REGISTER_SUCCESS',
                payload: res.data
            });

            loadUser();
        } catch (err) {
            dispatch({
                type: 'REGISTER_FAIL',
                payload: err.response.data.msg
            });
            throw err;
        }
    };

    const login = async formData => {
        const config = {
            headers: {
                'Content-Type': 'application/json'
            }
        };

        try {
            console.log('Making login API request...');
            const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:3301/api'}/auth/login`, formData, config);
            console.log('Login API response:', res.data);

            console.log('Dispatching LOGIN_SUCCESS');
            dispatch({
                type: 'LOGIN_SUCCESS',
                payload: res.data
            });
            console.log('LOGIN_SUCCESS dispatched');

            // Set the token in axios defaults for future requests
            if (res.data.token) {
                axios.defaults.headers.common['x-auth-token'] = res.data.token;
                console.log('Set axios x-auth-token header');
            }

            // Dispatch USER_LOADED with the user data we already have from login response
            // This avoids a race condition where loadUser() tries to read from localStorage
            // before the token has been fully persisted
            if (res.data.user) {
                console.log('Dispatching USER_LOADED');
                dispatch({
                    type: 'USER_LOADED',
                    payload: res.data.user
                });
            }
        } catch (err) {
            dispatch({
                type: 'LOGIN_FAIL',
                payload: err.response.data.msg
            });
            throw err;
        }
    };

    const logout = () => dispatch({ type: 'LOGOUT' });

    return (
        <AuthContext.Provider
            value={{
                token: state.token,
                isAuthenticated: state.isAuthenticated,
                loading: state.loading,
                user: state.user,
                register,
                login,
                logout,
                loadUser
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

// Helper function to set token
const setAuthToken = token => {
    if (token) {
        axios.defaults.headers.common['x-auth-token'] = token;
    } else {
        delete axios.defaults.headers.common['x-auth-token'];
    }
};

export default AuthContext;
