const ProductService = require('../services/ProductService');
const imageStorage = require('../utils/imageStorage');

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
      const createdProducts = await ProductService.createProducts(products);
      res.status(201).json({
        message: 'Products created successfully',
        products: createdProducts,
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
      const { category, isActive } = req.query;
      const filters = {};
      if (category) filters.category = category;
      if (isActive !== undefined) filters.isActive = isActive === 'true';

      const products = await ProductService.getProducts(filters);
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

  async uploadImage(req, res) {
    let storedImage;
    let saved = false;
    try {
      const { id } = req.params;
      const product = await ProductService.getProductById(id);
      storedImage = await imageStorage.storeImage('products', id, req.file.buffer, req.file.mimetype);
      const updatedProduct = await ProductService.updateProduct(id, {
        foto: `/media/products/${storedImage.filename}`,
      });
      saved = true;

      if (product.foto) {
        const previousFilename = product.foto.split('/').pop();
        await imageStorage.removeStoredImage('products', previousFilename).catch(error => {
          console.error('Could not remove previous product image:', error);
        });
      }

      res.json({ message: 'Foto del producto guardada.', product: updatedProduct });
    } catch (error) {
      if (storedImage && !saved) {
        await imageStorage.removeStoredImage('products', storedImage.filename).catch(cleanupError => {
          console.error('Could not clean up failed product image:', cleanupError);
        });
      }
      const status = error.message === 'Product not found' ? 404
        : error.code === 'INVALID_IMAGE' ? 400
          : error.code ? 500 : 400;
      if (status === 500) console.error('Could not save product image:', error);
      res.status(status).json({
        message: status === 500 ? 'No se pudo guardar la imagen del producto.' : error.message,
      });
    }
  }

  async removeImage(req, res) {
    try {
      const { id } = req.params;
      const product = await ProductService.getProductById(id);
      let updatedProduct = product;
      if (product.foto) {
        updatedProduct = await ProductService.updateProduct(id, { foto: null });
        const filename = product.foto.split('/').pop();
        await imageStorage.removeStoredImage('products', filename).catch(error => {
          console.error('Could not remove deleted product image:', error);
        });
      }
      res.json({ message: 'Foto del producto eliminada.', product: updatedProduct });
    } catch (error) {
      res.status(error.message === 'Product not found' ? 404 : 400).json({ message: error.message });
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
      if (error.message && error.message.includes('movimientos asociados')) {
        return res.status(409).json({ message: error.message });
      }
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}

module.exports = new ProductController();