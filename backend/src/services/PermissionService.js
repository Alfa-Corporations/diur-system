const PermissionRepository = require('../repositories/PermissionRepository');
const { Permission, User } = require('../models');

/**
 * Servicio de Permisos
 * Maneja la lógica de negocio para gestión de permisos y RBAC.
 */
class PermissionService {
  /**
   * Crea un nuevo permiso
   * @param {Object} permissionData - Datos del permiso
   * @returns {Promise<Object>} Permiso creado
   */
  async createPermission(permissionData) {
    if (!permissionData.name) {
      throw new Error('Permission name is required');
    }

    const existing = await PermissionRepository.findByName(permissionData.name);
    if (existing) {
      throw new Error('Permission already exists');
    }

    return await PermissionRepository.create(permissionData);
  }

  /**
   * Lista todos los permisos
   * @returns {Promise<Array<Object>>} Lista de permisos
   */
  async getAllPermissions() {
    return await PermissionRepository.findAll();
  }

  /**
   * Asigna permisos a un usuario
   * @param {number} userId - ID del usuario
   * @param {Array<number>} permissionIds - IDs de permisos
   * @returns {Promise<Array<Object>>} Asignaciones creadas
   */
  async assignPermissionsToUser(userId, permissionIds) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');

    const uniquePermissionIds = [...new Set(permissionIds)];
    const existingPermissions = await Permission.findAll({
      where: { id: uniquePermissionIds },
      attributes: ['id']
    });
    if (existingPermissions.length !== uniquePermissionIds.length) {
      throw new Error('One or more permissions do not exist');
    }

    return await PermissionRepository.assignPermissionsToUser(userId, uniquePermissionIds);
  }

  /**
   * Obtiene permisos de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<Array<Object>>} Permisos del usuario
   */
  async getUserPermissions(userId) {
    return await PermissionRepository.getUserPermissions(userId);
  }

  /**
   * Verifica si un usuario tiene un permiso específico
   * @param {number} userId - ID del usuario
   * @param {string} permissionName - Nombre del permiso
   * @returns {Promise<boolean>} True si tiene el permiso
   */
  async userHasPermission(userId, permissionName) {
    return await PermissionRepository.userHasPermission(userId, permissionName);
  }

  /**
   * Inicializa permisos por defecto
   * @returns {Promise<void>}
   */
  async initializeDefaultPermissions() {
    const defaultPermissions = require('../utils/permissionCatalog');
    for (const permission of defaultPermissions) {
      await PermissionRepository.findOrCreateByName(permission);
    }
  }
}

module.exports = new PermissionService();