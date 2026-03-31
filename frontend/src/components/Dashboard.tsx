import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { logout } from '../redux/slices/authSlice';
import socketService from '../services/socketService';
import apiService from '../services/apiService';
import type { RegisterRequest, User } from '../../../shared/types';

/**
 * Componente Dashboard
 * Panel principal de la aplicación
 */
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector(state => state.auth);
  const { notifications } = useAppSelector(state => state.sync);
  const [userForm, setUserForm] = useState<RegisterRequest>({
    username: '',
    email: '',
    password: '',
    role: 'cashier'
  });
  const [userMessage, setUserMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);

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

  const handleUserFormChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setUserForm(prev => ({
      ...prev,
      [event.target.name]: event.target.value
    }));
  };

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (user?.role !== 'admin') {
      setUserMessage({ type: 'danger', text: 'Solo el administrador puede crear usuarios.' });
      return;
    }

    setCreatingUser(true);
    setUserMessage(null);

    try {
      const createdUser = await apiService.createUser(userForm);
      setUserMessage({ type: 'success', text: `Usuario ${createdUser.username} creado correctamente.` });
      setUserForm({
        username: '',
        email: '',
        password: '',
        role: 'cashier'
      });
    } catch (error: unknown) {
      let message = 'No se pudo crear el usuario.';

      if (typeof error === 'object' && error !== null && 'response' in error) {
        const apiError = error as { response?: { data?: { message?: string } } };
        message = apiError.response?.data?.message || message;
      } else if (error instanceof Error) {
        message = error.message;
      }

      setUserMessage({ type: 'danger', text: message });
    } finally {
      setCreatingUser(false);
    }
  };

  if (!user) return null;

  const isAdmin = user.role === 'admin';
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

            {isAdmin && (
              <div className='section-card mt-4'>
                <div className='d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3'>
                  <div>
                    <h5 className='mb-1'>Crear usuario</h5>
                    <p className='mb-0'>Solo administradores pueden registrar nuevos accesos.</p>
                  </div>
                  <span className='badge text-bg-primary'>ADMIN</span>
                </div>

                {userMessage && <div className={`alert alert-${userMessage.type}`}>{userMessage.text}</div>}

                <form className='row g-3' onSubmit={handleCreateUser}>
                  <div className='col-12 col-md-3'>
                    <label className='form-label'>Usuario</label>
                    <input className='form-control' name='username' value={userForm.username} onChange={handleUserFormChange} required />
                  </div>
                  <div className='col-12 col-md-3'>
                    <label className='form-label'>Email</label>
                    <input type='email' className='form-control' name='email' value={userForm.email} onChange={handleUserFormChange} required />
                  </div>
                  <div className='col-12 col-md-3'>
                    <label className='form-label'>Contraseña</label>
                    <input type='password' className='form-control' name='password' value={userForm.password} onChange={handleUserFormChange} required minLength={6} />
                  </div>
                  <div className='col-12 col-md-2'>
                    <label className='form-label'>Rol</label>
                    <select className='form-select' name='role' value={userForm.role} onChange={handleUserFormChange}>
                      {(['admin', 'cashier', 'warehouse', 'delivery'] as User['role'][]).map(role => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className='col-12 col-md-1 d-flex align-items-end'>
                    <button type='submit' className='btn btn-primary w-100' disabled={creatingUser}>
                      {creatingUser ? '...' : 'Crear'}
                    </button>
                  </div>
                </form>
              </div>
            )}

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
