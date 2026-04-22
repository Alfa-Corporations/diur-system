const { Op } = require('sequelize');
const { Suppliers } = require('../models');

/**
 * Repositorio para operaciones de Producto
 * Encapsula la lógica de acceso a datos para el modelo Suppliers.
 * Proporciona métodos CRUD y consultas específicas.
 */
class SupplierRepository {
  /**
   * Crea un nuevo proveedor
   * @param {Object} supplierData - Datos del proveedor
   * @returns {Promise<Supplier>} Producto creado
   */
  async create(supplierData) {
    return await Suppliers.create(supplierData);
  }

  /**
   * Crea un nuevo proveedor
   * @param {Array} supplierData - Datos del proveedor
   * @returns {Promise<Supplier>} Producto creado
   */
  async bulkCreate(supplierData) {
    return await Suppliers.bulkCreate(supplierData);
  }

  /**
   * Encuentra un proveedor por ID
   * @param {number} id - ID del proveedor
   * @returns {Promise<Supplier|null>} Producto encontrado o null
   */
  async findById(id) {
    return await Suppliers.findByPk(id);
  }

  /**
   * Encuentra un proveedor por name
   * @param {string} name - nombre del proveedor
   * @returns {Promise<Supplier|null>} Producto encontrado o null
   */
  async findByName(name) {
    return await Suppliers.findOne({ where: { name } });
  }

  /**
   * Encuentra todos los proveedor
   * @param {Array} names - nombres de lo proveedores
   * @returns {Promise<Supplier|null>} Producto encontrado o null
   */
  async findBynames(names) {
    return await Suppliers.findAll({
      where: {
        name: {
          [Op.in]: names
        }
      }
    });
  }

  /**
   * Actualiza un proveedor
   * @param {number} id - ID del proveedor
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<Supplier>} Producto actualizado
   */
  async update(id, updateData) {
    const product = await Suppliers.findByPk(id);
    if (!product) throw new Error('Supplier not found');
    return await product.update(updateData);
  }

  /**
   * Actualiza el stock de un proveedor
   * @param {number} id - ID del proveedor
   * @param {number} quantity - Cantidad a agregar/restar
   * @returns {Promise<Supplier>} Producto actualizado
   */
  async updateStock(id, quantity) {
    const product = await Suppliers.findByPk(id);
    if (!product) throw new Error('Supplier not found');
    const newStock = product.stock + quantity;
    if (newStock < 0) throw new Error('Insufficient stock');
    return await product.update({ stock: newStock });
  }

  /**
   * Elimina un proveedor
   * @param {number} id - ID del proveedor
   * @returns {Promise<boolean>} True si se eliminó
   */
  async delete(id) {
    const product = await Suppliers.findByPk(id);
    if (!product) return false;
    await product.destroy();
    return true;
  }

  /**
   * Lista productos con paginación y filtros
   * @param {Object} filters - Filtros opcionales
   * @param {number} limit - Límite de resultados
   * @param {number} offset - Desplazamiento
   * @returns {Promise<Array<Supplier>>} Lista de productos
   */
  async findAll() {
    /* const where = {};
    if (filters.category) where.category = filters.category;
    if (filters.isActive !== undefined) where.isActive = filters.isActive; */
    return await Suppliers.findAll({
      include: [
        {
          model: Suppliers,
          as: 'supplier',
          attributes: ['id', 'name'] // 👈 evita traer todo
        }
      ]
    });
  }
}

module.exports = new SupplierRepository();