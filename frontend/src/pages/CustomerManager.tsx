/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { Button, Modal, Form, Alert } from 'react-bootstrap';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import type { RootState } from '../redux/store';
import { fetchCustomersStart, fetchCustomersSuccess, fetchCustomersFailure } from '../redux/slices/customerSlice';
import apiService from '../services/apiService';
import type { Customer } from '../interfaces/types';

const CustomerManager: React.FC = () => {
  const dispatch = useAppDispatch();
  const { customers } = useAppSelector((state: RootState) => state.customers);

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
    if (!confirm('¿Eliminar cliente?')) return;
    await apiService.deleteCustomer(id);
    loadCustomers();
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
        <Button onClick={() => setShowModal(true)}>Nuevo Cliente</Button>
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
                  <Button size='sm' variant='warning' onClick={() => handleEdit(c)}>
                    Editar
                  </Button>

                  <Button size='sm' variant='danger' onClick={() => handleDelete(c.id)}>
                    Eliminar
                  </Button>
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
                  <option value='passport'>Pasaporte</option>
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
                      identificationNumber: e.target.value
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
            <Form.Control type='email' value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
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
