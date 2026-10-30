import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './redux/store';
import { useAppSelector, useAppDispatch } from './hooks/redux';
import { usePermissions } from './hooks/permissions';
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
import AccountsReceivablePage from './pages/AccountsReceivablePage';
import UserManagementPage from './pages/UserManagementPage';
import OrdersDashboardPage from './pages/OrdersDashboardPage';
import POSPage from './pages/POSPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import SalesOrdersPage from './pages/SalesOrdersPage';
import LocalSalesOrdersPage from './pages/LocalSalesOrdersPage';
import PendingDeliveriesPage from './pages/PendingDeliveriesPage';
import FileImporter from './components/FileImporter';
import CustomerManager from './pages/CustomerManager';
import HistoryClient from './pages/HistoryClient';
import Sales from './pages/Sales';
import BackButton from './components/BackButton';
import { useLocation } from 'react-router-dom';

/**
 * Componente principal de la aplicación
 * Configura rutas y proveedores globales
 */
const AppContent: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector(state => state.auth);
  const { hasPermission } = usePermissions();
  const canAccess = (permissionNames: string[]) => user?.role === 'admin' || permissionNames.some(hasPermission);
  const canAccessAll = (permissionNames: string[]) => user?.role === 'admin' || permissionNames.every(hasPermission);
  const permissionRoute = (permissionNames: string[], element: React.ReactElement) =>
    isAuthenticated ? canAccess(permissionNames) ? element : <Navigate to='/dashboard' replace /> : <Navigate to='/login' replace />;
  const permissionRouteAll = (permissionNames: string[], element: React.ReactElement) =>
    isAuthenticated ? canAccessAll(permissionNames) ? element : <Navigate to='/dashboard' replace /> : <Navigate to='/login' replace />;
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
        {/* Botón de retroceso minimalista: oculto en la pantalla principal y login */}
        <BackButtonWrapper />
        <Routes>
          <Route path='/login' element={isAuthenticated ? <Navigate to='/dashboard' /> : <Login />} />
          <Route path='/dashboard' element={isAuthenticated ? <Dashboard /> : <Navigate to='/login' />} />
          <Route path='/products' element={permissionRoute(['leer_producto', 'gestionar_productos'], <ProductsPage />)} />
          <Route path='/products/importer' element={permissionRoute(['crear_producto', 'gestionar_productos'], <FileImporter />)} />
          <Route path='/invoices' element={permissionRoute(['leer_factura'], <InvoicesPage />)} />
          <Route path='/accounts-receivable' element={permissionRoute(['leer_factura'], <AccountsReceivablePage />)} />
          <Route path='/users' element={permissionRoute(['leer_usuario', 'gestionar_usuarios', 'crud_users'], <UserManagementPage />)} />
          <Route path='/customer' element={permissionRoute(['leer_clientes'], <CustomerManager />)} />
          <Route path='/customer/history/:customerId' element={permissionRouteAll(['leer_clientes', 'leer_factura', 'leer_orden'], <HistoryClient />)} />
          <Route path='/orders/dashboard' element={permissionRoute(['leer_orden'], <OrdersDashboardPage />)} />
          <Route path='/orders/dispatch' element={permissionRoute(['leer_orden'], <PendingDeliveriesPage />)} />
          <Route path='/orders/purchase' element={permissionRoute(['leer_orden'], <PurchaseOrdersPage />)} />
          <Route path='/orders/sale' element={permissionRoute(['leer_orden'], <SalesOrdersPage />)} />
          <Route path='/orders/local' element={permissionRoute(['leer_orden'], <LocalSalesOrdersPage />)} />
          <Route path='/sales' element={permissionRoute(['acceso_pos'], <Sales />)} />
          <Route path='/pos' element={permissionRoute(['acceso_pos'], <POSPage />)} />
          <Route path='/' element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} />} />
        </Routes>
      </div>
    </Router>
  );
};

const BackButtonWrapper: React.FC = () => {
  const loc = useLocation();
  const path = loc.pathname || '';
  if (path === '/dashboard' || path === '/login' || path === '/') return null;
  return (
    <div style={{ position: 'fixed', top: 12, left: 12, zIndex: 1200 }}>
      <BackButton />
    </div>
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
