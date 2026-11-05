import React, { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { updateProfile } from '../redux/slices/authSlice';
import apiService from '../services/apiService';

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(state => state.auth);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    setSaving(true);
    try {
      const updatedUser = await apiService.changePassword(currentPassword, newPassword);
      dispatch(updateProfile(updatedUser));
      navigate(updatedUser.role === 'vendedor' ? '/dashboard/visitor' : '/dashboard', { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo actualizar la contraseña.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <main className='login-shell'>
      <div className='container py-4'>
        <div className='row justify-content-center'>
          <div className='col-12 col-md-8 col-lg-5'>
            <section className='login-card card border-0'>
              <div className='card-body p-4'>
                <span className='eyebrow mb-2'>SEGURIDAD DE LA CUENTA</span>
                <h1 className='h3 mb-2'>Crea tu contraseña</h1>
                <p>Tu clave temporal solo sirve para el primer acceso. Cámbiala para continuar al sistema.</p>
                {error && <Alert variant='danger'>{error}</Alert>}
                <Form onSubmit={handleSubmit}>
                  <Form.Group className='mb-3'>
                    <Form.Label>Clave temporal recibida por correo</Form.Label>
                    <Form.Control autoComplete='current-password' required type='password' value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
                  </Form.Group>
                  <Form.Group className='mb-3'>
                    <Form.Label>Nueva contraseña</Form.Label>
                    <Form.Control autoComplete='new-password' minLength={8} required type='password' value={newPassword} onChange={event => setNewPassword(event.target.value)} />
                    <Form.Text>Debe tener al menos 8 caracteres.</Form.Text>
                  </Form.Group>
                  <Form.Group className='mb-4'>
                    <Form.Label>Confirmar nueva contraseña</Form.Label>
                    <Form.Control autoComplete='new-password' minLength={8} required type='password' value={confirmation} onChange={event => setConfirmation(event.target.value)} />
                  </Form.Group>
                  <Button type='submit' className='w-100' disabled={saving}>
                    {saving ? <><Spinner size='sm' className='me-2' />Guardando…</> : 'Cambiar contraseña y continuar'}
                  </Button>
                </Form>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ChangePasswordPage;
