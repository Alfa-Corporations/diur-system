const { Op } = require('sequelize');
const { Product } = require('../models');

/**
 * Repositorio para operaciones de Producto
 * Encapsula la lógica de acceso a datos para el modelo Product.
 * Proporciona métodos CRUD y consultas específicas.
 */
class ProductRepository {
  /**
   * Crea un nuevo producto
   * @param {Object} productData - Datos del producto
   * @returns {Promise<Product>} Producto creado
   */
  async create(productData) {
    return await Product.create(productData);
  }

  /**
   * Crea un nuevo producto
   * @param {Array} productData - Datos del producto
   * @returns {Promise<Product>} Producto creado
   */
  async bulkCreate(productData) {
    return await Product.bulkCreate(productData);
  }

  /**
   * Encuentra un producto por ID
   * @param {number} id - ID del producto
   * @returns {Promise<Product|null>} Producto encontrado o null
   */
  async findById(id) {
    return await Product.findByPk(id);
  }

  /**
   * Encuentra un producto por SKU
   * @param {string} sku - SKU del producto
   * @returns {Promise<Product|null>} Producto encontrado o null
   */
  async findBySku(sku) {
    return await Product.findOne({ where: { sku } });
  }

  async findBySkus(skus) {
    return await Product.findAll({
      where: {
        partnumber: {
          [Op.in]: skus
        }
      }
    });
  }

  /**
   * Actualiza un producto
   * @param {number} id - ID del producto
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Product>} Producto actualizado
   */
  async update(id, updateData) {
    const product = await Product.findByPk(id);
    if (!product) throw new Error('Product not found');
    return await product.update(updateData);
  }

  /**
   * Actualiza el stock de un producto
   * @param {number} id - ID del producto
   * @param {number} quantity - Cantidad a agregar/restar
   * @returns {Promise<Product>} Producto actualizado
   */
  async updateStock(id, quantity) {
    const product = await Product.findByPk(id);
    if (!product) throw new Error('Product not found');
    const newStock = product.stock + quantity;
    if (newStock < 0) throw new Error('Insufficient stock');
    return await product.update({ stock: newStock });
  }

  /**
   * Elimina un producto
   * @param {number} id - ID del producto
   * @returns {Promise<boolean>} True si se eliminó
   */
  async delete(id) {
    const product = await Product.findByPk(id);
    if (!product) return false;
    await product.destroy();
    return true;
  }

  /**
   * Lista productos con paginación y filtros
   * @param {Object} filters - Filtros opcionales
   * @param {number} limit - Límite de resultados
   * @param {number} offset - Desplazamiento
   * @returns {Promise<Array<Product>>} Lista de productos
   */
  async findAll(filters = {}, limit = 10, offset = 0) {
    const where = {};
    if (filters.category) where.category = filters.category;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    return await Product.findAll({ where, limit, offset });
  }
}

module.exports = new ProductRepository();