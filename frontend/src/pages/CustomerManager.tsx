/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Modal, Form, Alert } from 'react-bootstrap';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { usePermissions } from '../hooks/permissions';
import type { RootState } from '../redux/store';
import { fetchCustomersStart, fetchCustomersSuccess, fetchCustomersFailure } from '../redux/slices/customerSlice';
import apiService from '../services/apiService';
import type { Customer } from '../interfaces/types';

const CustomerManager: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { customers } = useAppSelector((state: RootState) => state.customers);
  const { user } = useAppSelector(state => state.auth);
  const { hasPermission } = usePermissions();
  const canCreateCustomer = user?.role === 'admin' || hasPermission('crear_clientes');
  const canUpdateCustomer = user?.role === 'admin' || hasPermission('actualizar_clientes');
  const canDeleteCustomer = user?.role === 'admin' || hasPermission('eliminar_clientes');
  const canViewCustomerHistory = user?.role === 'admin' || (hasPermission('leer_factura') && hasPermission('leer_orden'));

  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    identificationType: 'cedula'
  });

  const loadCustomers = async () => {
    dispatch(fetchCustomersStart());
    try {
      const res = await apiService.getCustomers();
      dispatch(fetchCustomersSuccess(res.customers));
    } catch {
      dispatch(fetchCustomersFailure('Error al cargar clientes'));
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleSave = async () => {
    if (!formData.name || !formData.identificationType) return;
    if (editingCustomer ? !canUpdateCustomer : !canCreateCustomer) {
      setError('No tienes permiso para guardar este cliente.');
      return;
    }

    const payload = {
      name: formData.name,
      identificationType: formData.identificationType,
      identificationNumber: formData.identificationNumber || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      address: formData.address || undefined,
      isFinalConsumer: formData.isFinalConsumer || false
    };

    try {
      if (editingCustomer) {
        await apiService.updateCustomer(editingCustomer.id, payload);
      } else {
        await apiService.createCustomer(payload);
      }

      setShowModal(false);
      resetForm();
      loadCustomers();
    } catch (error) {
      console.error(error);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);

    setFormData({
      name: customer.name,
      identificationType: customer.identificationType || 'cedula',
      identificationNumber: customer.identificationNumber ?? undefined,
      address: customer.address || '',
      email: customer.email || '',
      phone: customer.phone || '',
      isFinalConsumer: customer.isFinalConsumer || false
    });

    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!canDeleteCustomer) {
      setError('No tienes permiso para eliminar clientes.');
      return;
    }
    if (!confirm('¿Eliminar cliente?')) return;
    try {
      await apiService.deleteCustomer(id);
      loadCustomers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Error eliminando cliente.');
    }
  };

  const resetForm = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setError('');

    setFormData({
      name: '',
      identificationType: 'cedula',
      identificationNumber: undefined,
      address: '',
      email: '',
      phone: '',
      isFinalConsumer: false
    });
  };

  return (
    <div className='mt-4'>
      <div className='d-flex justify-content-between mb-3'>
        <h4>Clientes</h4>
        {canCreateCustomer && <Button onClick={() => setShowModal(true)}>Nuevo Cliente</Button>}
      </div>

      <div className='row'>
        {customers.map(c => (
          <div key={c.id} className='col-md-4 mb-3'>
            <div className='card shadow-sm h-100'>
              <div className='card-body d-flex flex-column'>
                <h5 className='card-title'>{c.name}</h5>

                <p className='card-text mb-1'>
                  <strong>Identificación:</strong> {c.identificationType ? `${c.identificationType} - ${c.identificationNumber ?? ''}` : 'Consumidor Final'}
                </p>

                <p className='card-text mb-1'>
                  <strong>Correo:</strong> {c.email || '—'}
                </p>

                <p className='card-text mb-1'>
                  <strong>Teléfono:</strong> {c.phone || '—'}
                </p>

                <p className='card-text mb-3'>
                  <strong>Dirección:</strong> {c.address || '—'}
                </p>

                <div className='mt-auto d-flex justify-content-between'>
                  {canUpdateCustomer && <button className='btn' onClick={() => handleEdit(c)} aria-label={`Editar ${c.name}`}>
                    <svg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='#3b760e'>
                      <path d='M200-200h57l391-391-57-57-391 391v57Zm-40 80q-17 0-28.5-11.5T120-160v-97q0-16 6-30.5t17-25.5l505-504q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L313-143q-11 11-25.5 17t-30.5 6h-97Zm600-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z' />
                    </svg>
                  </button>}

                  {canViewCustomerHistory && <button className='btn' type='button' title='Ver historial de pedidos y facturas' aria-label={`Ver historial de ${c.name}`} onClick={() => navigate(`/customer/history/${c.id}`)}>
                    <svg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='#99970e'>
                      <path d='M240-80q-50 0-85-35t-35-85v-80q0-17 11.5-28.5T160-320h80v-536q0-7 6-9.5t11 2.5l29 29q6 6 14 6t14-6l32-32q6-6 14-6t14 6l32 32q6 6 14 6t14-6l32-32q6-6 14-6t14 6l32 32q6 6 14 6t14-6l32-32q6-6 14-6t14 6l32 32q6 6 14 6t14-6l32-32q6-6 14-6t14 6l32 32q6 6 14 6t14-6l29-29q5-5 11-2.5t6 9.5v656q0 50-35 85t-85 35H240Zm480-80q17 0 28.5-11.5T760-200v-560H320v440h320q17 0 28.5 11.5T680-280v80q0 17 11.5 28.5T720-160ZM400-680h160q17 0 28.5 11.5T600-640q0 17-11.5 28.5T560-600H400q-17 0-28.5-11.5T360-640q0-17 11.5-28.5T400-680Zm0 120h160q17 0 28.5 11.5T600-520q0 17-11.5 28.5T560-480H400q-17 0-28.5-11.5T360-520q0-17 11.5-28.5T400-560Zm280-40q-17 0-28.5-11.5T640-640q0-17 11.5-28.5T680-680q17 0 28.5 11.5T720-640q0 17-11.5 28.5T680-600Zm0 120q-17 0-28.5-11.5T640-520q0-17 11.5-28.5T680-560q17 0 28.5 11.5T720-520q0 17-11.5 28.5T680-480ZM240-160h360v-80H200v40q0 17 11.5 28.5T240-160Zm-40 0v-80 80Z' />
                    </svg>
                  </button>}

                  {canDeleteCustomer && <button className='btn' onClick={() => handleDelete(c.id)} aria-label={`Eliminar ${c.name}`}>
                    <svg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='#5D0E07'>
                      <path d='M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM428.5-291.5Q440-303 440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280q17 0 28.5-11.5Zm160 0Q600-303 600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280q17 0 28.5-11.5ZM280-720v520-520Z' />
                    </svg>
                  </button>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal show={showModal} onHide={resetForm}>
        <Modal.Header closeButton>
          <Modal.Title>{editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {error && <Alert variant='danger'>{error}</Alert>}

          <Form.Group className='mb-2'>
            <Form.Label>Nombre *</Form.Label>
            <Form.Control value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </Form.Group>

          {/*
          <Form.Check
            type='checkbox'
            label='Consumidor Final'
            checked={formData.isFinalConsumer || false}
            onChange={e =>
              setFormData({
                ...formData,
                isFinalConsumer: e.target.checked,
                identificationType: e.target.checked ? 'none' : 'cedula',
                identificationNumber: undefined
              })
            }
            className='mb-3'
          />
          */}

          {!formData.isFinalConsumer && (
            <>
              <Form.Group className='mb-2'>
                <Form.Label>Tipo *</Form.Label>
                <Form.Select
                  value={formData.identificationType}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      identificationType: e.target.value as any
                    })
                  }
                >
                  <option value='cedula'>Cédula</option>
                  <option value='ruc'>RUC</option>
                  {/*<option value='passport'>Pasaporte</option>*/}
                </Form.Select>
              </Form.Group>

              <Form.Group className='mb-2'>
                <Form.Label>Número *</Form.Label>
                <Form.Control
                  type='text'
                  value={formData.identificationNumber || ''}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      identificationNumber: e.target.value,
                      identificationType: e.target.value.length > 10 ? 'ruc' : 'cedula'
                    })
                  }
                />
              </Form.Group>
            </>
          )}

          <Form.Group className='mb-2'>
            <Form.Label>Dirección</Form.Label>
            <Form.Control value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} />
          </Form.Group>

          <Form.Group className='mb-2'>
            <Form.Label>Correo</Form.Label>
            <Form.Control type='email' value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value.toLowerCase() })} />
          </Form.Group>

          <Form.Group className='mb-2'>
            <Form.Label>Teléfono</Form.Label>
            <Form.Control value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant='secondary' onClick={resetForm}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Guardar</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CustomerManager;
