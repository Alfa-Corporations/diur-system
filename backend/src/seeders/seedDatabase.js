// src/seeders/seedDatabase.js
const bcrypt = require('bcrypt');
const db = require('../utils/database');
const initModels = require('../models/initModels');
const { User, Product, Permission, UserPermission } = require('../models');

//initModels(); // Inicializa relaciones entre modelos

const seedDatabase = async () => {
  try {
    console.log('🌱 Sincronizando base de datos...');
    await db.sync({ force: true }); // Borra y crea tablas
    console.log('✅ Base de datos sincronizada.');

    // --- PERMISOS ---
    const permissionsData = [
      { name: 'gestionar_productos', description: 'Gestionar productos' },
      { name: 'crear_producto', description: 'Crear productos' },
      { name: 'leer_producto', description: 'Ver productos' },
      { name: 'actualizar_producto', description: 'Actualizar productos' },
      { name: 'eliminar_producto', description: 'Eliminar productos' },
      { name: 'crear_factura', description: 'Crear facturas' },
      { name: 'leer_factura', description: 'Ver facturas' },
      { name: 'actualizar_factura', description: 'Actualizar facturas' },
      { name: 'cancelar_factura', description: 'Cancelar facturas' },
      { name: 'crear_orden', description: 'Crear órdenes' },
      { name: 'leer_orden', description: 'Ver órdenes' },
      { name: 'actualizar_orden', description: 'Actualizar órdenes' },
      { name: 'cancelar_orden', description: 'Cancelar órdenes' },
      { name: 'gestionar_items_orden', description: 'Gestionar items de órdenes' },
      { name: 'crear_usuario', description: 'Crear usuarios' },
      { name: 'leer_usuario', description: 'Ver usuarios' },
      { name: 'actualizar_usuario', description: 'Actualizar usuarios' },
      { name: 'eliminar_usuario', description: 'Eliminar usuarios' },
      { name: 'gestionar_usuarios', description: 'Gestionar usuarios' },
      { name: 'gestionar_permisos', description: 'Gestionar permisos' },
      { name: 'ver_dashboard', description: 'Ver dashboard' },
      { name: 'ver_reportes', description: 'Ver reportes' },
      { name: 'acceso_pos', description: 'Acceso a POS' },
      { name: 'acceso_administrativo', description: 'Acceso administrativo completo' },
    ];

    const permissions = [];
    for (const permData of permissionsData) {
      const [permission] = await Permission.findOrCreate({
        where: { name: permData.name },
        defaults: permData,
      });
      permissions.push(permission);
      console.log(`✅ Permiso procesado: ${permission.name}`);
    }

    // --- USUARIOS ---
    const usersData = [
      { username: 'admin', email: 'admin@diur.com', password: await bcrypt.hash('admin123', 10), role: 'admin' },
      { username: 'cashier', email: 'cashier@diur.com', password: await bcrypt.hash('cashier123', 10), role: 'caja' },
      { username: 'warehouse', email: 'warehouse@diur.com', password: await bcrypt.hash('warehouse123', 10), role: 'bodega' },
    ];

    const users = [];
    for (const userData of usersData) {
      const [user] = await User.findOrCreate({
        where: { email: userData.email },
        defaults: userData,
      });
      users.push(user);
      console.log(`✅ Usuario procesado: ${user.email}`);
    }

    // --- ASIGNAR PERMISOS AL ADMIN ---
    const adminUser = users.find(u => u.role === 'admin');
    if (adminUser) {
      for (const permission of permissions) {
        await UserPermission.findOrCreate({
          where: { userId: adminUser.id, permissionId: permission.id },
        });
      }
      console.log('✅ Todos los permisos asignados al admin.');
    }

    // --- PRODUCTOS ---
    /* const productsData = [
      { name: 'Martillo de carpintero', description: 'Martillo profesional de 16 oz', price: 25.5, stock: 50, sku: 'HAM-001', category: 'Herramientas manuales' },
      { name: 'Destornillador Phillips', description: 'Set de destornilladores Phillips #2', price: 12.75, stock: 30, sku: 'SCR-001', category: 'Herramientas manuales' },
      { name: 'Cinta métrica 5m', description: 'Cinta métrica retráctil de 5 metros', price: 8.9, stock: 40, sku: 'MEA-001', category: 'Medición' },
      { name: 'Taladro inalámbrico', description: 'Taladro percutor 18V con batería', price: 89.99, stock: 15, sku: 'DRL-001', category: 'Herramientas eléctricas' },
      { name: 'Pintura latex blanca 1L', description: 'Pintura latex premium blanca 1 litro', price: 15.25, stock: 25, sku: 'PNT-001', category: 'Pinturas' },
    ];

    for (const productData of productsData) {
      await Product.findOrCreate({ where: { sku: productData.sku }, defaults: productData });
      console.log(`✅ Producto procesado: ${productData.name}`);
    } */

    console.log('🎉 Seeding completado exitosamente!');
  } catch (error) {
    console.error('❌ Error en seeding:', error);
  }
};

module.exports = seedDatabase;