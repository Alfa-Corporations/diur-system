const ProductRepository = require('../repositories/ProductRepository');
const SupplierRepository = require('../repositories/SupplierRepository');

/**
 * Servicio de Productos
 * Maneja la lógica de negocio para gestión de productos.
 * Incluye validaciones, cálculos y operaciones complejas.
 */
class ProductService {
  /**
   * Crea un nuevo producto
   * @param {Object} productData - Datos del producto
   * @returns {Promise<Object>} Producto creado
   */
  async createProduct(productData) {
    // Validaciones
    if (!productData.name || !productData.price || !productData.partnumber) {
      throw new Error('Name, price and partnumber are required');
    }

    // Verificar partnumber único
    const existingProduct = await ProductRepository.findBypartnumber(productData.partnumber);
    if (existingProduct) {
      throw new Error('partnumber already exists');
    }

    return await ProductRepository.create(productData);
  }

  async createProducts(productsData) {
    if (!Array.isArray(productsData) || productsData.length === 0) {
      throw new Error('Debe enviar un array de productos');
    }

    // 🔥 Obtener campos válidos del modelo Product
    const validFields = Object.keys(Product.rawAttributes);

    const normalizedProducts = productsData.map((product) => {
      // 🔥 Filtrar solo campos que existen en el modelo
      const filteredProduct = {};
      validFields.forEach(field => {
        if (product.hasOwnProperty(field)) {
          // 🔥 Convertir tipos de datos según el modelo
          const attr = Product.rawAttributes[field];
          if (attr.type.constructor.name === 'DECIMAL' && typeof product[field] === 'string') {
            filteredProduct[field] = Number(product[field]) || 0;
          } else if (attr.type.constructor.name === 'INTEGER' && typeof product[field] === 'string') {
            filteredProduct[field] = Number(product[field]) || 0;
          } else if (attr.type.constructor.name === 'BOOLEAN') {
            filteredProduct[field] = Boolean(product[field]);
          } else {
            filteredProduct[field] = product[field];
          }
        }
      });

      return {
        ...filteredProduct,
        price: Number(product.price ?? product.precio ?? 0),
        stock: Number(product.stock ?? 0),
        supplierId: product.supplierId ? Number(product.supplierId) : undefined,
        providerName: product.providerName || product.supplier || product.proveedor || product.supplierName || product.provider || null,
      };
    });

    // ✅ Validar productos
    const invalidProducts = normalizedProducts.filter(
      (p) => !p.name || p.price === 0 || !p.partnumber || (!p.providerName && !p.supplierId)
    );

    if (invalidProducts.length > 0) {
      throw new Error(
        `Hay ${invalidProducts.length} productos inválidos (name, price, partnumber y supplierId/providerName requeridos)`
      );
    }

    // ✅ Obtener partnumbers
    const partnumbers = normalizedProducts.map((p) => p.partnumber);

    // ✅ Validar duplicados en BD
    const existingProducts = await ProductRepository.findBypartnumbers(partnumbers);
    if (existingProducts.length > 0) {
      const existingpartnumbers = existingProducts.map((p) => p.partnumber);
      throw new Error(`partnumbers ya existentes: ${existingpartnumbers.join(', ')}`);
    }

    // 🧠 =========================
    // 🔥 PROVEEDORES (OPTIMIZADO)
    // =========================
    const productsWithProvider = [];
    const providerNames = [...new Set(normalizedProducts
      .filter((p) => !p.supplierId)
      .map((p) => p.providerName)
      .filter(Boolean))];

    const existingProviders = providerNames.length > 0
      ? await SupplierRepository.findBynames(providerNames)
      : [];

    const providerMap = new Map();
    existingProviders.forEach((p) => providerMap.set(p.name, p.id));

    for (const name of providerNames) {
      if (!providerMap.has(name)) {
        const newProvider = await SupplierRepository.create({ name });
        providerMap.set(name, newProvider.id);
      }
    }

    for (const product of normalizedProducts) {
      const supplierId = product.supplierId || providerMap.get(product.providerName);
      const { providerName, ...productPayload } = product;
      productsWithProvider.push({
        ...productPayload,
        supplierId,
      });
    }

    // ✅ Crear productos masivamente
    const createdProducts = await ProductRepository.bulkCreate(productsWithProvider);
    return createdProducts;
  }

  /**
   * Obtiene un producto por ID
   * @param {number} id - ID del producto
   * @returns {Promise<Object>} Producto encontrado
   */
  async getProductById(id) {
    const product = await ProductRepository.findById(id);
    if (!product) {
      throw new Error('Product not found');
    }
    return product;
  }

  /**
   * Actualiza un producto
   * @param {number} id - ID del producto
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Object>} Producto actualizado
   */
  async updateProduct(id, updateData) {
    delete updateData.partnumber
    delete updateData.stock
    return await ProductRepository.update(id, updateData);
  }

  /**
   * Actualiza el stock de un producto
   * @param {number} id - ID del producto
   * @param {number} quantity - Cantidad a ajustar
   * @returns {Promise<Object>} Producto actualizado
   */
  async updateStock(id, quantity) {
    return await ProductRepository.updateStock(id, quantity);
  }

  /**
   * Elimina un producto
   * @param {number} id - ID del producto
   * @returns {Promise<boolean>} True si se eliminó
   */
  async deleteProduct(id) {
    return await ProductRepository.delete(id);
  }

  /**
   * Lista productos con filtros
   * @param {Object} filters - Filtros opcionales
   * @param {number} limit - Límite
   * @param {number} offset - Desplazamiento
   * @returns {Promise<Array>} Lista de productos
   */

  async getProducts() {
    return await ProductRepository.findAll();
  }

  /**
   * Verifica si hay stock suficiente
   * @param {number} id - ID del producto
   * @param {number} quantity - Cantidad requerida
   * @returns {Promise<boolean>} True si hay stock suficiente
   */
  async checkStock(id, quantity) {
    const product = await this.getProductById(id);
    return product.stock >= quantity;
  }
}

module.exports = new ProductService();