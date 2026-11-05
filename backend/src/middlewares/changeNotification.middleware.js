const { randomUUID } = require('crypto');
const NotificationService = require('../services/NotificationService');

const resourceLabels = {
  'accounts-receivable': 'cuentas por cobrar',
  customers: 'clientes',
  invoices: 'facturas',
  orders: 'pedidos',
  permissions: 'permisos',
  products: 'productos',
  suppliers: 'proveedores',
  users: 'usuarios',
  visits: 'visitas',
  sync: 'datos sincronizados',
};

const methodActions = {
  POST: 'creó',
  PUT: 'actualizó',
  PATCH: 'actualizó',
  DELETE: 'eliminó',
};

const changeNotification = (req, res, next) => {
  const method = req.method.toUpperCase();
  const isNewRegistration = method === 'POST' && req.path === '/auth/register';
  const resourceKey = isNewRegistration ? 'users' : req.path.split('/').filter(Boolean)[0];
  if (!methodActions[method] || !resourceKey || resourceKey === 'notifications') {
    return next();
  }

  res.once('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300 || (!req.user && !isNewRegistration)) return;

    let type = 'system_change';
    const actorName = req.user?.username;
    let message = isNewRegistration
      ? 'Nuevo usuario registrado.'
      : `${actorName} ${methodActions[method]} ${resourceLabels[resourceKey] || 'información del sistema'}.`;
    if (resourceKey === 'orders' && method === 'POST') {
      type = 'order_created';
      message = `Nuevo pedido creado por ${req.user.username}.`;
    } else if (resourceKey === 'visits' && method === 'POST') {
      type = 'visit_started';
      message = `Visita iniciada por ${req.user.username}.`;
    } else if (resourceKey === 'visits' && method === 'PATCH' && req.path.endsWith('/end')) {
      type = 'visit_finished';
      message = `Visita finalizada por ${req.user.username}.`;
    }

    const notification = {
      type,
      message,
      data: {
        eventId: randomUUID(),
        actorId: req.user?.id,
        actorName,
        resource: resourceKey,
      },
      timestamp: new Date().toISOString(),
    };

    req.app.get('io')?.emit('notification', notification);
    NotificationService.sendToAll(notification).catch(error => {
      console.error('Could not dispatch push notifications:', error.message);
    });
  });

  return next();
};

module.exports = changeNotification;
