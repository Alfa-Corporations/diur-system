const AuthService = require('../services/AuthService');
const PermissionService = require('../services/PermissionService');
const loginAttempts = new Map();
const loginWindowMs = 15 * 60 * 1000;
const maxLoginAttempts = 10;

const limitLoginAttempts = (req, res, next) => {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  let attempts = loginAttempts.get(key);

  if (!attempts || now - attempts.startedAt >= loginWindowMs) {
    attempts = { startedAt: now, count: 0 };
    loginAttempts.set(key, attempts);
  }

  if (attempts.count >= maxLoginAttempts) {
    const retryAfter = Math.ceil((attempts.startedAt + loginWindowMs - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ message: 'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.' });
  }

  attempts.count += 1;
  res.on('finish', () => {
    if (res.statusCode < 400) loginAttempts.delete(key);
  });
  if (loginAttempts.size > 10000) {
    for (const [ip, entry] of loginAttempts) {
      if (now - entry.startedAt >= loginWindowMs) loginAttempts.delete(ip);
    }
  }
  return next();
};

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

const requirePasswordChange = (req, res, next) => {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'Debes cambiar tu contraseña antes de usar el sistema.',
    });
  }
  return next();
};

module.exports = {
  authenticate,
  authorize,
  requirePasswordChange,
  limitLoginAttempts,
};