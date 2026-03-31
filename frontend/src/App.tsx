import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './redux/store';
import { useAppSelector, useAppDispatch } from './hooks/redux';
import { logout, restoreSession } from './redux/slices/authSlice';
import { addNotification, loadFromStorage, setOnline, startSync, syncSuccess, syncFailure } from './redux/slices/syncSlice';
import apiService from './services/apiService';
import socketService from './services/socketService';
import offlineSyncService from './services/offlineSyncService';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

// Componentes
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProductsPage from './pages/ProductsPage';
import InvoicesPage from './pages/InvoicesPage';

/**
 * Componente principal de la aplicación
 * Configura rutas y proveedores globales
 */
const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector(state => state.auth);
  const { isOnline } = useAppSelector(state => state.sync);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSyncingPending, setIsSyncingPending] = useState(false);

  useEffect(() => {
    const handleOnline = () => dispatch(setOnline(true));
    const handleOffline = () => dispatch(setOnline(false));

    const initializeApp = async () => {
      dispatch(loadFromStorage());
      dispatch(setOnline(navigator.onLine));
      void socketService.requestNotificationPermission();

      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('authUser');

      if (storedToken) {
        try {
          if (storedUser) {
            dispatch(restoreSession({ user: JSON.parse(storedUser), token: storedToken }));
          }

          if (navigator.onLine) {
            const profile = await apiService.getProfile();
            dispatch(restoreSession({ user: profile, token: storedToken }));
          }
        } catch (error) {
          console.error('Error restoring session:', error);
          dispatch(logout());
        }
      }

      setIsBootstrapping(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    void initializeApp();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [dispatch]);

  useEffect(() => {
    const handleSocketNotification = (event: Event) => {
      const customEvent = event as CustomEvent;
      dispatch(addNotification(customEvent.detail));
    };

    window.addEventListener('socket-notification', handleSocketNotification);

    return () => {
      window.removeEventListener('socket-notification', handleSocketNotification);
    };
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated && user) {
      socketService.connect({ id: user.id, role: user.role });
      return;
    }

    socketService.disconnect();
  }, [isAuthenticated, user]);

  useEffect(() => {
    const syncPendingChanges = async () => {
      if (!isAuthenticated || !user || !isOnline || isSyncingPending) {
        return;
      }

      setIsSyncingPending(true);
      dispatch(startSync());

      try {
        const { syncedEventIds, failedEvents } = await offlineSyncService.syncPendingChanges();
        dispatch(syncSuccess({ syncedEvents: syncedEventIds, lastSync: new Date().toISOString() }));

        if (failedEvents.length > 0) {
          dispatch(syncFailure(`No se pudieron sincronizar ${failedEvents.length} cambio(s) pendientes.`));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo completar la sincronización pendiente.';
        dispatch(syncFailure(message));
      } finally {
        setIsSyncingPending(false);
      }
    };

    void syncPendingChanges();
  }, [dispatch, isAuthenticated, isOnline, user]);

  if (isBootstrapping) {
    return (
      <div className='min-vh-100 d-flex align-items-center justify-content-center bg-light'>
        <div className='text-center'>
          <div className='spinner-border text-primary mb-3' role='status' />
          <p className='mb-0 text-muted'>Restaurando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className='App'>
        <Routes>
          <Route path='/login' element={isAuthenticated ? <Navigate to='/dashboard' /> : <Login />} />
          <Route path='/dashboard' element={isAuthenticated ? <Dashboard /> : <Navigate to='/login' />} />
          <Route path='/products' element={isAuthenticated ? <ProductsPage /> : <Navigate to='/login' />} />
          <Route path='/invoices' element={isAuthenticated ? <InvoicesPage /> : <Navigate to='/login' />} />
          <Route path='/' element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} />} />
        </Routes>
      </div>
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
};

export default App;
