import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Card, Form, Modal, Spinner } from 'react-bootstrap';
import { Html5Qrcode } from 'html5-qrcode';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { updateProfile } from '../redux/slices/authSlice';
import { usePermissions } from '../hooks/permissions';
import apiService from '../services/apiService';
import PushNotificationSettings from '../components/PushNotificationSettings';
import InstallAppButton from '../components/InstallAppButton';
import type { Customer } from '../interfaces/types';
import type { Order } from '../../../shared/types';

type Visit = {
  id: number;
  customerId: number;
  arrivalAt: string;
  departureAt?: string | null;
  city: string;
  province: string;
  street: string;
  latitude: number;
  longitude: number;
  customer?: Customer;
};

type VisitAddress = {
  street: string;
  city: string;
  province: string;
  country: string;
};

const DashboardVisitor: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(state => state.auth);
  const { notifications } = useAppSelector(state => state.sync);
  const { hasPermission } = usePermissions();
  const isAdmin = user?.role === 'admin';
  const canReadCustomers = isAdmin || hasPermission('leer_clientes');
  const canCreateCustomers = isAdmin || hasPermission('crear_clientes');
  const canUpdateCustomers = isAdmin || hasPermission('actualizar_clientes');
  const canDeleteCustomers = isAdmin || hasPermission('eliminar_clientes');
  const canCreateOrders = isAdmin || hasPermission('crear_orden');
  const canReadOrders = isAdmin || hasPermission('leer_orden');
  const canAccessReceivables = isAdmin || hasPermission('leer_factura') || hasPermission('actualizar_factura');
  const canManageVisits = isAdmin || hasPermission('gestionar_visitas');
  const canReadVisits = isAdmin || hasPermission('leer_visitas');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingOrdersTotal, setPendingOrdersTotal] = useState(0);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [showVisit, setShowVisit] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [step, setStep] = useState<'select' | 'create' | 'location'>('select');
  const [code, setCode] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [orderFilter, setOrderFilter] = useState<'all' | 'pendiente' | 'parcial' | 'completado' | 'cancelado'>('all');
  const [customerForm, setCustomerForm] = useState({
    name: '',
    identificationType: 'cedula' as Customer['identificationType'],
    identificationNumber: '',
    phone: '',
    email: '',
    address: ''
  });
  const [visitAddress, setVisitAddress] = useState<VisitAddress>({
    street: '',
    city: '',
    province: '',
    country: ''
  });

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  }, []);

  useEffect(() => {
    apiService.getProfile()
      .then(profile => dispatch(updateProfile(profile)))
      .catch(profileError => {
        setError(profileError instanceof Error ? profileError.message : 'No se pudieron actualizar tus permisos.');
      });
  }, [dispatch]);

  const loadCustomers = useCallback(async () => {
    if (!canReadCustomers) return;
    try {
      const result = await apiService.getCustomers();
      setCustomers(result.customers);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los clientes.');
    }
  }, [canReadCustomers]);

  const loadCustomerOrders = useCallback(async (customerId: number) => {
    if (!canReadOrders) {
      setOrders([]);
      return;
    }
    try {
      const result = await apiService.getOrders({ customerId });
      setOrders(result.orders);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las órdenes del cliente.');
    }
  }, [canReadOrders]);

  useEffect(() => {
    void loadCustomers();
    if (canReadOrders) {
      apiService.getOrders({ status: 'pendiente' })
        .then(result => setPendingOrdersTotal(result.orders.length))
        .catch(loadError => setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las órdenes pendientes.'));
    }
    if (canReadVisits) {
      apiService.getVisits()
        .then(visits => {
          const visit = visits.find(item => !item.departureAt);
          if (visit?.customer) {
            setActiveVisit(visit);
            setCustomer(visit.customer);
            void loadCustomerOrders(visit.customerId);
          }
        })
        .catch(loadError => setError(loadError instanceof Error ? loadError.message : 'No se pudo recuperar la visita activa.'));
    }
  }, [canManageVisits, canReadOrders, canReadVisits, loadCustomerOrders, loadCustomers]);

  const openVisitFlow = () => {
    setError('');
    setNotice('');
    setStep('select');
    setCode('');
    setCustomerForm({
      name: '',
      identificationType: 'cedula',
      identificationNumber: '',
      phone: '',
      email: '',
      address: ''
    });
    setShowVisit(true);
  };

  const chooseCustomer = (selected: Customer) => {
    setCustomer(selected);
    setVisitAddress({
      street: selected.address || '',
      city: '',
      province: '',
      country: ''
    });
    setStep('location');
    setError('');
  };

  const resolveCustomer = useCallback((rawCode: string) => {
    let lookup = rawCode.trim();
    try {
      const parsedUrl = new URL(lookup);
      lookup = parsedUrl.searchParams.get('customerId') || parsedUrl.searchParams.get('id') || parsedUrl.pathname.split('/').filter(Boolean).pop() || lookup;
    } catch {
      // QR content can be a plain customer code rather than a URL.
    }
    const match = customers.find(item =>
      String(item.id) === lookup ||
      String(item.identificationNumber || '').toLowerCase() === lookup.toLowerCase()
    );
    if (!match) {
      setError('No encontramos un cliente con ese código. Verifica el código o escanea su QR.');
      return;
    }
    chooseCustomer(match);
  }, [customers]);

  useEffect(() => {
    if (!showScanner) return;
    const scanner = new Html5Qrcode('visitor-customer-reader');
    let active = true;
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 230 },
      async value => {
        if (!active) return;
        active = false;
        setCode(value);
        setShowScanner(false);
        await scanner.stop().catch(() => undefined);
        resolveCustomer(value);
      },
      () => undefined
    ).catch(scannerError => {
      if (active) setError(scannerError instanceof Error ? scannerError.message : 'No se pudo iniciar la cámara.');
    });
    return () => {
      active = false;
      if (scanner.isScanning) void scanner.stop().catch(() => undefined);
    };
  }, [resolveCustomer, showScanner]);

  const createCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canCreateCustomers) {
      setError('No tienes permiso para crear clientes.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const created = await apiService.createCustomer({
        name: customerForm.name.trim(),
        identificationType: customerForm.identificationType || 'cedula',
        identificationNumber: customerForm.identificationNumber.trim() || undefined,
        phone: customerForm.phone.trim() || undefined,
        email: customerForm.email.trim() || undefined,
        address: customerForm.address.trim() || undefined
      });
      setCustomers(previous => [...previous, created]);
      setCustomer(created);
      setVisitAddress({ street: created.address || '', city: '', province: '', country: '' });
      setStep('location');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear el cliente.');
    } finally {
      setBusy(false);
    }
  };

  const startVisit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageVisits) {
      setError('Tu usuario no tiene el permiso “gestionar_visitas”. Solicita al administrador que lo active y vuelve a entrar al dashboard.');
      return;
    }
    if (!customer) {
      setError('Selecciona o crea un cliente antes de iniciar la visita.');
      return;
    }
    if (!visitAddress.street.trim() || !visitAddress.city.trim() || !visitAddress.province.trim() || !visitAddress.country.trim()) {
      setError('Completa calle, ciudad, provincia y país para registrar la visita.');
      return;
    }
    if (!navigator.geolocation) {
      setError('Este dispositivo no permite geolocalización. No se puede registrar la visita sin coordenadas.');
      return;
    }
    setBusy(true);
    setError('');
    const now = new Date();
    const visitDate = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    navigator.geolocation.getCurrentPosition(async position => {
      try {
        const visit = await apiService.startVisit({
          customerId: customer.id,
          visitDate,
          ...visitAddress,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setActiveVisit(visit);
        setShowVisit(false);
        await loadCustomerOrders(customer.id);
      } catch (startError) {
        setError(startError instanceof Error ? startError.message : 'No se pudo registrar la visita.');
      } finally {
        setBusy(false);
      }
    }, locationError => {
      setBusy(false);
      setError(`No se pudo obtener la ubicación (${locationError.message}). Habilita el GPS y el permiso de ubicación para continuar.`);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const finishVisit = async () => {
    if (!activeVisit) return;
    setBusy(true);
    setError('');
    try {
      await apiService.finishVisit(activeVisit.id);
      setActiveVisit(null);
      setCustomer(null);
      setOrders([]);
      setNotice('Visita registrada correctamente.');
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : 'No se pudo cerrar la visita.');
    } finally {
      setBusy(false);
    }
  };

  const saveCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!customer || !canUpdateCustomers) return;
    setBusy(true);
    setError('');
    try {
      const updated = await apiService.updateCustomer(customer.id, {
        name: customerForm.name.trim(),
        identificationType: customerForm.identificationType,
        identificationNumber: customerForm.identificationNumber.trim() || undefined,
        phone: customerForm.phone.trim() || undefined,
        email: customerForm.email.trim() || undefined,
        address: customerForm.address.trim() || undefined
      });
      setCustomer(updated);
      setCustomers(previous => previous.map(item => item.id === updated.id ? updated : item));
      setShowEdit(false);
      setNotice('Información del cliente actualizada.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar el cliente.');
    } finally {
      setBusy(false);
    }
  };

  const openEdit = () => {
    if (!customer) return;
    setCustomerForm({
      name: customer.name,
      identificationType: customer.identificationType || 'cedula',
      identificationNumber: String(customer.identificationNumber || ''),
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || ''
    });
    setShowEdit(true);
  };

  const deleteCustomer = async () => {
    if (!customer || !canDeleteCustomers) return;
    setBusy(true);
    try {
      await apiService.deleteCustomer(customer.id);
      setCustomers(previous => previous.filter(item => item.id !== customer.id));
      setCustomer(null);
      setActiveVisit(null);
      setShowDelete(false);
      setNotice('Cliente eliminado.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el cliente.');
    } finally {
      setBusy(false);
    }
  };

  const filteredCustomers = customers.filter(item =>
    `${item.name} ${item.identificationNumber || ''} ${item.id}`.toLowerCase().includes(search.toLowerCase())
  );
  const filteredOrders = orders.filter(order => orderFilter === 'all' || order.status === orderFilter);

  if (!user) return null;

  return (
    <main className='visitor-dashboard'>
      <header className='visitor-topbar'>
        <div className='visitor-brand'><span className='visitor-brand-mark'>D</span><span>DIUR <small>VISITAS</small></span></div>
        <div className='visitor-topbar-user'><InstallAppButton /><PushNotificationSettings /><span className='visitor-avatar'>{user.username.charAt(0).toUpperCase()}</span><span>{user.username}</span></div>
      </header>

      {notifications.slice(0, 3).map((notification, index) => (
        <Alert key={`${notification.timestamp}-${index}`} variant='info' className='mt-3 mb-0'>
          <small className='d-block'>{(notification.timestamp instanceof Date ? notification.timestamp : new Date(notification.timestamp)).toLocaleString()}</small>
          {notification.message}
        </Alert>
      ))}
      {error && <Alert variant='danger' dismissible onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert variant='success' dismissible onClose={() => setNotice('')}>{notice}</Alert>}

      {customer && activeVisit ? (
        <section className='visitor-client-view'>
          <div className='visitor-client-hero'>
            <span className='visitor-back-link'>VISITA ACTIVA</span>
            <div className='visitor-client-initial'>{customer.name.charAt(0).toUpperCase()}</div>
            <p className='visitor-eyebrow'>VISITA EN CURSO · #{activeVisit.id}</p>
            <h1>{customer.name}</h1>
            <p className='visitor-client-contact'>{customer.phone || 'Sin teléfono'}{customer.email ? ` · ${customer.email}` : ''} · {activeVisit.street}, {activeVisit.city}, {activeVisit.province}</p>
            <div className='visitor-client-stats'>
              <div><strong>#{customer.id}</strong><span>Código de cliente</span></div>
              <div><strong>{orders.length}</strong><span>Órdenes</span></div>
              <div><strong>{new Date(activeVisit.arrivalAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong><span>Hora de llegada</span></div>
            </div>
          </div>

          <div className='visitor-action-grid'>
            {canCreateOrders && <Link className='visitor-action-card' to={`/orders/sale?customerId=${customer.id}`}><span className='visitor-action-icon'>＋</span><strong>Nueva orden</strong><small>Registrar un pedido para este cliente</small></Link>}
            {canAccessReceivables && <Link className='visitor-action-card' to={`/accounts-receivable?customerId=${customer.id}`}><span className='visitor-action-icon'>＄</span><strong>Cobrar</strong><small>Consultar cuentas y registrar abonos</small></Link>}
            {canUpdateCustomers && <button className='visitor-action-card' onClick={openEdit}><span className='visitor-action-icon'>✎</span><strong>Modificar información</strong><small>Actualizar datos del cliente</small></button>}
            {canReadOrders && <button className='visitor-action-card' onClick={() => navigate('/orders/dashboard')}><span className='visitor-action-icon'>▤</span><strong>Órdenes del cliente</strong><small>Ver pendientes, listas y canceladas</small></button>}
          </div>

          {canReadOrders && (
            <section className='visitor-orders-panel'>
              <div className='visitor-section-heading'>
                <div><p className='visitor-eyebrow'>ACTIVIDAD DEL CLIENTE</p><h2>Órdenes recientes</h2></div>
                <Form.Select className='visitor-order-filter' value={orderFilter} onChange={event => setOrderFilter(event.target.value as typeof orderFilter)}>
                  <option value='all'>Todos los estados</option><option value='pendiente'>Pendientes</option><option value='parcial'>Parciales</option><option value='completado'>Listas / completadas</option><option value='cancelado'>Canceladas</option>
                </Form.Select>
              </div>
              {filteredOrders.length ? filteredOrders.map(order => (
                <div className='visitor-order-row' key={order.id}>
                  <span className='visitor-order-icon'>▤</span>
                  <div className='visitor-order-info'><strong>Orden #{order.id}</strong><small>{new Date(order.createdAt).toLocaleDateString()}</small></div>
                  <Badge bg={order.status === 'completado' ? 'success' : order.status === 'cancelado' ? 'danger' : 'warning'} text={order.status === 'pendiente' ? 'dark' : undefined}>{order.status}</Badge>
                  {hasPermission('ver_totales') || isAdmin ? <strong>${Number(order.total).toFixed(2)}</strong> : null}
                </div>
              )) : <p className='visitor-empty-state'>No hay órdenes para este cliente con el filtro seleccionado.</p>}
            </section>
          )}

          <div className='visitor-visit-footer'>
            <div><strong>Visita iniciada · {activeVisit.city}, {activeVisit.province}</strong><span>{new Date(activeVisit.arrivalAt).toLocaleString()} · GPS {Number(activeVisit.latitude).toFixed(5)}, {Number(activeVisit.longitude).toFixed(5)}</span></div>
            {canManageVisits && <Button variant='outline-danger' disabled={busy} onClick={() => void finishVisit()}>{busy ? <Spinner size='sm' /> : 'Finalizar visita'}</Button>}
          </div>
        </section>
      ) : (
        <>
          <section className='visitor-welcome'>
            <div>
              <p className='visitor-eyebrow'>PANEL DEL VENDEDOR</p>
              <h1>Hola, {user.username} <span>👋</span></h1>
              <p>{greeting}. Organiza tus visitas y gestiona tus clientes desde aquí.</p>
            </div>
            <Button className='visitor-primary-action' onClick={openVisitFlow}>＋ <span>Iniciar visita</span></Button>
          </section>

          <section className='visitor-overview'>
            <div><span className='visitor-overview-icon'>♙</span><div><strong>{customers.length}</strong><span>Clientes disponibles</span></div></div>
            <div><span className='visitor-overview-icon'>▤</span><div><strong>{pendingOrdersTotal}</strong><span>Órdenes pendientes</span></div></div>
            <div><span className='visitor-overview-icon'>◷</span><div><strong>{activeVisit ? 'En curso' : 'Sin visita'}</strong><span>Estado de visita</span></div></div>
          </section>

          <section className='visitor-content-grid'>
            <div className='visitor-main-column'>
              <div className='visitor-section-heading'>
                <div><p className='visitor-eyebrow'>ACCESO RÁPIDO</p><h2>Tus módulos</h2></div>
              </div>
              <div className='visitor-module-grid'>
                <button className='visitor-module-card visitor-module-featured' onClick={openVisitFlow}><span className='visitor-module-icon'>⌖</span><strong>Iniciar visita</strong><small>Registrar llegada y abrir el perfil del cliente</small><span className='visitor-module-arrow'>→</span></button>
                {canReadCustomers && <Link className='visitor-module-card' to='/customer'><span className='visitor-module-icon'>♙</span><strong>Clientes</strong><small>Consultar y administrar clientes</small><span className='visitor-module-arrow'>→</span></Link>}
                {canReadVisits && <Link className='visitor-module-card' to='/visits'><span className='visitor-module-icon'>◷</span><strong>Historial de visitas</strong><small>Consultar tus visitas anteriores</small><span className='visitor-module-arrow'>→</span></Link>}
                {canReadOrders && <Link className='visitor-module-card' to='/orders/dashboard'><span className='visitor-module-icon'>▤</span><strong>Órdenes y pedidos</strong><small>Revisar el estado de los pedidos</small><span className='visitor-module-arrow'>→</span></Link>}
                {!canReadOrders && canCreateOrders && <Link className='visitor-module-card' to='/orders/sale'><span className='visitor-module-icon'>▤</span><strong>Nueva orden</strong><small>Crear un nuevo pedido de venta</small><span className='visitor-module-arrow'>→</span></Link>}
                {canAccessReceivables && <Link className='visitor-module-card' to='/accounts-receivable'><span className='visitor-module-icon'>＄</span><strong>Cobros</strong><small>Consultar cuentas por cobrar</small><span className='visitor-module-arrow'>→</span></Link>}
              </div>
            </div>

            {canReadCustomers && (
              <Card className='visitor-customer-card'>
                <Card.Body>
                  <div className='visitor-section-heading'>
                    <div><p className='visitor-eyebrow'>DIRECTORIO</p><h2>Clientes</h2></div>
                    <Link to='/customer' className='visitor-view-all'>Ver todos</Link>
                  </div>
                  <Form.Control className='visitor-search' value={search} onChange={event => setSearch(event.target.value)} placeholder='Buscar cliente o código…' />
                  <div className='visitor-customer-list'>
                    {filteredCustomers.slice(0, 5).map(item => (
                      <button className='visitor-customer-row' key={item.id} onClick={() => { if (canManageVisits) { setCustomer(item); setVisitAddress({ street: item.address || '', city: '', province: '', country: '' }); setStep('location'); setShowVisit(true); } else { navigate('/customer'); } }}>
                        <span className='visitor-customer-avatar'>{item.name.charAt(0).toUpperCase()}</span><span><strong>{item.name}</strong><small>Código #{item.id}</small></span><span className='visitor-customer-arrow'>›</span>
                      </button>
                    ))}
                    {filteredCustomers.length === 0 && <p className='visitor-empty-state'>No hay clientes que coincidan.</p>}
                  </div>
                  {canCreateCustomers && <Button variant='outline-primary' className='w-100 mt-3' onClick={openVisitFlow}>＋ Crear cliente</Button>}
                </Card.Body>
              </Card>
            )}
          </section>
        </>
      )}

      <Modal show={showVisit} onHide={() => setShowVisit(false)} centered size='lg'>
        <Modal.Header closeButton><Modal.Title>{step === 'create' ? 'Crear cliente' : step === 'location' ? 'Registrar llegada' : 'Iniciar visita'}</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant='danger'>{error}</Alert>}
          {!canManageVisits ? (
            <Alert variant='warning' className='mb-0'>
              Tu usuario no tiene habilitado <strong>gestionar_visitas</strong>. Pide al administrador que abra <strong>Usuarios → Permisos</strong>, active ese permiso y vuelva a cargar este panel. Para seleccionar un cliente también necesitas <strong>leer_clientes</strong>; para crear uno nuevo, <strong>crear_clientes</strong>.
            </Alert>
          ) : (
            <>
          {step === 'select' && (
            <div className='visitor-flow-step'>
              <p>Busca un cliente existente por código, identificación o escanea su QR. También puedes registrar un cliente nuevo.</p>
              {canReadCustomers && <>
                <Form.Label htmlFor='visitor-customer-code'>Código o identificación del cliente</Form.Label>
                <div className='visitor-code-input'>
                  <Form.Control id='visitor-customer-code' value={code} onChange={event => setCode(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); resolveCustomer(code); } }} placeholder='Ej. 125 o número de identificación' />
                  <Button variant='outline-primary' onClick={() => resolveCustomer(code)}>Buscar</Button>
                  <Button variant='outline-secondary' onClick={() => setShowScanner(true)}>Escanear QR</Button>
                </div>
                <div id='visitor-customer-reader' className={showScanner ? 'visitor-scanner' : 'd-none'} />
              </>}
              {canCreateCustomers && <Button className='w-100 mt-3' variant='light' onClick={() => { setCustomer(null); setStep('create'); }}>＋ Crear cliente nuevo</Button>}
              {!canReadCustomers && <Alert variant='info' className='mt-3 mb-0'>No tienes permiso para buscar clientes existentes. Puedes crear uno nuevo si tienes ese permiso.</Alert>}
            </div>
          )}
          {step === 'create' && (
            <Form onSubmit={createCustomer}>
              <Form.Group className='mb-3'><Form.Label>Nombre del cliente *</Form.Label><Form.Control required value={customerForm.name} onChange={event => setCustomerForm({ ...customerForm, name: event.target.value })} /></Form.Group>
              <div className='row'>
                <Form.Group className='col-md-5 mb-3'><Form.Label>Tipo de identificación</Form.Label><Form.Select value={customerForm.identificationType || 'cedula'} onChange={event => setCustomerForm({ ...customerForm, identificationType: event.target.value as Customer['identificationType'] })}><option value='cedula'>Cédula</option><option value='ruc'>RUC</option><option value='passport'>Pasaporte</option><option value='none'>Sin identificación</option></Form.Select></Form.Group>
                <Form.Group className='col-md-7 mb-3'><Form.Label>Número</Form.Label><Form.Control value={customerForm.identificationNumber} onChange={event => setCustomerForm({ ...customerForm, identificationNumber: event.target.value })} /></Form.Group>
              </div>
              <div className='row'>
                <Form.Group className='col-md-6 mb-3'><Form.Label>Teléfono</Form.Label><Form.Control value={customerForm.phone} onChange={event => setCustomerForm({ ...customerForm, phone: event.target.value })} /></Form.Group>
                <Form.Group className='col-md-6 mb-3'><Form.Label>Correo</Form.Label><Form.Control type='email' value={customerForm.email} onChange={event => setCustomerForm({ ...customerForm, email: event.target.value })} /></Form.Group>
              </div>
              <Form.Group className='mb-3'><Form.Label>Dirección</Form.Label><Form.Control value={customerForm.address} onChange={event => setCustomerForm({ ...customerForm, address: event.target.value })} /></Form.Group>
              <div className='d-flex justify-content-between'><Button variant='light' onClick={() => setStep('select')}>Volver</Button><Button type='submit' disabled={busy}>{busy ? <Spinner size='sm' /> : 'Crear y continuar'}</Button></div>
            </Form>
          )}
          {step === 'location' && (
            <Form onSubmit={startVisit}>
              <Alert variant='info'>Cliente: <strong>{customer?.name}</strong>. La ubicación GPS se guardará junto con la dirección de la visita.</Alert>
              <Form.Group className='mb-3'><Form.Label>Calle y número *</Form.Label><Form.Control required value={visitAddress.street} onChange={event => setVisitAddress({ ...visitAddress, street: event.target.value })} /></Form.Group>
              <div className='row'>
                <Form.Group className='col-md-4 mb-3'><Form.Label>Ciudad *</Form.Label><Form.Control required value={visitAddress.city} onChange={event => setVisitAddress({ ...visitAddress, city: event.target.value })} /></Form.Group>
                <Form.Group className='col-md-4 mb-3'><Form.Label>Provincia *</Form.Label><Form.Control required value={visitAddress.province} onChange={event => setVisitAddress({ ...visitAddress, province: event.target.value })} /></Form.Group>
                <Form.Group className='col-md-4 mb-3'><Form.Label>País *</Form.Label><Form.Control required value={visitAddress.country} onChange={event => setVisitAddress({ ...visitAddress, country: event.target.value })} /></Form.Group>
              </div>
              <div className='d-flex justify-content-between'><Button variant='light' onClick={() => setStep('select')}>Volver</Button><Button type='submit' disabled={busy}>{busy ? <><Spinner size='sm' className='me-2' />Obteniendo ubicación…</> : 'Registrar llegada y abrir cliente'}</Button></div>
            </Form>
          )}
            </>
          )}
        </Modal.Body>
      </Modal>

      <Modal show={showEdit} onHide={() => setShowEdit(false)} centered>
        <Modal.Header closeButton><Modal.Title>Modificar cliente</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form onSubmit={saveCustomer}>
            <Form.Group className='mb-3'><Form.Label>Nombre *</Form.Label><Form.Control required value={customerForm.name} onChange={event => setCustomerForm({ ...customerForm, name: event.target.value })} /></Form.Group>
            <div className='row'>
              <Form.Group className='col-md-5 mb-3'><Form.Label>Tipo de identificación</Form.Label><Form.Select value={customerForm.identificationType || 'cedula'} onChange={event => setCustomerForm({ ...customerForm, identificationType: event.target.value as Customer['identificationType'] })}><option value='cedula'>Cédula</option><option value='ruc'>RUC</option><option value='passport'>Pasaporte</option><option value='none'>Sin identificación</option></Form.Select></Form.Group>
              <Form.Group className='col-md-7 mb-3'><Form.Label>Número</Form.Label><Form.Control value={customerForm.identificationNumber} onChange={event => setCustomerForm({ ...customerForm, identificationNumber: event.target.value })} /></Form.Group>
            </div>
            <Form.Group className='mb-3'><Form.Label>Teléfono</Form.Label><Form.Control value={customerForm.phone} onChange={event => setCustomerForm({ ...customerForm, phone: event.target.value })} /></Form.Group>
            <Form.Group className='mb-3'><Form.Label>Correo</Form.Label><Form.Control type='email' value={customerForm.email} onChange={event => setCustomerForm({ ...customerForm, email: event.target.value })} /></Form.Group>
            <Form.Group className='mb-3'><Form.Label>Dirección</Form.Label><Form.Control value={customerForm.address} onChange={event => setCustomerForm({ ...customerForm, address: event.target.value })} /></Form.Group>
            <div className='d-flex justify-content-between'>{canDeleteCustomers && <Button variant='outline-danger' onClick={() => setShowDelete(true)}>Eliminar cliente</Button>}<Button type='submit' disabled={busy}>{busy ? <Spinner size='sm' /> : 'Guardar cambios'}</Button></div>
          </Form>
        </Modal.Body>
      </Modal>

      <Modal show={showDelete} onHide={() => setShowDelete(false)} centered>
        <Modal.Header closeButton><Modal.Title>Eliminar cliente</Modal.Title></Modal.Header>
        <Modal.Body>¿Eliminar a <strong>{customer?.name}</strong>? Esta acción no se puede deshacer.</Modal.Body>
        <Modal.Footer><Button variant='light' onClick={() => setShowDelete(false)}>Cancelar</Button><Button variant='danger' disabled={busy} onClick={() => void deleteCustomer()}>{busy ? <Spinner size='sm' /> : 'Eliminar cliente'}</Button></Modal.Footer>
      </Modal>
    </main>
  );
};

export default DashboardVisitor;
