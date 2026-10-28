import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, ButtonGroup, Card, Spinner, Table } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import type { Customer } from '../interfaces/types';
import type { Invoice, Order } from '../../../shared/types';
import { useAppSelector } from '../hooks/redux';
import { usePermissions } from '../hooks/permissions';
import apiService from '../services/apiService';

type InvoiceFilter = 'all' | Invoice['status'];
type OrderFilter = 'all' | 'pending' | 'paid' | 'cancelled';

const formatCurrency = (value: number) => `$${Number(value || 0).toFixed(2)}`;

const formatDate = (value: string) => new Date(value).toLocaleString();

const invoiceStatusLabel: Record<Invoice['status'], string> = {
  pending: 'Pendiente',
  paid: 'Pagada',
  cancelled: 'Cancelada'
};

const invoiceStatusVariant: Record<Invoice['status'], string> = {
  pending: 'warning',
  paid: 'success',
  cancelled: 'danger'
};

const orderStatusLabel = (status: string) => {
  if (status === 'pendiente') return 'Pendiente';
  if (status === 'parcial') return 'En proceso';
  if (status === 'completado' || status === 'facturado') return 'Completado';
  if (status === 'cancelado' || status === 'cancelled') return 'Cancelado';
  return status;
};

const orderStatusVariant = (status: string) => {
  if (status === 'pendiente') return 'warning';
  if (status === 'parcial') return 'info';
  if (status === 'completado' || status === 'facturado') return 'success';
  if (status === 'cancelado' || status === 'cancelled') return 'danger';
  return 'secondary';
};

const HistoryClient: React.FC = () => {
  const { customerId: routeCustomerId } = useParams<{ customerId: string }>();
  //const navigate = useNavigate();
  const user = useAppSelector(state => state.auth.user);
  const isAdmin = user?.role === 'admin';
  const customerId = Number(routeCustomerId);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('all');
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { hasPermission } = usePermissions();

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      if (!Number.isInteger(customerId) || customerId <= 0) {
        setError('El identificador del cliente en la ruta no es válido.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const [customerResponse, invoiceResponse, orderResponse, cancelledInvoiceResponse] = await Promise.all([
          apiService.getCustomers(),
          apiService.getInvoices({ customerId, limit: 1000 }),
          apiService.getOrders({ customerId }),
          isAdmin ? apiService.getInvoices({ customerId, status: 'cancelled', limit: 1000 }) : Promise.resolve({ invoices: [], totalCount: 0 })
        ]);

        if (!active) return;

        const selectedCustomer = customerResponse.customers.find(item => item.id === customerId);
        if (!selectedCustomer) {
          setCustomer(null);
          setError('No se encontró el cliente solicitado.');
          return;
        }

        setCustomer(selectedCustomer);
        setInvoices([...invoiceResponse.invoices, ...cancelledInvoiceResponse.invoices]);
        setOrders(orderResponse.orders);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el historial del cliente.');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadHistory();

    return () => {
      active = false;
    };
  }, [customerId, isAdmin]);

  const filteredInvoices = useMemo(() => (invoiceFilter === 'all' ? invoices : invoices.filter(invoice => invoice.status === invoiceFilter)), [invoiceFilter, invoices]);

  const filteredOrders = useMemo(
    () =>
      orders.filter(order => {
        const status = String(order.status);
        if (orderFilter === 'all') return true;
        if (orderFilter === 'pending') return status === 'pendiente' || status === 'parcial';
        if (orderFilter === 'paid') return status === 'completado' || status === 'facturado';
        return status === 'cancelado' || status === 'cancelled';
      }),
    [orderFilter, orders]
  );

  return (
    <main className='container py-4 history-client-page'>
      <div className='history-client-header'>
        <div className='history-client-heading'>
          <h1 className='h3 mb-1'>Historial del cliente</h1>
          <p className='text-muted mb-0 history-client-name'>{customer?.name || 'Cargando cliente...'}</p>
        </div>
      </div>

      {error && <Alert variant='danger'>{error}</Alert>}
      {!isAdmin && <Alert variant='info'>Las facturas canceladas solo están disponibles para administradores.</Alert>}

      {loading ? (
        <div className='text-center py-5'>
          <Spinner animation='border' role='status' />
          <p className='text-muted mt-2 mb-0'>Cargando historial...</p>
        </div>
      ) : (
        !error && (
          <>
            <Card className='mb-4 history-client-section'>
              <Card.Header className='history-client-section-header'>
                <h2 className='h5 mb-0'>Pedidos</h2>
                <ButtonGroup className='history-client-filters' aria-label='Filtrar pedidos por estado'>
                  {(
                    [
                      ['all', 'Todos'],
                      ['pending', 'Pendientes'],
                      ['paid', 'Completados'],
                      ['cancelled', 'Cancelados']
                    ] as const
                  ).map(([filter, label]) => (
                    <Button key={filter} size='sm' variant={orderFilter === filter ? 'primary' : 'outline-primary'} onClick={() => setOrderFilter(filter)}>
                      {label}
                    </Button>
                  ))}
                </ButtonGroup>
              </Card.Header>
              <Card.Body className='p-0 history-client-section-body'>
                <div className='d-none d-md-block table-responsive'>
                  <Table hover className='mb-0 align-middle history-client-table'>
                    <thead>
                      <tr>
                        <th>Pedido</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th>Total</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map(order => (
                        <tr key={order.id}>
                          <td>#{order.id}</td>
                          <td>{order.type}</td>
                          <td>
                            <Badge bg={orderStatusVariant(String(order.status))}>{orderStatusLabel(String(order.status))}</Badge>
                          </td>
                          <td>{formatCurrency(order.total)}</td>
                          <td>{formatDate(order.createdAt)}</td>
                        </tr>
                      ))}
                      {filteredOrders.length === 0 && (
                        <tr>
                          <td colSpan={5} className='text-center text-muted py-4'>
                            No hay pedidos con este estado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
                <div className='d-md-none history-client-mobile-list'>
                  {filteredOrders.map(order => (
                    <article className='history-client-record' key={order.id}>
                      <div className='history-client-record-heading'>
                        <strong>Pedido #{order.id}</strong>
                        <Badge bg={orderStatusVariant(String(order.status))}>{orderStatusLabel(String(order.status))}</Badge>
                      </div>
                      <dl className='history-client-record-details'>
                        <div>
                          <dt>Tipo</dt>
                          <dd>{order.type}</dd>
                        </div>
                        <div>
                          {hasPermission('ver_totales') && <dt>Total</dt>}
                          <dd>{formatCurrency(order.total)}</dd>
                        </div>
                        <div className='history-client-record-date'>
                          <dt>Fecha</dt>
                          <dd>{formatDate(order.createdAt)}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                  {filteredOrders.length === 0 && <p className='history-client-empty'>No hay pedidos con este estado.</p>}
                </div>
              </Card.Body>
            </Card>

            <Card className='history-client-section'>
              <Card.Header className='history-client-section-header'>
                <h2 className='h5 mb-0'>Facturas</h2>
                <ButtonGroup className='history-client-filters' aria-label='Filtrar facturas por estado'>
                  {(
                    [
                      ['all', 'Todas'],
                      ['pending', 'Pendientes'],
                      ['paid', 'Pagadas'],
                      ['cancelled', 'Canceladas']
                    ] as const
                  ).map(([filter, label]) => (
                    <Button key={filter} size='sm' disabled={filter === 'cancelled' && !isAdmin} variant={invoiceFilter === filter ? 'primary' : 'outline-primary'} onClick={() => setInvoiceFilter(filter)}>
                      {label}
                    </Button>
                  ))}
                </ButtonGroup>
              </Card.Header>
              <Card.Body className='p-0 history-client-section-body'>
                <div className='d-none d-md-block table-responsive'>
                  <Table hover className='mb-0 align-middle history-client-table'>
                    <thead>
                      <tr>
                        <th>Factura</th>
                        <th>Estado</th>
                        <th>Total</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map(invoice => (
                        <tr key={invoice.id}>
                          <td>{invoice.invoiceNumber}</td>
                          <td>
                            <Badge bg={invoiceStatusVariant[invoice.status]}>{invoiceStatusLabel[invoice.status]}</Badge>
                          </td>
                          <td>{formatCurrency(invoice.total)}</td>
                          <td>{formatDate(invoice.createdAt)}</td>
                        </tr>
                      ))}
                      {filteredInvoices.length === 0 && (
                        <tr>
                          <td colSpan={4} className='text-center text-muted py-4'>
                            No hay facturas con este estado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
                <div className='d-md-none history-client-mobile-list'>
                  {filteredInvoices.map(invoice => (
                    <article className='history-client-record' key={invoice.id}>
                      <div className='history-client-record-heading'>
                        <strong>{invoice.invoiceNumber}</strong>
                        <Badge bg={invoiceStatusVariant[invoice.status]}>{invoiceStatusLabel[invoice.status]}</Badge>
                      </div>
                      <strong>{invoice.invoiceNumberExternal}</strong>
                      <dl className='history-client-record-details'>
                        <div>
                          {hasPermission('ver_totales') && <dt>Total</dt>}
                          <dd>{formatCurrency(invoice.total)}</dd>
                        </div>
                        <div className='history-client-record-date'>
                          <dt>Fecha</dt>
                          <dd>{formatDate(invoice.createdAt)}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                  {filteredInvoices.length === 0 && <p className='history-client-empty'>No hay facturas con este estado.</p>}
                </div>
              </Card.Body>
            </Card>
          </>
        )
      )}
    </main>
  );
};

export default HistoryClient;
