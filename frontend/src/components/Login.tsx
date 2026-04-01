import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { loginStart, loginSuccess, loginFailure } from '../redux/slices/authSlice';
import apiService from '../services/apiService';
import socketService from '../services/socketService';
import type { LoginRequest } from '../../../shared/types';

/**
 * Componente de Login
 * Formulario de autenticación de usuarios
 */
const Login: React.FC = () => {
  const [formData, setFormData] = useState<LoginRequest>({
    identifier: '',
    password: ''
  });

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated } = useAppSelector(state => state.auth);

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.identifier || !formData.password) {
      dispatch(loginFailure('Por favor complete todos los campos'));
      return;
    }

    dispatch(loginStart());

    try {
      const response = await apiService.login(formData);
      dispatch(loginSuccess(response));

      // Conectar Socket.IO
      socketService.connect({
        id: response.user.id,
        role: response.user.role
      });

      navigate('/dashboard');
    } catch (error: unknown) {
      let message = 'Error al iniciar sesión';

      if (typeof error === 'object' && error !== null && 'response' in error) {
        const apiError = error as { response?: { data?: { message?: string } } };
        message = apiError.response?.data?.message || message;
      } else if (typeof error === 'object' && error !== null && 'request' in error) {
        message = 'No se pudo conectar con el servidor. Verifica que el backend esté ejecutándose.';
      } else if (error instanceof Error) {
        message = error.message;
      }

      dispatch(loginFailure(message));
    }
  };

  return (
    <div className='login-shell'>
      <div className='container py-4'>
        <div className='row align-items-center justify-content-center g-4'>
          <div className='col-12 col-lg-5'>
            <div className='login-hero'>
              <span className='eyebrow mb-3'>DIUR SYSTEM</span>
              <h1 className='mb-3'>Ventas, inventario y facturación en una sola vista</h1>
              <p className='mb-4'>Una experiencia moderna, clara y optimizada para trabajar cómodamente desde el móvil o desde escritorio.</p>

              <div className='login-feature'>
                <span className='feature-icon'>📦</span>
                <div>
                  <strong>Control de inventario</strong>
                  <p className='mb-0'>Consulta stock, productos y movimientos en tiempo real.</p>
                </div>
              </div>
              <div className='login-feature'>
                <span className='feature-icon'>🧾</span>
                <div>
                  <strong>Facturación rápida</strong>
                  <p className='mb-0'>Gestiona ventas y documentos con un flujo simple e intuitivo.</p>
                </div>
              </div>
              <div className='login-feature'>
                <span className='feature-icon'>📱</span>
                <div>
                  <strong>Diseño responsive</strong>
                  <p className='mb-0'>Trabaja sin fricción desde tablets, móviles y computadoras.</p>
                </div>
              </div>
            </div>
          </div>
          <div className='col-12 col-md-8 col-lg-5'>
            <div className='login-card card border-0'>
              <div className='card-body'>
                <div className='mb-4'>
                  <h3 className='mb-2'>Iniciar sesión</h3>
                  <p className='mb-0'>Ingresa con tu email o nombre de usuario para acceder al panel.</p>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className='mb-3'>
                    <label htmlFor='identifier' className='form-label'>
                      Email o Usuario
                    </label>
                    <input type='text' className='form-control' id='identifier' name='identifier' placeholder='admin@diur.com' value={formData.identifier} onChange={handleChange} required />
                  </div>

                  <div className='mb-3'>
                    <label htmlFor='password' className='form-label'>
                      Contraseña
                    </label>
                    <input type='password' className='form-control' id='password' name='password' placeholder='••••••••' value={formData.password} onChange={handleChange} required />
                  </div>

                  {error && (
                    <div className='alert alert-danger' role='alert'>
                      {error}
                    </div>
                  )}

                  <div className='d-grid mb-3'>
                    <button type='submit' className='btn btn-primary btn-lg' disabled={loading}>
                      {loading ? 'Iniciando sesión...' : 'Entrar al sistema'}
                    </button>
                  </div>
                </form>

                <div className='small text-muted'>
                  Acceso de prueba: <strong>admin@diur.com</strong> / <strong>admin123</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
