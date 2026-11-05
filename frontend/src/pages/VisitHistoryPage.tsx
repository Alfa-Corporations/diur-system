import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Spinner } from 'react-bootstrap';
import { useAppSelector } from '../hooks/redux';
import { usePermissions } from '../hooks/permissions';
import apiService from '../services/apiService';
import type { Customer } from '../interfaces/types';
import type { User, Visit } from '../../../shared/types';

const formatDuration = (seconds?: number | null) => {
  if (seconds === null || seconds === undefined) return 'En curso';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours) return `${hours} h ${minutes} min`;
  if (minutes) return `${minutes} min`;
  return `${remainingSeconds} seg`;
};

const VisitHistoryPage: React.FC = () => {
  const { user } = useAppSelector(state => state.auth);
  const { hasPermission } = usePermissions();
  const isAdmin = user?.role === 'admin';
  const canReadVisits = isAdmin || hasPermission('leer_visitas');
  const canReadCustomers = isAdmin || hasPermission('leer_clientes');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<User[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadVisits = useCallback(async () => {
    if (!canReadVisits) return;
    setLoading(true);
    setError('');
    try {
      const result = await apiService.getVisits({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        customerId: customerId ? Number(customerId) : undefined,
        userId: isAdmin && sellerId ? Number(sellerId) : undefined
      });
      setVisits(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el historial de visitas.');
    } finally {
      setLoading(false);
    }
  }, [canReadVisits, customerId, dateFrom, dateTo, isAdmin, sellerId]);

  useEffect(() => {
    void loadVisits();
  }, [loadVisits]);

  useEffect(() => {
    if (!canReadCustomers) return;
    apiService.getCustomers()
      .then(result => setCustomers(result.customers))
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los clientes para el filtro.'));
  }, [canReadCustomers]);

  useEffect(() => {
    if (!isAdmin) return;
    apiService.getUsers()
      .then(result => setSellers(result.filter(item => item.role === 'vendedor')))
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los vendedores.'));
  }, [isAdmin]);

  const stats = useMemo(() => ({
    total: visits.length,
    active: visits.filter(visit => !visit.departureAt).length,
    completed: visits.filter(visit => Boolean(visit.departureAt)).length,
    duration: visits.reduce((total, visit) => total + (visit.durationSeconds || 0), 0)
  }), [visits]);
  const sellerVisitCounts = useMemo(() => {
    const counts = new Map<number, { name: string; count: number }>();
    visits.forEach(visit => {
      const current = counts.get(visit.userId);
      counts.set(visit.userId, {
        name: visit.user?.username || `Usuario #${visit.userId}`,
        count: (current?.count || 0) + 1
      });
    });
    return [...counts.values()].sort((first, second) => second.count - first.count);
  }, [visits]);

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setCustomerId('');
    setSellerId('');
  };

  return (
    <main className='container py-4 visit-history-page'>
      <header className='d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4'>
        <div>
          <span className='text-uppercase text-muted small fw-bold'>Seguimiento comercial</span>
          <h1 className='h2 mb-1'>{isAdmin ? 'Historial de visitas' : 'Mis visitas'}</h1>
          <p className='mb-0'>{isAdmin ? 'Consulta la actividad y el detalle de las visitas realizadas por los vendedores.' : 'Consulta los detalles y duración de tus visitas anteriores.'}</p>
        </div>
        <Button variant='outline-primary' onClick={() => void loadVisits()} disabled={loading}>
          {loading ? <Spinner size='sm' /> : 'Actualizar'}
        </Button>
      </header>

      {error && <Alert variant='danger' dismissible onClose={() => setError('')}>{error}</Alert>}
      {!canReadVisits && <Alert variant='warning'>Tu cuenta no tiene el permiso para consultar el historial de visitas.</Alert>}

      {canReadVisits && <>
        <div className='row g-3 mb-4'>
          <div className='col-12 col-sm-4'>
            <Card className='h-100 shadow-sm border-0'><Card.Body><div className='text-muted small'>Visitas encontradas</div><div className='fs-3 fw-bold'>{stats.total}</div></Card.Body></Card>
          </div>
          <div className='col-12 col-sm-4'>
            <Card className='h-100 shadow-sm border-0'><Card.Body><div className='text-muted small'>Finalizadas / en curso</div><div className='fs-3 fw-bold'>{stats.completed} / {stats.active}</div></Card.Body></Card>
          </div>
          <div className='col-12 col-sm-4'>
            <Card className='h-100 shadow-sm border-0'><Card.Body><div className='text-muted small'>Duración acumulada</div><div className='fs-3 fw-bold'>{formatDuration(stats.duration)}</div></Card.Body></Card>
          </div>
        </div>
        {isAdmin && sellerVisitCounts.length > 0 && (
          <Card className='shadow-sm border-0 mb-4'>
            <Card.Body>
              <h2 className='h6 mb-3'>Visitas por vendedor</h2>
              <div className='d-flex flex-wrap gap-2'>
                {sellerVisitCounts.map(seller => <Badge bg='light' text='dark' className='border p-2' key={seller.name}>{seller.name}: {seller.count}</Badge>)}
              </div>
            </Card.Body>
          </Card>
        )}

        <Card className='shadow-sm border-0 mb-4'>
          <Card.Body>
            <Form onSubmit={event => { event.preventDefault(); void loadVisits(); }}>
              <div className='row g-3 align-items-end'>
                <Form.Group className='col-12 col-md-3'>
                  <Form.Label>Desde</Form.Label>
                  <Form.Control type='date' value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} />
                </Form.Group>
                <Form.Group className='col-12 col-md-3'>
                  <Form.Label>Hasta</Form.Label>
                  <Form.Control type='date' value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} />
                </Form.Group>
                {canReadCustomers && <Form.Group className='col-12 col-md-4'>
                  <Form.Label>Cliente</Form.Label>
                  <Form.Select value={customerId} onChange={event => setCustomerId(event.target.value)}>
                    <option value=''>Todos los clientes</option>
                    {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name} · #{customer.id}</option>)}
                  </Form.Select>
                </Form.Group>}
                {isAdmin && <Form.Group className='col-12 col-md-4'>
                  <Form.Label>Vendedor</Form.Label>
                  <Form.Select value={sellerId} onChange={event => setSellerId(event.target.value)}>
                    <option value=''>Todos los vendedores</option>
                    {sellers.map(seller => <option key={seller.id} value={seller.id}>{seller.username}</option>)}
                  </Form.Select>
                </Form.Group>}
                <div className='col-12 col-md-2 d-flex gap-2'>
                  <Button type='submit' className='flex-grow-1'>Filtrar</Button>
                  <Button type='button' variant='outline-secondary' onClick={resetFilters}>Limpiar</Button>
                </div>
              </div>
            </Form>
          </Card.Body>
        </Card>

        {loading ? <div className='text-center py-5'><Spinner /> <span className='ms-2'>Cargando visitas…</span></div> : visits.length === 0 ? (
          <Card className='shadow-sm border-0'><Card.Body className='text-center py-5 text-muted'>No hay visitas para los filtros seleccionados.</Card.Body></Card>
        ) : (
          <div className='d-grid gap-3'>
            {visits.map(visit => (
              <Card className='shadow-sm border-0' key={visit.id}>
                <Card.Body>
                  <div className='d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3'>
                    <div>
                      <h2 className='h5 mb-1'>{visit.customer?.name || `Cliente #${visit.customerId}`}</h2>
                      <div className='text-muted small'>Visita #{visit.id} · {new Date(`${visit.visitDate}T00:00:00`).toLocaleDateString()}</div>
                    </div>
                    <Badge bg={visit.departureAt ? 'success' : 'warning'} text={visit.departureAt ? undefined : 'dark'}>{visit.departureAt ? 'Finalizada' : 'En curso'}</Badge>
                  </div>
                  <div className='row g-3'>
                    {isAdmin && <div className='col-12 col-md-3'><div className='text-muted small'>Vendedor</div><strong>{visit.user?.username || `Usuario #${visit.userId}`}</strong></div>}
                    <div className='col-6 col-md-2'><div className='text-muted small'>Llegada</div><strong>{new Date(visit.arrivalAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div>
                    <div className='col-6 col-md-2'><div className='text-muted small'>Salida</div><strong>{visit.departureAt ? new Date(visit.departureAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</strong></div>
                    <div className='col-6 col-md-2'><div className='text-muted small'>Duración</div><strong>{formatDuration(visit.durationSeconds)}</strong></div>
                    <div className='col-12 col-md-3'><div className='text-muted small'>Ubicación GPS</div><a href={`https://www.google.com/maps?q=${visit.latitude},${visit.longitude}`} target='_blank' rel='noreferrer'>{Number(visit.latitude).toFixed(6)}, {Number(visit.longitude).toFixed(6)}</a></div>
                  </div>
                  <div className='mt-3 pt-3 border-top'>
                    <div className='text-muted small'>Dirección registrada</div>
                    <strong>{visit.street}, {visit.city}, {visit.province}, {visit.country}</strong>
                  </div>
                </Card.Body>
              </Card>
            ))}
          </div>
        )}
      </>}
    </main>
  );
};

export default VisitHistoryPage;
