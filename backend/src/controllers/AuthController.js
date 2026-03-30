const AuthService = require('../services/AuthService');
const { validateRequired } = require('../middlewares/validation.middleware');

/**
 * Controlador de Autenticación
 * Maneja las rutas relacionadas con autenticación de usuarios.
 */
class AuthController {
  /**
   * Registra un nuevo usuario
   * POST /auth/register
   */
  async register(req, res) {
    try {
      const userData = req.body;
      const user = await AuthService.register(userData);
      res.status(201).json({
        message: 'User registered successfully',
        user,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * Inicia sesión de usuario
   * POST /auth/login
   */
  async login(req, res) {
    try {
      const { identifier, password } = req.body;
      const result = await AuthService.login(identifier, password);
      res.json({
        message: 'Login successful',
        ...result,
      });
    } catch (error) {
      res.status(401).json({ message: error.message });
    }
  }

  /**
   * Obtiene el perfil del usuario actual
   * GET /auth/profile
   */
  async getProfile(req, res) {
    try {
      res.json({ user: req.user });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Cierra sesión (cliente-side, solo retorna success)
   * POST /auth/logout
   */
  async logout(req, res) {
    try {
      // En una implementación real, podrías invalidar el token en una blacklist
      res.json({ message: 'Logout successful' });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}

module.exports = new AuthController();