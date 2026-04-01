const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const UserRepository = require('../repositories/UserRepository');

/**
 * Servicio de Autenticación
 * Maneja la lógica de negocio para autenticación de usuarios.
 * Incluye registro, login, validación de tokens y gestión de contraseñas.
 */
class AuthService {
  /**
   * Registra un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<Object>} Usuario creado sin contraseña
   */
  async register(userData) {
    const { password, ...userInfo } = userData;

    // Verificar si el usuario ya existe
    const existingUser = await UserRepository.findByEmail(userInfo.email) ||
      await UserRepository.findByUsername(userInfo.username);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const user = await UserRepository.create({
      ...userInfo,
      password: hashedPassword,
    });

    // Retornar usuario sin contraseña
    const { password: _, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
  }

  /**
   * Autentica un usuario
   * @param {string} identifier - Email o username
   * @param {string} password - Contraseña
   * @returns {Promise<Object>} Token y datos del usuario
   */
  async login(identifier, password) {
    if (!identifier || !password) {
      throw new Error('Identifier and password are required');
    }

    const normalizedIdentifier = identifier.trim();

    // Buscar usuario por email o username (case-insensitive)
    let user = await UserRepository.findByEmail(normalizedIdentifier);
    if (!user) {
      user = await UserRepository.findByUsername(normalizedIdentifier);
    }
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '24h' }
    );

    // Retornar token y usuario sin contraseña
    const { password: _, ...userWithoutPassword } = user.toJSON();
    return { token, user: userWithoutPassword };
  }

  /**
   * Verifica un token JWT
   * @param {string} token - Token JWT
   * @returns {Promise<Object>} Payload del token
   */
  async verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Obtiene el usuario actual desde el token
   * @param {string} token - Token JWT
   * @returns {Promise<Object>} Usuario actual
   */
  async getCurrentUser(token) {
    const payload = await this.verifyToken(token);
    const user = await UserRepository.findById(payload.id);
    if (!user) {
      throw new Error('User not found');
    }
    const { password: _, ...userWithoutPassword } = user.toJSON();
    return userWithoutPassword;
  }
}

module.exports = new AuthService();