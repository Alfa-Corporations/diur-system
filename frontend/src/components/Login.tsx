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

  const [showPassword, setShowPassword] = useState(false);

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
                    <div className='d-flex align-items-center' style={{position: 'relative'}}>
                      <input type={showPassword ? 'text' : 'password'} className='form-control' id='password' name='password' placeholder='••••••••' value={formData.password} onChange={handleChange} required />
                      <svg style={{position: 'absolute', right: '.5rem'}} onClick={() => setShowPassword(!showPassword)} xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='#000000'>
                        {showPassword ? (
                          <path d='m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t37.5-4q75 0 127.5 52.5T660-500q0 20-4 37.5T644-428Zm128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302Zm20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736-56 56ZM222-624q-29 26-53 57t-41 67q50 101 143.5 160.5T480-280q20 0 39-2.5t39-5.5l-36-38q-11 3-21 4.5t-21 1.5q-75 0-127.5-52.5T300-500q0-11 1.5-21t4.5-21l-84-82Zm319 93Zm-151 75Z' />
                        ) : (
                          <path d='M607.5-372.5Q660-425 660-500t-52.5-127.5Q555-680 480-680t-127.5 52.5Q300-575 300-500t52.5 127.5Q405-320 480-320t127.5-52.5Zm-204-51Q372-455 372-500t31.5-76.5Q435-608 480-608t76.5 31.5Q588-545 588-500t-31.5 76.5Q525-392 480-392t-76.5-31.5ZM214-281.5Q94-363 40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200q-146 0-266-81.5ZM480-500Zm207.5 160.5Q782-399 832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280q113 0 207.5-59.5Z' />
                        )}
                      </svg>
                    </div>
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
