// src/seeders/seedDatabase.js
const bcrypt = require('bcrypt');
const db = require('../utils/database');
const initModels = require('../models/initModels');
const { User, Product, Permission, UserPermission } = require('../models');
const Supplier = require('../models/Suppliers');

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

    // --- PROVEEDORES ---
    const suppliersData = [
      {
        name: 'FerreDistribuciones S.A.',
        ruc: '0999999999001',
        phone: '0991234567',
        email: 'ventas@ferredistribuciones.com',
        address: 'Guayaquil, Ecuador',
        contactName: 'Carlos Mendoza'
      },
      {
        name: 'Importadora Industrial Andina',
        ruc: '0198765432001',
        phone: '0987654321',
        email: 'contacto@andina.com',
        address: 'Quito, Ecuador',
        contactName: 'María López'
      },
      {
        name: 'Herramientas Pro Ecuador',
        ruc: '0102030405001',
        phone: '0971112233',
        email: 'ventas@herramientaspro.com',
        address: 'Cuenca, Ecuador',
        contactName: 'Luis Torres'
      }
    ];

    const suppliers = [];

    for (const supData of suppliersData) {
      const supplier = await Supplier.create(supData);
      suppliers.push(supplier);
      console.log(`✅ Proveedor creado: ${supplier.name}`);
    }

    // --- PRODUCTOS (COMPLETOS) ---
    const productsData = [
      {
        interno: 'INT-001',
        partnumber: 'HAM-001',
        name: 'Martillo de carpintero 16oz',
        brand: 'Truper',
        categoria: 'Herramientas manuales',
        price: 25.50,
        pricecaja: 240.00,
        priceb: 23.00,
        costiva: 18.00,
        util: 7.50,
        stock: 50,
        piezas: 12,
        importacion: false,
        grupo: 'Herramientas',
        supplierId: suppliers[0].id,
        costlast: 17.50,
        costavg: 17.80,
        iva: true,
        isservice: false,
        esnota: false,
        gasto: false,
        baja: false,
        idbrand: 1,
        ubicacion: 'A1-01',
        foto: '',
        codigo2: 'HAMMER-16',
        codigo3: null,
        codigo4: null,
        modelo: 'H16',
        porcentaje: 30.00
      },
      {
        interno: 'INT-002',
        partnumber: 'SCR-001',
        name: 'Destornillador Phillips #2',
        brand: 'Stanley',
        categoria: 'Herramientas manuales',
        price: 12.75,
        pricecaja: 120.00,
        priceb: 11.50,
        costiva: 8.50,
        util: 4.25,
        stock: 30,
        piezas: 24,
        importacion: false,
        grupo: 'Herramientas',
        supplierId: suppliers[0].id,
        costlast: 8.00,
        costavg: 8.20,
        iva: true,
        isservice: false,
        esnota: false,
        gasto: false,
        baja: false,
        idbrand: 2,
        ubicacion: 'A1-02',
        foto: '',
        codigo2: 'SCREW-PH2',
        modelo: 'PH2',
        porcentaje: 25.00
      },
      {
        interno: 'INT-003',
        partnumber: 'DRL-001',
        name: 'Taladro inalámbrico 18V',
        brand: 'Bosch',
        categoria: 'Herramientas eléctricas',
        price: 89.99,
        pricecaja: 850.00,
        priceb: 85.00,
        costiva: 70.00,
        util: 19.99,
        stock: 15,
        piezas: 6,
        importacion: true,
        grupo: 'Eléctricas',
        supplierId: suppliers[1].id,
        costlast: 68.00,
        costavg: 69.50,
        iva: true,
        isservice: false,
        esnota: false,
        gasto: false,
        baja: false,
        idbrand: 3,
        ubicacion: 'B2-01',
        foto: '',
        codigo2: 'DRILL-18V',
        modelo: 'GSR180',
        porcentaje: 28.00
      },
      {
        interno: 'INT-004',
        partnumber: 'GRD-001',
        name: 'Amoladora angular 4.5"',
        brand: 'Makita',
        categoria: 'Herramientas eléctricas',
        price: 65.00,
        pricecaja: 600.00,
        priceb: 60.00,
        costiva: 50.00,
        util: 15.00,
        stock: 20,
        piezas: 6,
        importacion: true,
        grupo: 'Eléctricas',
        supplierId: suppliers[1].id,
        costlast: 48.00,
        costavg: 49.00,
        iva: true,
        isservice: false,
        esnota: false,
        gasto: false,
        baja: false,
        idbrand: 4,
        ubicacion: 'B2-02',
        foto: '',
        codigo2: 'GRINDER-45',
        modelo: 'GA4530',
        porcentaje: 30.00
      },
      {
        interno: 'INT-005',
        partnumber: 'MEA-001',
        name: 'Cinta métrica 5m',
        brand: 'Pretul',
        categoria: 'Medición',
        price: 8.90,
        pricecaja: 80.00,
        priceb: 8.00,
        costiva: 5.50,
        util: 3.40,
        stock: 40,
        piezas: 12,
        importacion: false,
        grupo: 'Medición',
        supplierId: suppliers[2].id,
        costlast: 5.20,
        costavg: 5.30,
        iva: true,
        isservice: false,
        esnota: false,
        gasto: false,
        baja: false,
        idbrand: 5,
        ubicacion: 'C1-01',
        foto: '',
        codigo2: 'TAPE-5M',
        modelo: 'TM5',
        porcentaje: 35.00
      }
    ];

    for (const productData of productsData) {
      const product = await Product.create(productData);
      console.log(`✅ Producto creado: ${product.name}`);
    }

    console.log('🎉 Seeding completado exitosamente!');
  } catch (error) {
    console.error('❌ Error en seeding:', error);
  }
};

module.exports = seedDatabase;