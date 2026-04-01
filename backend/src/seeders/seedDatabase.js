const bcrypt = require('bcrypt');
const { User, Product, Permission, UserPermission } = require('../models');

/**
 * Seeder para datos iniciales
 * Crea usuarios, productos, y permisos de prueba
 */
const seedDatabase = async () => {
  try {
    console.log('🌱 Iniciando seeding de base de datos...');

    // Definir todos los permisos disponibles en el sistema
    const permissionsData = [
      { name: 'create_product', description: 'Crear productos' },
      { name: 'read_product', description: 'Ver productos' },
      { name: 'update_product', description: 'Actualizar productos' },
      { name: 'delete_product', description: 'Eliminar productos' },
      { name: 'create_invoice', description: 'Crear facturas' },
      { name: 'read_invoice', description: 'Ver facturas' },
      { name: 'update_invoice', description: 'Actualizar facturas' },
      { name: 'cancel_invoice', description: 'Cancelar facturas' },
      { name: 'create_order', description: 'Crear órdenes' },
      { name: 'read_order', description: 'Ver órdenes' },
      { name: 'update_order', description: 'Actualizar órdenes' },
      { name: 'cancel_order', description: 'Cancelar órdenes' },
      { name: 'manage_order_items', description: 'Gestionar items de órdenes' },
      { name: 'create_user', description: 'Crear usuarios' },
      { name: 'read_user', description: 'Ver usuarios' },
      { name: 'update_user', description: 'Actualizar usuarios' },
      { name: 'delete_user', description: 'Eliminar usuarios' },
      { name: 'manage_users', description: 'Gestionar usuarios' },
      { name: 'manage_permissions', description: 'Gestionar permisos' },
      { name: 'view_dashboard', description: 'Ver dashboard' },
      { name: 'view_reports', description: 'Ver reportes' },
      { name: 'access_pos', description: 'Acceso a POS' },
      { name: 'admin_access', description: 'Acceso administrativo completo' },
    ];

    // Crear permisos
    const permissions = [];
    for (const permData of permissionsData) {
      const [permission, created] = await Permission.findOrCreate({
        where: { name: permData.name },
        defaults: permData,
      });
      permissions.push(permission);
      if (created) {
        console.log(`✅ Permiso creado: ${permission.name}`);
      }
    }

    // Crear usuarios de prueba
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const users = [
      {
        username: 'admin',
        email: 'admin@diur.com',
        password: hashedPassword,
        role: 'admin',
      },
      {
        username: 'cashier',
        email: 'cashier@diur.com',
        password: await bcrypt.hash('cashier123', 10),
        role: 'cashier',
      },
      {
        username: 'warehouse',
        email: 'warehouse@diur.com',
        password: await bcrypt.hash('warehouse123', 10),
        role: 'warehouse',
      },
    ];

    let adminUser = null;
    for (const userData of users) {
      const [user, created] = await User.findOrCreate({
        where: { email: userData.email },
        defaults: userData,
      });
      if (user.role === 'admin') {
        adminUser = user;
      }
      if (created) {
        console.log(`✅ Usuario creado: ${user.email}`);
      } else {
        console.log(`⚠️ Usuario ya existe: ${user.email}`);
      }
    }

    // Asignar TODOS los permisos al usuario admin
    if (adminUser) {
      for (const permission of permissions) {
        const [userPermission, created] = await UserPermission.findOrCreate({
          where: {
            userId: adminUser.id,
            permissionId: permission.id,
          },
        });
        if (created) {
          console.log(`✅ Permiso asignado al admin: ${permission.name}`);
        }
      }
    }


    // Crear productos de prueba
    const products = [
      {
        name: 'Martillo de carpintero',
        description: 'Martillo profesional de 16 oz',
        price: 25.50,
        stock: 50,
        sku: 'HAM-001',
        category: 'Herramientas manuales',
      },
      {
        name: 'Destornillador Phillips',
        description: 'Set de destornilladores Phillips #2',
        price: 12.75,
        stock: 30,
        sku: 'SCR-001',
        category: 'Herramientas manuales',
      },
      {
        name: 'Cinta métrica 5m',
        description: 'Cinta métrica retráctil de 5 metros',
        price: 8.90,
        stock: 40,
        sku: 'MEA-001',
        category: 'Medición',
      },
      {
        name: 'Taladro inalámbrico',
        description: 'Taladro percutor 18V con batería',
        price: 89.99,
        stock: 15,
        sku: 'DRL-001',
        category: 'Herramientas eléctricas',
      },
      {
        name: 'Pintura latex blanca 1L',
        description: 'Pintura latex premium blanca 1 litro',
        price: 15.25,
        stock: 25,
        sku: 'PNT-001',
        category: 'Pinturas',
      },
    ];

    for (const productData of products) {
      const [product, created] = await Product.findOrCreate({
        where: { sku: productData.sku },
        defaults: productData,
      });
      if (created) {
        console.log(`✅ Producto creado: ${product.name}`);
      } else {
        console.log(`⚠️ Producto ya existe: ${product.name}`);
      }
    }

    console.log('🎉 Seeding completado exitosamente!');
  } catch (error) {
    console.error('❌ Error durante el seeding:', error);
  }
};

module.exports = seedDatabase;