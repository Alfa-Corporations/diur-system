const bcrypt = require('bcrypt');
const { User, Product } = require('../models');

/**
 * Seeder para datos iniciales
 * Crea usuarios y productos de prueba
 */
const seedDatabase = async () => {
  try {
    console.log('🌱 Iniciando seeding de base de datos...');

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

    for (const userData of users) {
      const [user, created] = await User.findOrCreate({
        where: { email: userData.email },
        defaults: userData,
      });
      if (created) {
        console.log(`✅ Usuario creado: ${user.email}`);
      } else {
        console.log(`⚠️ Usuario ya existe: ${user.email}`);
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