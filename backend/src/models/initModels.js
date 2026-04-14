
const User = require('./User');
const Product = require('./Product');
const Customer = require('./Customer');
const Invoice = require('./Invoice');
const InvoiceItem = require('./InvoiceItem');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Permission = require('./Permission');
const UserPermission = require('./UserPermission');
const Supplier = require('./Suppliers')

const initModels = () => {

  // 🔵 Asociaciones de Proveedor
  Supplier.hasMany(Product, {
    foreignKey: 'supplierId',
    as: 'products'
  });

  Product.belongsTo(Supplier, {
    foreignKey: 'supplierId',
    as: 'supplier'
  });

  // Asociaciones de Usuario
  //User.hasMany(Invoice, { foreignKey: 'userId', as: 'userInvoices' });
  User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
  User.hasMany(Order, { foreignKey: 'deliveryUserId', as: 'deliveries' });

  // Asociaciones de Cliente
  Customer.hasMany(Invoice, { foreignKey: 'customerId', as: 'invoices' });

  // Asociaciones de Factura
  Invoice.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Invoice.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
  Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'items' });

  // Asociaciones de Item de Factura
  InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
  InvoiceItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

  // Asociaciones de Pedido
  Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Order.belongsTo(User, { foreignKey: 'deliveryUserId', as: 'deliveryUser' });
  Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'items' });

  // Asociaciones de Item de Pedido
  OrderItem.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
  OrderItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

  // Asociaciones de Permisos - muchos a muchos
  User.belongsToMany(Permission, { through: UserPermission, foreignKey: 'userId', as: 'permissions' });
  Permission.belongsToMany(User, { through: UserPermission, foreignKey: 'permissionId', as: 'users' });

  // Asociaciones directas en tabla de unión UserPermission
  UserPermission.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  UserPermission.belongsTo(Permission, { foreignKey: 'permissionId', as: 'permission' });
  User.hasMany(UserPermission, { foreignKey: 'userId', as: 'userPermissions' });
  Permission.hasMany(UserPermission, { foreignKey: 'permissionId', as: 'userPermissions' });

  // Asociación adicional para InvoiceItem con OrderItem
  InvoiceItem.belongsTo(OrderItem, { foreignKey: 'orderItemId', as: 'orderItem' });
};

module.exports = initModels;
