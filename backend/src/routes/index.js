
const express = require('express');
const AuthController = require('../controllers/AuthController');
const ProductController = require('../controllers/ProductController');
const InvoiceController = require('../controllers/InvoiceController');
const SyncService = require('../services/SyncService');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validateProductData, validateInvoiceData } = require('../middlewares/validation.middleware');

const router = express.Router();

// Rutas de autenticación (públicas)
router.post('/auth/register', AuthController.register);
router.post('/auth/login', AuthController.login);

// Rutas protegidas
router.use(authenticate); // Todas las rutas siguientes requieren autenticación

router.get('/auth/profile', AuthController.getProfile);
router.post('/auth/logout', AuthController.logout);

// Rutas de productos
router.post('/products', authorize('admin', 'warehouse'), validateProductData, ProductController.createProduct);
router.get('/products', ProductController.getProducts);
router.get('/products/:id', ProductController.getProduct);
router.put('/products/:id', authorize('admin', 'warehouse'), ProductController.updateProduct);
router.patch('/products/:id/stock', authorize('admin', 'warehouse', 'cashier'), ProductController.updateStock);
router.delete('/products/:id', authorize('admin'), ProductController.deleteProduct);

// Rutas de facturas
router.post('/invoices', authorize('admin', 'cashier'), validateInvoiceData, InvoiceController.createInvoice);
router.get('/invoices', InvoiceController.getInvoices);
router.get('/invoices/:id', InvoiceController.getInvoice);
router.patch('/invoices/:id/status', authorize('admin', 'cashier'), InvoiceController.updateInvoiceStatus);
router.post('/invoices/:id/cancel', authorize('admin', 'cashier'), InvoiceController.cancelInvoice);

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

router.post('/sync/cleanup', authorize('admin'), (req, res) => {
  try {
    const { daysOld = 7 } = req.body;
    SyncService.cleanupSyncedEvents(daysOld);
    res.json({ message: 'Cleanup completed' });
  } catch (error) {
    res.status(500).json({ message: 'Cleanup failed' });
  }
});

module.exports = router;
