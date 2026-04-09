const ProductRepository = require('../repositories/ProductRepository');

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

  /**
 * Crear productos masivamente
 * @param {Array} productsData
 * @returns {Promise<Array>}
  */
  async createProducts(productsData) {
    if (!Array.isArray(productsData) || productsData.length === 0) {
      throw new Error('Debe enviar un array de productos');
    }

    // ✅ Validar productos
    const invalidProducts = productsData.filter(
      p => !p.name || !p.price || !p.partnumber
    );

    if (invalidProducts.length > 0) {
      throw new Error(`Hay ${invalidProducts.length} productos inválidos (name, price, partnumber requeridos)`);
    }

    // ✅ Obtener partnumbers
    const partnumbers = productsData.map(p => p.partnumber);

    // ✅ Buscar duplicados en BD
    const existingProducts = await ProductRepository.findBypartnumbers(partnumbers);

    if (existingProducts.length > 0) {
      const existingpartnumbers = existingProducts.map(p => p.partnumber);
      throw new Error(`partnumbers ya existentes: ${existingpartnumbers.join(', ')}`);
    }

    // ✅ Crear productos masivamente
    const createdProducts = await ProductRepository.bulkCreate(productsData);

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

  async getProducts(filters = {}, limit = 10, offset = 0) {
    return await ProductRepository.findAll(filters, limit, offset);
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