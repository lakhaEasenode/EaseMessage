import { createContext, useReducer, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const initialState = {
    token: localStorage.getItem('token'),
    isAuthenticated: null,
    loading: true,
    user: null
};

const authReducer = (state, action) => {
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
            localStorage.setItem('token', action.payload.token);
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
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3301/api';

    const loadUser = useCallback(async () => {
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
            const res = await axios.get(`${API_URL}/auth/user`, config);
            setWorkspaceHeader(res.data?.activeWorkspaceId);
            dispatch({
                type: 'USER_LOADED',
                payload: res.data
            });
        } catch (err) {
            console.error('Failed to load user', err);
            dispatch({ type: 'AUTH_ERROR' });
        }
    }, [API_URL]);

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
            setAuthToken(storedToken);
            loadUser();
        } else {
            dispatch({ type: 'AUTH_ERROR' });
        }
    }, [loadUser]);

    const register = async formData => {
        const config = {
            headers: {
                'Content-Type': 'application/json'
            }
        };

        try {
            const res = await axios.post(`${API_URL}/auth/register`, formData, config);
            // Don't auto-login — user needs to verify OTP first
            return res.data;
        } catch (err) {
            dispatch({
                type: 'REGISTER_FAIL',
                payload: err.response?.data?.msg
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
            const res = await axios.post(`${API_URL}/auth/login`, formData, config);
            dispatch({
                type: 'LOGIN_SUCCESS',
                payload: res.data
            });

            if (res.data.token) {
                setAuthToken(res.data.token);
            }

            if (res.data.user) {
                setWorkspaceHeader(res.data.user.activeWorkspaceId);
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

    const switchWorkspace = async (workspaceId) => {
        const config = {
            headers: {
                'x-auth-token': state.token
            }
        };

        const res = await axios.put(`${API_URL}/workspaces/switch`, { workspaceId }, config);
        setWorkspaceHeader(res.data?.currentWorkspace?.id || workspaceId);
        dispatch({
            type: 'USER_LOADED',
            payload: {
                ...state.user,
                activeWorkspaceId: res.data?.currentWorkspace?.id || workspaceId,
                currentWorkspace: res.data?.currentWorkspace || state.user?.currentWorkspace,
                workspaces: res.data?.workspaces || state.user?.workspaces || []
            }
        });

        return res.data;
    };

    const refreshWorkspaces = async () => {
        const config = {
            headers: {
                'x-auth-token': state.token
            }
        };

        const res = await axios.get(`${API_URL}/auth/user`, config);
        setWorkspaceHeader(res.data?.activeWorkspaceId);
        dispatch({
            type: 'USER_LOADED',
            payload: res.data
        });

        return res.data;
    };

    const logout = () => {
        setAuthToken(null);
        setWorkspaceHeader(null);
        dispatch({ type: 'LOGOUT' });
    };

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
                loadUser,
                switchWorkspace,
                refreshWorkspaces
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

const setWorkspaceHeader = workspaceId => {
    if (workspaceId) {
        axios.defaults.headers.common['x-workspace-id'] = workspaceId;
    } else {
        delete axios.defaults.headers.common['x-workspace-id'];
    }
};

export default AuthContext;
