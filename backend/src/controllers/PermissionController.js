const PermissionService = require('../services/PermissionService');

/**
 * Controlador de Permisos
 * Maneja las rutas relacionadas con gestión de permisos.
 */
class PermissionController {
  /**
   * Lista todos los permisos
   * GET /permissions
   */
  async getPermissions(req, res) {
    try {
      const permissions = await PermissionService.getAllPermissions();
      res.json({ permissions });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * Asigna permisos a un usuario
   * POST /permissions/assign
   */
  async assignPermissions(req, res) {
    try {
      const { userId, permissionIds } = req.body;
      if (!userId || !permissionIds || !Array.isArray(permissionIds)) {
        return res.status(400).json({ message: 'userId and permissionIds array are required' });
      }

      const assignments = await PermissionService.assignPermissionsToUser(userId, permissionIds);
      res.json({
        message: 'Permissions assigned successfully',
        assignments,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * Obtiene permisos de un usuario
   * GET /permissions/user/:userId
   */
  async getUserPermissions(req, res) {
    try {
      const { userId } = req.params;
      const permissions = await PermissionService.getUserPermissions(parseInt(userId));
      res.json({ permissions });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * Verifica si un usuario tiene un permiso específico
   * GET /permissions/check/:userId/:permissionName
   */
  async checkPermission(req, res) {
    try {
      const { userId, permissionName } = req.params;
      const hasPermission = await PermissionService.userHasPermission(parseInt(userId), permissionName);
      res.json({ hasPermission });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * Inicializa permisos por defecto
   * POST /permissions/init
   */
  async initializePermissions(req, res) {
    try {
      await PermissionService.initializeDefaultPermissions();
      res.json({ message: 'Default permissions initialized successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = new PermissionController();