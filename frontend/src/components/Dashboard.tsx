import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { logout } from '../redux/slices/authSlice';
import socketService from '../services/socketService';
import { addNotification } from '../redux/slices/syncSlice';

/**
 * Componente Dashboard
 * Panel principal de la aplicación
 */
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector(state => state.auth);
  const { notifications } = useAppSelector(state => state.sync);

  // Verificar autenticación
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Escuchar notificaciones de Socket.IO
  useEffect(() => {
    const handleNotification = (event: CustomEvent) => {
      dispatch(addNotification(event.detail));
    };

    window.addEventListener('socket-notification', handleNotification as EventListener);

    return () => {
      window.removeEventListener('socket-notification', handleNotification as EventListener);
    };
  }, [dispatch]);

  const handleLogout = () => {
    socketService.disconnect();
    dispatch(logout());
    navigate('/login');
  };

  if (!user) return null;

  const menuItems = [
    { label: 'Productos', path: '/products', icon: '📦', helper: 'Inventario y stock' },
    { label: 'Facturas', path: '/invoices', icon: '🧾', helper: 'Ventas y cobros' }
  ];

  return (
    <div className='app-shell'>
      <header className='app-topbar'>
        <div className='container-fluid py-4'>
          <div className='d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3'>
            <div>
              <span className='eyebrow mb-2'>Sistema DIUR</span>
              <h2 className='mb-1'>Panel principal</h2>
              <p className='mb-0'>Una vista clara para operar desde móvil, tablet o escritorio.</p>
            </div>
            <div className='d-flex flex-wrap align-items-center gap-2'>
              <span className='user-chip'>👋 {user.username}</span>
              <span className='role-chip'>{user.role.toUpperCase()}</span>
              <button className='btn btn-outline-primary btn-sm' onClick={handleLogout}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className='container-fluid py-4'>
        <div className='row g-4'>
          <aside className='col-12 col-xl-3'>
            <div className='side-panel h-100'>
              <p className='section-label mb-3'>Navegación</p>
              <div className='d-grid gap-2'>
                {menuItems.map(item => (
                  <button key={item.path} className='nav-action' onClick={() => navigate(item.path)}>
                    <span className='fw-semibold'>
                      {item.icon} {item.label}
                    </span>
                    <small>{item.helper}</small>
                  </button>
                ))}
              </div>

              <div className='info-card mt-4 p-3'>
                <small className='text-muted d-block mb-1'>Estado actual</small>
                <strong>{socketService.isConnected() ? '🟢 Conectado en tiempo real' : '🔴 Sin conexión en tiempo real'}</strong>
                <p className='mb-0 mt-2 small'>Las actualizaciones se reflejan en cuanto el servidor está disponible.</p>
              </div>
            </div>
          </aside>

          <main className='col-12 col-xl-9'>
            <div className='row g-3'>
              <div className='col-12 col-md-4'>
                <div className='stat-card'>
                  <div className='d-flex justify-content-between align-items-start'>
                    <div>
                      <div className='metric-label'>Estado del sistema</div>
                      <div className='metric-value'>{socketService.isConnected() ? 'Online' : 'Offline'}</div>
                    </div>
                    <span className='metric-icon'>🌐</span>
                  </div>
                </div>
              </div>
              <div className='col-12 col-md-4'>
                <div className='stat-card'>
                  <div className='d-flex justify-content-between align-items-start'>
                    <div>
                      <div className='metric-label'>Rol activo</div>
                      <div className='metric-value'>{user.role.toUpperCase()}</div>
                    </div>
                    <span className='metric-icon'>👤</span>
                  </div>
                </div>
              </div>
              <div className='col-12 col-md-4'>
                <div className='stat-card'>
                  <div className='d-flex justify-content-between align-items-start'>
                    <div>
                      <div className='metric-label'>Notificaciones</div>
                      <div className='metric-value'>{notifications.length}</div>
                    </div>
                    <span className='metric-icon'>🔔</span>
                  </div>
                </div>
              </div>
            </div>

            <div className='section-card mt-4'>
              <div className='d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3'>
                <div>
                  <h5 className='mb-1'>Notificaciones recientes</h5>
                  <p className='mb-0'>Mantén el control de eventos y movimientos importantes.</p>
                </div>
              </div>

              <div className='notifications-list d-grid gap-2'>
                {notifications.length === 0 ? (
                  <div className='notification-item'>No hay notificaciones por ahora.</div>
                ) : (
                  notifications.slice(0, 10).map((notification, index) => (
                    <div key={index} className='notification-item'>
                      <small className='text-muted d-block mb-1'>{new Date(notification.timestamp).toLocaleString()}</small>
                      <div className='fw-semibold'>{notification.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
