import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { logout } from '../redux/slices/authSlice';
import socketService from '../services/socketService';
import { usePermissions } from '../hooks/permissions';
import apiService from '../services/apiService';

/**
 * Componente Dashboard
 * Panel principal de la aplicación
 */
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector(state => state.auth);
  const { notifications } = useAppSelector(state => state.sync);
  const { hasPermission } = usePermissions();
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const handleLogout = () => {
    socketService.disconnect();
    dispatch(logout());
    navigate('/login');
  };

  const menuItems = [
    { label: 'Pedidos de venta', path: '/orders/sale', icon: '📤', helper: 'Consultar y gestionar órdenes', permissions: ['leer_orden'] },
    { label: 'Despachos pendientes', path: '/orders/dispatch', icon: '🚚', helper: 'Pendientes por cliente y orden', permissions: ['leer_orden'] },
    { label: 'Compras', path: '/orders/purchase', icon: '📥', helper: 'Órdenes de compra y recepción', permissions: ['leer_orden'] },
    { label: 'Dashboard de pedidos', path: '/orders/dashboard', icon: '📊', helper: 'Vista global de órdenes', permissions: ['leer_orden'] },
    { label: 'Facturas', path: '/invoices', icon: '🧾', helper: 'Consultar ventas y cobros', permissions: ['leer_factura'] },
    { label: 'Cuentas por cobrar', path: '/accounts-receivable', icon: '💳', helper: 'Gestionar saldos pendientes', permissions: ['leer_factura'] },
    { label: 'Clientes', path: '/customer', icon: '👥', helper: 'Administración de clientes', permissions: ['leer_clientes'] },
    { label: 'Productos', path: '/products', icon: '📦', helper: 'Inventario y stock', permissions: ['leer_producto', 'gestionar_productos'] },
    { label: 'Ventas en el local', path: '/pos', icon: '🛒', helper: 'Punto de venta', permissions: ['acceso_pos'] },
    { label: 'Usuarios', path: '/users', icon: '🔐', helper: 'Administración de accesos', permissions: ['leer_usuario', 'gestionar_usuarios', 'crud_users'] }
  ];

  const availableMenuItems = menuItems.filter(item => user?.role === 'admin' || item.permissions.some(hasPermission));
  const [pendingAccounts, setPendingAccounts] = useState<number | null>(null);
  const [pendingDeliveryUnits, setPendingDeliveryUnits] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadPending = async () => {
      try {
        const res = await apiService.getAccountsReceivable();
        if (!mounted) return;
        setPendingAccounts((res.accounts || []).length || 0);
      } catch {
        setPendingAccounts(null);
      }
    };

    void loadPending();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadPendingDeliveries = async () => {
      try {
        const { orders } = await apiService.getOrders();
        const units = orders
          .filter(order => order.type !== 'compra' && order.status !== 'cancelado')
          .flatMap(order => order.items || [])
          .reduce((total, item) => total + Math.max(0, item.quantityRequested - item.quantityProcessed), 0);
        if (mounted) setPendingDeliveryUnits(units);
      } catch {
        if (mounted) setPendingDeliveryUnits(null);
      }
    };

    void loadPendingDeliveries();
    return () => {
      mounted = false;
    };
  }, []);

  if (!user) return null;

  return (
    <div className='app-shell'>
      <header className=''>
        <div className='container-fluid pb-1'>
          <div className='d-flex justify-content-between align-center'>
            <span className='eyebrow mb-2'>Sistema DIUR</span>
            <button className='btn-exit' onClick={handleLogout}>
              <svg xmlns='http://www.w3.org/2000/svg' height='30px' viewBox='0 -960 960 960' width='30px' fill='#1d4ed8'>
                <path d='M200-120q-33 0-56.5-23.5T120-200v-120q0-17 11.5-28.5T160-360q17 0 28.5 11.5T200-320v120h560v-560H200v120q0 17-11.5 28.5T160-600q-17 0-28.5-11.5T120-640v-120q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm266-320H160q-17 0-28.5-11.5T120-480q0-17 11.5-28.5T160-520h306l-74-74q-12-12-11.5-28t11.5-28q12-12 28.5-12.5T449-651l143 143q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L449-309q-12 12-28.5 11.5T392-310q-11-12-11.5-28t11.5-28l74-74Z' />
              </svg>
            </button>
          </div>
          <div className='d-flex flex-lg-row justify-content-between align-items-lg-center gap-3'>
            <div className='d-flex flex-wrap align-items-center gap-2'>
              <span className='user-chip'>👋 {user.username}</span>
              <span className='role-chip'>{user.role.toUpperCase()}</span>
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
                {availableMenuItems.map(item => (
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
              {(user.role === 'admin' || hasPermission('leer_factura')) && <div className='col-12 col-md-4'>
                <div className='stat-card clickable' onClick={() => navigate('/accounts-receivable')} style={{ cursor: 'pointer' }}>
                  <div className='d-flex justify-content-between align-items-start'>
                    <div>
                      <div className='metric-label'>Cuentas por Cobrar</div>
                      <div className='metric-value'>{pendingAccounts === null ? '—' : pendingAccounts}</div>
                    </div>
                    <span className='metric-icon'>💳</span>
                  </div>
                  <div className='small text-muted mt-2'>Ver y registrar pagos pendientes</div>
                </div>
              </div>}
              {(user.role === 'admin' || hasPermission('leer_orden')) && <div className='col-12 col-md-4'>
                <div className='stat-card clickable' onClick={() => navigate('/orders/dispatch')} style={{ cursor: 'pointer' }}>
                  <div className='d-flex justify-content-between align-items-start'>
                    <div>
                      <div className='metric-label'>Unidades por despachar</div>
                      <div className='metric-value'>{pendingDeliveryUnits === null ? '—' : pendingDeliveryUnits}</div>
                    </div>
                    <span className='metric-icon'>🚚</span>
                  </div>
                  <div className='small text-muted mt-2'>Ver pendientes agrupados por cliente</div>
                </div>
              </div>}
              <div className='col-12 col-md-4'>
                <div className='stat-card'>
                  <div className='d-flex justify-content-between align-items-start'>
                    <div>
                      <div className='metric-label'>Permisos activos</div>
                      <div className='metric-value'>{user.permissions?.length || 0}</div>
                    </div>
                    <span className='metric-icon'>🔐</span>
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
