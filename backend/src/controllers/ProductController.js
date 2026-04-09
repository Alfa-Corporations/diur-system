const ProductService = require('../services/ProductService');

/**
 * Controlador de Productos
 * Maneja las rutas relacionadas con gestión de productos.
 */
class ProductController {
  /**
   * Crea un nuevo producto
   * POST /products
   */
  async createProduct(req, res) {
    try {
      const productData = req.body;
      const product = await ProductService.createProduct(productData);
      res.status(201).json({
        message: 'Product created successfully',
        product,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * Crea productos masivo
   * POST /products
   */
  async createProducts(req, res) {
    try {
      const { products } = req.body;
      const product = await ProductService.createProducts(products);
      res.status(201).json({
        message: 'Product created successfully',
        product,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * Obtiene un producto por ID
   * GET /products/:id
   */
  async getProduct(req, res) {
    try {
      const { id } = req.params;
      const product = await ProductService.getProductById(id);
      res.json({ product });
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }

  /**
   * Lista productos con filtros
   * GET /products
   */
  async getProducts(req, res) {
    try {
      const { category, isActive, limit = 100, offset = 0 } = req.query;
      const filters = {};
      if (category) filters.category = category;
      if (isActive !== undefined) filters.isActive = isActive === 'true';

      const products = await ProductService.getProducts(filters, parseInt(limit), parseInt(offset));
      res.json({ products });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  /**
   * Actualiza un producto
   * PUT /products/:id
   */
  async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const product = await ProductService.updateProduct(id, updateData);
      res.json({
        message: 'Product updated successfully',
        product,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * Actualiza el stock de un producto
   * PATCH /products/:id/stock
   */
  async updateStock(req, res) {
    try {
      const { id } = req.params;
      const { quantity } = req.body;
      const product = await ProductService.updateStock(id, quantity);
      res.json({
        message: 'Stock updated successfully',
        product,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * Elimina un producto
   * DELETE /products/:id
   */
  async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      const deleted = await ProductService.deleteProduct(id);
      if (deleted) {
        res.json({ message: 'Product deleted successfully' });
      } else {
        res.status(404).json({ message: 'Product not found' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}

module.exports = new ProductController();