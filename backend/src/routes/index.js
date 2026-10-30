
const express = require('express');
const AuthController = require('../controllers/AuthController');
const ProductController = require('../controllers/ProductController');
const InvoiceController = require('../controllers/InvoiceController');
const OrderController = require('../controllers/OrderController');
const PermissionController = require('../controllers/PermissionController');
const SupplierController = require('../controllers/SupplierController');
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
router.post('/users', authorize('crear_usuario', 'gestionar_usuarios', 'crud_users'), AuthController.register);
router.get('/users', authorize('leer_usuario', 'gestionar_usuarios', 'crud_users'), AuthController.listUsers);
router.put('/users/:id', authorize('actualizar_usuario', 'gestionar_usuarios', 'crud_users'), AuthController.updateUser);
router.delete('/users/:id', authorize('eliminar_usuario', 'gestionar_usuarios', 'crud_users'), AuthController.deleteUser);


// 🔵 CRUD CUSTOMERS
router.post('/customers', authorize('crear_clientes'), CustomerController.createCustomer);
router.get('/customers', authorize('leer_clientes'), CustomerController.getCustomers);
router.put('/customers/:id', authorize('actualizar_clientes'), CustomerController.updateCustomer);
router.delete('/customers/:id', authorize('eliminar_clientes'), CustomerController.deleteCustomer);

// 🟣 CRUD SUPPLIERS
router.get('/suppliers', SupplierController.getSuppliers);
router.get('/suppliers/:id', SupplierController.getSupplier);
router.post('/suppliers', authorize('crud_users'), SupplierController.createSupplier);
router.put('/suppliers/:id', authorize('crud_users'), SupplierController.updateSupplier);
router.delete('/suppliers/:id', authorize('crud_users'), SupplierController.deleteSupplier);

// Rutas de productos
router.post('/products', authorize('crear_producto', 'gestionar_productos'), validateProductData, ProductController.createProduct);
router.post('/products/bulk', authorize('crear_producto', 'gestionar_productos'), ProductController.createProducts);
router.get('/products', authorize('leer_producto', 'gestionar_productos'), ProductController.getProducts);
router.get('/products/:id', authorize('leer_producto', 'gestionar_productos'), ProductController.getProduct);
router.put('/products/:id', authorize('actualizar_producto', 'gestionar_productos'), ProductController.updateProduct);
router.patch('/products/:id/stock', authorize('actualizar_producto', 'gestionar_productos'), ProductController.updateStock);
router.delete('/products/:id', authorize('eliminar_producto', 'gestionar_productos'), ProductController.deleteProduct);

// Rutas de facturas
router.post('/invoices', authorize('crear_factura'), InvoiceController.createInvoice);
router.get('/invoices', authorize('leer_factura'), InvoiceController.getInvoices);
router.get('/invoices/:id', authorize('leer_factura'), InvoiceController.getInvoice);
router.patch('/invoices/:id/status', authorize('actualizar_factura'), InvoiceController.updateInvoiceStatus);
router.delete('/invoices/:id', authorize('cancelar_factura'), InvoiceController.cancelInvoice);
router.post('/invoices/:id/send-email', authorize('leer_factura'), InvoiceController.sendInvoiceEmail);
router.post('/invoices/:id/cancel', authorize('cancelar_factura'), InvoiceController.cancelInvoice);
router.post('/invoices/:id/create-ar', authorize('actualizar_factura'), InvoiceController.createAccountsReceivable);

// Rutas de cuentas por cobrar
const AccountsReceivableController = require('../controllers/AccountsReceivableController');
router.get('/accounts-receivable', authorize('leer_factura'), AccountsReceivableController.listPending);
router.get('/accounts-receivable/:id', authorize('leer_factura'), AccountsReceivableController.get);
router.post('/accounts-receivable/:id/pay', authorize('actualizar_factura'), AccountsReceivableController.pay);

// Rutas de pedidos
router.post('/orders', authorize('crear_orden'), OrderController.createOrder);
router.get('/orders', authorize('leer_orden'), OrderController.getOrders);
router.patch('/orders/:orderId/items/:productId/status', authorize('actualizar_orden', 'gestionar_items_orden'), OrderController.updateOrderItemStatus);
router.put('/orders/:id/status', authorize('cancelar_orden'), OrderController.cancelOrder);
router.get('/orders/:id', authorize('leer_orden'), OrderController.getOrder);

// Rutas de permisos
router.get('/permissions', authorize('gestionar_permisos'), PermissionController.getPermissions);
router.post('/permissions/assign', authorize('gestionar_permisos'), PermissionController.assignPermissions);
router.get('/permissions/user/:userId', authorize('gestionar_permisos'), PermissionController.getUserPermissions);
router.get('/permissions/check/:userId/:permissionName', authorize('gestionar_permisos'), PermissionController.checkPermission);
router.post('/permissions/init', authorize('gestionar_permisos'), PermissionController.initializePermissions);

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
