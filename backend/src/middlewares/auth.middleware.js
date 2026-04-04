const AuthService = require('../services/AuthService');
const PermissionService = require('../services/PermissionService');

/**
 * Middleware de autenticación JWT
 * Verifica el token JWT en el header Authorization.
 * Si es válido, añade el usuario al request.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    const user = await AuthService.getCurrentUser(token);

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/**
 * Middleware de autorización por permisos
 * Verifica si el usuario tiene al menos uno de los permisos requeridos.
 * Los usuarios con rol 'admin' tienen acceso automático a todas las rutas.
 * @param {...string} requiredPermissions - Permisos requeridos
 */
const authorize = (...requiredPermissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Si el usuario es admin, permitir acceso automático
    if (req.user.role === 'admin') {
      return next();
    }

    for (const permission of requiredPermissions) {
      const hasPermission = await PermissionService.userHasPermission(req.user.id, permission);
      if (hasPermission) {
        return next();
      }
    }

    return res.status(403).json({ message: 'Insufficient permissions' });
  };
};

module.exports = {
  authenticate,
  authorize,
};