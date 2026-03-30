import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './redux/store';
import { useAppSelector, useAppDispatch } from './hooks/redux';
import { loadFromStorage, setOnline } from './redux/slices/syncSlice';
import socketService from './services/socketService';
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
  const { isAuthenticated } = useAppSelector(state => state.auth);

  // Inicializar aplicación
  useEffect(() => {
    // Cargar datos del localStorage
    dispatch(loadFromStorage());

    // Monitorear estado de conexión
    const handleOnline = () => dispatch(setOnline(true));
    const handleOffline = () => dispatch(setOnline(false));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificar conexión inicial
    dispatch(setOnline(navigator.onLine));

    // Solicitar permisos de notificación
    socketService.requestNotificationPermission();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [dispatch]);

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
