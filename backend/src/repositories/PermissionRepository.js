const { Permission, UserPermission, User } = require('../models');

/**
 * Repositorio para operaciones de Permiso
 * Encapsula la lógica de acceso a datos para permisos y asignaciones.
 */
class PermissionRepository {
  /**
   * Crea un nuevo permiso
   * @param {Object} permissionData - Datos del permiso
   * @returns {Promise<Permission>} Permiso creado
   */
  async create(permissionData) {
    return await Permission.create(permissionData);
  }

  /**
   * Encuentra un permiso por ID
   * @param {number} id - ID del permiso
   * @returns {Promise<Permission|null>} Permiso encontrado o null
   */
  async findById(id) {
    return await Permission.findByPk(id);
  }

  async findByName(name) {
    return await Permission.findOne({ where: { name } });
  }

  async findOrCreateByName(permissionData) {
    const [permission, created] = await Permission.findOrCreate({
      where: { name: permissionData.name },
      defaults: permissionData
    });
    if (!created && permission.description !== permissionData.description) {
      await permission.update({ description: permissionData.description });
    }
    return permission;
  }

  /**
   * Lista todos los permisos
   * @returns {Promise<Array<Permission>>} Lista de permisos
   */
  async findAll() {
    return await Permission.findAll({ order: [['name', 'ASC']] });
  }

  /**
   * Asigna permisos a un usuario
   * @param {number} userId - ID del usuario
   * @param {Array<number>} permissionIds - IDs de permisos
   * @returns {Promise<Array<UserPermission>>} Asignaciones creadas
   */
  async assignPermissionsToUser(userId, permissionIds) {
    return await UserPermission.sequelize.transaction(async transaction => {
      await UserPermission.destroy({ where: { userId }, transaction });
      if (permissionIds.length === 0) return [];

      const assignments = permissionIds.map(permissionId => ({ userId, permissionId }));
      return await UserPermission.bulkCreate(assignments, { transaction });
    });
  }

  /**
   * Obtiene permisos de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<Array<Permission>>} Permisos del usuario
   */
  async getUserPermissions(userId) {
    const userPermissions = await UserPermission.findAll({
      where: { userId },
      include: [{ model: Permission, as: 'permission' }]
    });
    return userPermissions.map(up => up.permission);
  }

  /**
   * Verifica si un usuario tiene un permiso específico
   * @param {number} userId - ID del usuario
   * @param {string} permissionName - Nombre del permiso
   * @returns {Promise<boolean>} True si tiene el permiso
   */
  async userHasPermission(userId, permissionName) {
    const count = await UserPermission.count({
      where: { userId },
      include: [{
        model: Permission,
        as: 'permission',
        where: { name: permissionName }
      }]
    });
    return count > 0;
  }
}

module.exports = new PermissionRepository();