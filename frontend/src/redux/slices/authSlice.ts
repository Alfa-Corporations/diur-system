import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User, LoginResponse } from '../../../../shared/types';

/**
 * Slice de autenticación
 * Gestiona el estado de autenticación del usuario
 */
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;

  const storedUser = localStorage.getItem('authUser');
  if (!storedUser) return null;

  try {
    return JSON.parse(storedUser) as User;
  } catch (error) {
    console.error('Error restoring stored user:', error);
    localStorage.removeItem('authUser');
    return null;
  }
};

const storedUser = getStoredUser();
const storedToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

const initialState: AuthState = {
  user: storedUser,
  token: storedToken,
  isAuthenticated: Boolean(storedUser && storedToken),
  loading: false,
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: state => {
      state.loading = true;
      state.error = null;
    },
    restoreSession: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.loading = false;
      state.error = null;
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('authUser', JSON.stringify(action.payload.user));
    },
    loginSuccess: (state, action: PayloadAction<LoginResponse>) => {
      state.loading = false;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.error = null;
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('authUser', JSON.stringify(action.payload.user));
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.error = action.payload;
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      localStorage.removeItem('token');
      localStorage.removeItem('authUser');
    },
    logout: state => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      localStorage.removeItem('token');
      localStorage.removeItem('authUser');
    },
    updateProfile: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      localStorage.setItem('authUser', JSON.stringify(action.payload));
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    clearError: state => {
      state.error = null;
    }
  }
});

export const { loginStart, restoreSession, loginSuccess, loginFailure, logout, updateProfile, setLoading, clearError } = authSlice.actions;

export default authSlice.reducer;
