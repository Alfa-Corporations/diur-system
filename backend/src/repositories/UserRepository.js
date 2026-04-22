const { User, Permission } = require('../models');
const { Op } = require('sequelize');

/**
 * Repositorio para operaciones de Usuario
 * Encapsula la lógica de acceso a datos para el modelo User.
 * Proporciona métodos CRUD y consultas específicas.
 */
class UserRepository {
  /**
   * Crea un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<User>} Usuario creado
   */
  async create(userData) {
    return await User.create(userData);
  }

  /**
   * Encuentra un usuario por ID
   * @param {number} id - ID del usuario
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findById(id) {
    return await User.findByPk(id, {
      include: [{
        model: Permission, as: 'permissions', through: { attributes: [] }, attributes: {
          exclude: ['password', 'createdAt', 'updatedAt']
        }
      }],
      attributes: {
        exclude: ['createdAt', 'updatedAt']
      }
    });
  }

  /**
   * Encuentra un usuario por email
   * @param {string} email - Email del usuario
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findByEmail(email) {
    return await User.findOne({
      where: {
        email: {
          [Op.iLike]: email,
        },
      },
      include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }]
    });
  }

  /**
   * Encuentra un usuario por username
   * @param {string} username - Username del usuario
   * @returns {Promise<User|null>} Usuario encontrado o null
   */
  async findByUsername(username) {
    return await User.findOne({
      where: {
        username: {
          [Op.iLike]: username,
        },
      },
      include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }]
    });
  }

  /**
   * Actualiza un usuario
   * @param {number} id - ID del usuario
   * @param {Object} updateData - Datos a actualizar
   * @returns {Promise<User>} Usuario actualizado
   */
  async update(id, updateData) {
    const user = await User.findByPk(id);
    if (!user) throw new Error('User not found');
    return await user.update(updateData);
  }

  /**
   * Elimina un usuario
   * @param {number} id - ID del usuario
   * @returns {Promise<boolean>} True si se eliminó
   */
  async delete(id) {
    const user = await User.findByPk(id);
    if (!user) return false;
    await user.destroy();
    return true;
  }

  /**
   * Lista usuarios con paginación
   * @param {number} limit - Límite de resultados
   * @param {number} offset - Desplazamiento
   * @returns {Promise<Array<User>>} Lista de usuarios
   */
  async findAll(limit = 10, offset = 0) {
    return await User.findAll({
      limit,
      offset,
      include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }]
    });
  }
}

module.exports = new UserRepository();