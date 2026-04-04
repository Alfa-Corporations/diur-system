import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/redux';
import apiService from '../services/apiService';
import type { User, Permission } from '../../../shared/types';

const UserManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector(state => state.auth);
  const { isOnline } = useAppSelector(state => state.sync);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formState, setFormState] = useState({ username: '', email: '', role: 'cashier' as User['role'], isActive: true });

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedPermissionUser, setSelectedPermissionUser] = useState<User | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [permissionLoading, setPermissionLoading] = useState(false);

  const currentUserRole = user?.role;
  const isAdmin = currentUserRole === 'admin';

  const loadUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiService.getUsers();
      setUsers(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar usuarios';
      setError(message);

      if (!isOnline) {
        setError('No está conectado. Intente de nuevo cuando vuelva la red.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [isOnline]);

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const allPermissions = await apiService.getPermissions();
        setPermissions(allPermissions);
      } catch (err: unknown) {
        console.error('Error cargando permisos:', err);
      }
    };

    void loadPermissions();
  }, []);

  const resetForm = () => {
    setEditingUser(null);
    setFormState({ username: '', email: '', role: 'cashier', isActive: true });
  };

  const handleUserClick = (selected: User) => {
    setEditingUser(selected);
    setFormState({ username: selected.username, email: selected.email, role: selected.role, isActive: selected.isActive });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isAdmin) {
      setError('Solo administradores pueden gestionar usuarios.');
      return;
    }

    try {
      if (editingUser) {
        const updated = await apiService.updateUser(editingUser.id, {
          username: formState.username,
          email: formState.email,
          role: formState.role,
          isActive: formState.isActive
        });
        setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)));
      } else {
        const created = await apiService.createUser({
          username: formState.username,
          email: formState.email,
          password: '123456',
          role: formState.role
        });
        setUsers(prev => [created, ...prev]);
      }

      resetForm();
      setShowForm(false);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error guardando usuario';
      setError(message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) {
      setError('Solo administradores pueden eliminar usuarios.');
      return;
    }

    if (!window.confirm('¿Eliminar usuario?')) return;

    try {
      await apiService.deleteUser(id);
      setUsers(prev => prev.filter(user => user.id !== id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error eliminando usuario';
      setError(message);
    }
  };

  const startPermissionSession = async (targetUser: User) => {
    if (!isAdmin) {
      setPermissionError('Solo administradores pueden gestionar permisos.');
      return;
    }

    setPermissionLoading(true);
    setPermissionError(null);
    setSelectedPermissionUser(targetUser);

    try {
      const userPermissions = await apiService.getUserPermissions(targetUser.id);
      setSelectedPermissionIds(userPermissions.map(p => p.id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar permisos del usuario.';
      setPermissionError(message);
    } finally {
      setPermissionLoading(false);
    }
  };

  const togglePermission = (permissionId: number) => {
    setSelectedPermissionIds(prev => (prev.includes(permissionId) ? prev.filter(id => id !== permissionId) : [...prev, permissionId]));
  };

  const savePermissions = async () => {
    if (!selectedPermissionUser) return;
    if (!isAdmin) {
      setPermissionError('Solo administradores pueden guardar permisos.');
      return;
    }

    setPermissionLoading(true);
    setPermissionError(null);

    try {
      await apiService.assignPermissions(selectedPermissionUser.id, selectedPermissionIds);
      setError(null);
      setSelectedPermissionUser(null);
      setSelectedPermissionIds([]);
      await loadUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error guardando permisos.';
      setPermissionError(message);
    } finally {
      setPermissionLoading(false);
    }
  };

  const cancelPermissionSession = () => {
    setSelectedPermissionUser(null);
    setSelectedPermissionIds([]);
    setPermissionError(null);
  };

  return (
    <div className='page-shell container-fluid p-4'>
      <div className='page-header'>
        <div>
          <span className='eyebrow mb-2'>Usuarios</span>
          <h2 className='mb-1'>Gestión de Usuarios</h2>
          <p className='mb-0'>Crea, edita y elimina cuentas (solo admin).</p>
        </div>
        <div className='page-actions'>
          <button className='btn btn-outline-dark' onClick={() => navigate(-1)}>
            ← Volver
          </button>
          <button className='btn btn-outline-secondary' onClick={() => void loadUsers()}>
            Actualizar
          </button>
          {isAdmin && (
            <button
              className='btn btn-primary'
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              ➕ Nuevo Usuario
            </button>
          )}
        </div>
      </div>

      {!isOnline && <div className='alert offline-banner'>⚠️ Modo offline: solo puede ver la caché de usuarios (no hay soporte offline completo aún).</div>}
      {error && <div className='alert alert-danger'>{error}</div>}

      <div className='section-card mb-3'>
        {showForm && (
          <form onSubmit={handleSubmit} className='row g-3'>
            <div className='col-12 col-md-3'>
              <label className='form-label'>Usuario</label>
              <input value={formState.username} onChange={e => setFormState(prev => ({ ...prev, username: e.target.value }))} required className='form-control' />
            </div>
            <div className='col-12 col-md-3'>
              <label className='form-label'>Email</label>
              <input type='email' value={formState.email} onChange={e => setFormState(prev => ({ ...prev, email: e.target.value }))} required className='form-control' />
            </div>
            <div className='col-12 col-md-3'>
              <label className='form-label'>Rol</label>
              <select value={formState.role} onChange={e => setFormState(prev => ({ ...prev, role: e.target.value as User['role'] }))} className='form-select'>
                <option value='admin'>admin</option>
                <option value='cashier'>cashier</option>
                <option value='warehouse'>warehouse</option>
                <option value='delivery'>delivery</option>
              </select>
            </div>
            <div className='col-12 col-md-2'>
              <label className='form-label'>Estado</label>
              <select value={formState.isActive ? 'active' : 'inactive'} onChange={e => setFormState(prev => ({ ...prev, isActive: e.target.value === 'active' }))} className='form-select'>
                <option value='active'>Activo</option>
                <option value='inactive'>Inactivo</option>
              </select>
            </div>
            <div className='col-12 col-md-1 d-flex align-items-end'>
              <button type='submit' className='btn btn-success w-100'>
                {editingUser ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </form>
        )}
      </div>

      {selectedPermissionUser && (
        <div className='section-card mb-3'>
          <div className='d-flex justify-content-between align-items-center mb-2'>
            <h4>Asignar permisos a {selectedPermissionUser.username}</h4>
            <button className='btn btn-sm btn-outline-secondary' onClick={cancelPermissionSession}>
              Cancelar
            </button>
          </div>

          {permissionError && <div className='alert alert-danger'>{permissionError}</div>}

          {permissionLoading ? (
            <div>Cargando permisos del usuario...</div>
          ) : (
            <div className='row g-2'>
              {permissions.map(permission => (
                <div key={permission.id} className='col-6 col-md-4'>
                  <div className='form-check'>
                    <input id={`perm-${permission.id}`} type='checkbox' className='form-check-input' checked={selectedPermissionIds.includes(permission.id)} onChange={() => togglePermission(permission.id)} />
                    <label htmlFor={`perm-${permission.id}`} className='form-check-label'>
                      {permission.name}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className='mt-3'>
            <button className='btn btn-success me-2' disabled={permissionLoading} onClick={savePermissions}>
              Guardar permisos
            </button>
            <button className='btn btn-outline-secondary' onClick={cancelPermissionSession}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      <div className='section-card'>
        <div className='table-responsive'>
          <table className='table table-hover table-modern mb-0'>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className='text-center'>
                    Cargando usuarios...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className='text-center'>
                    Sin usuarios
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>{u.isActive ? 'Activo' : 'Inactivo'}</td>
                    <td>
                      <button className='btn btn-sm btn-outline-primary me-2' onClick={() => startPermissionSession(u)}>
                        Permisos
                      </button>
                      <button className='btn btn-sm btn-outline-secondary me-2' onClick={() => handleUserClick(u)}>
                        Editar
                      </button>
                      <button className='btn btn-sm btn-outline-danger' onClick={() => handleDelete(u.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagementPage;
