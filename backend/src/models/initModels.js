
const User = require('./User');
const Product = require('./Product');
const Invoice = require('./Invoice');
const InvoiceItem = require('./InvoiceItem');
const Order = require('./Order');

const initModels = () => {
  // Asociaciones de Usuario
  User.hasMany(Invoice, { foreignKey: 'userId', as: 'invoices' });
  User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
  User.hasMany(Order, { foreignKey: 'deliveryUserId', as: 'deliveries' });

  // Asociaciones de Factura
  Invoice.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'items' });

  // Asociaciones de Item de Factura
  InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
  InvoiceItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

  // Asociaciones de Pedido
  Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Order.belongsTo(User, { foreignKey: 'deliveryUserId', as: 'deliveryUser' });
};

module.exports = initModels;
