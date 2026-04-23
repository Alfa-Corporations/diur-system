
const express = require('express');
const AuthController = require('../controllers/AuthController');
const ProductController = require('../controllers/ProductController');
const InvoiceController = require('../controllers/InvoiceController');
const OrderController = require('../controllers/OrderController');
const PermissionController = require('../controllers/PermissionController');
const SyncService = require('../services/SyncService');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validateProductData, validateInvoiceData } = require('../middlewares/validation.middleware');
const CustomerController = require('../controllers/CustomerController');

const router = express.Router();

// Rutas de autenticación (públicas)
router.post('/auth/register', AuthController.register);
router.post('/auth/login', AuthController.login);

// Rutas protegidas
router.use(authenticate); // Todas las rutas siguientes requieren autenticación

router.get('/auth/profile', AuthController.getProfile);
router.post('/auth/logout', AuthController.logout);
router.post('/users', authorize('crud_users'), AuthController.register);
router.get('/users', authorize('crud_users'), AuthController.listUsers);
router.put('/users/:id', authorize('crud_users'), AuthController.updateUser);
router.delete('/users/:id', authorize('crud_users'), AuthController.deleteUser);


// 🔵 CRUD CUSTOMERS
router.post('/customers', authorize('crear_clientes'), CustomerController.createCustomer);
router.get('/customers', authorize('leer_clientes'), CustomerController.getCustomers);
router.put('/customers/:id', authorize('actualizar_clientes'), CustomerController.updateCustomer);
router.delete('/customers/:id', authorize('eliminar_clientes'), CustomerController.deleteCustomer);

// Rutas de productos
router.post('/products', authorize('crear_producto'), validateProductData, ProductController.createProduct);
router.post('/products/bulk', authorize('crear_producto'), ProductController.createProducts);
router.get('/products', authorize('leer_producto'), ProductController.getProducts);
router.get('/products/:id', authorize('leer_producto'), ProductController.getProduct);
router.put('/products/:id', authorize('actualizar_producto'), ProductController.updateProduct);
router.patch('/products/:id/stock', authorize('actualizar_producto'), ProductController.updateStock);
router.delete('/products/:id', authorize('eliminar_producto'), ProductController.deleteProduct);

// Rutas de facturas
router.post('/invoices', authorize('crear_factura'), InvoiceController.createInvoice);
router.get('/invoices', InvoiceController.getInvoices);
router.get('/invoices/:id', InvoiceController.getInvoice);
router.patch('/invoices/:id/status', InvoiceController.updateInvoiceStatus);
router.delete('/invoices/:id', InvoiceController.cancelInvoice);
router.post('/invoices/:id/send-email', InvoiceController.sendInvoiceEmail);
router.post('/invoices/:id/cancel', InvoiceController.cancelInvoice);

// Rutas de pedidos
router.post('/orders', authorize('crear_orden'), OrderController.createOrder);
router.get('/orders', authorize('leer_orden'), OrderController.getOrders);
router.patch('/orders/:orderId/items/:productId/status', authorize('actualizar_orden'), OrderController.updateOrderItemStatus);
router.put('/orders/:id/status', authorize('cancelar_orden'), OrderController.cancelOrder);
router.get('/orders/:id', OrderController.getOrder);

// Rutas de permisos
router.get('/permissions', PermissionController.getPermissions);
router.post('/permissions/assign', PermissionController.assignPermissions);
router.get('/permissions/user/:userId', PermissionController.getUserPermissions);
router.get('/permissions/check/:userId/:permissionName', PermissionController.checkPermission);
router.post('/permissions/init', PermissionController.initializePermissions);

// Rutas de sincronización
router.get('/sync/pending', (req, res) => {
  try {
    const pendingEvents = SyncService.getPendingEvents();
    res.json({ pendingEvents });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving pending events' });
  }
});

router.post('/sync/events', async (req, res) => {
  try {
    const { events } = req.body;
    const results = await SyncService.syncPendingEvents(events);
    res.json({
      message: 'Sync completed',
      results,
    });
  } catch (error) {
    res.status(500).json({ message: 'Sync failed' });
  }
});

router.post('/sync/cleanup', authorize('crud_users'), (req, res) => {
  try {
    const { daysOld = 7 } = req.body;
    SyncService.cleanupSyncedEvents(daysOld);
    res.json({ message: 'Cleanup completed' });
  } catch (error) {
    res.status(500).json({ message: 'Cleanup failed' });
  }
});

module.exports = router;
