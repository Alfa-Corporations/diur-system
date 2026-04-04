const AuthService = require('../services/AuthService');
const UserRepository = require('../repositories/UserRepository');
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
   * Lista usuarios
   * GET /users
   */
  async listUsers(req, res) {
    try {
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = parseInt(req.query.offset, 10) || 0;
      const users = await UserRepository.findAll(limit, offset);
      const usersWithoutPassword = users.map(user => {
        const plainUser = user.toJSON();
        delete plainUser.password;
        return plainUser;
      });
      res.json({ users: usersWithoutPassword });
    } catch (error) {
      console.error('Error in listUsers:', error);
      res.status(500).json({ message: error.message || 'Error listing users' });
    }
  }

  /**
   * Actualiza usuario por ID
   * PUT /users/:id
   */
  async updateUser(req, res) {
    try {
      const userId = Number(req.params.id);
      const updateData = { ...req.body };

      if (updateData.password) {
        const bcrypt = require('bcrypt');
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }

      const updatedUser = await UserRepository.update(userId, updateData);
      const { password, ...userWithoutPassword } = updatedUser.toJSON();
      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.status(400).json({ message: error.message || 'Error updating user' });
    }
  }

  /**
   * Elimina usuario por ID
   * DELETE /users/:id
   */
  async deleteUser(req, res) {
    try {
      const userId = Number(req.params.id);
      const deleted = await UserRepository.delete(userId);
      if (!deleted) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: error.message || 'Error deleting user' });
    }
  }

  /**
   * Inicia sesión de usuario
   * POST /auth/login
   */
  async login(req, res) {
    try {
      const { identifier, password } = req.body;
      console.log('AuthController.login request:', { identifier });
      const result = await AuthService.login(identifier, password);
      res.json({
        message: 'Login successful',
        ...result,
      });
    } catch (error) {
      console.error('AuthController.login failed:', error);
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