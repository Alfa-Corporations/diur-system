const { Suppliers } = require('../models');

class SupplierController {
  /**
   * Obtener todos los proveedores
   */
  static async getSuppliers(req, res) {
    try {
      const suppliers = await Suppliers.findAll({
        where: { isActive: true },
        order: [['name', 'ASC']]
      });

      return res.json({
        suppliers,
        totalCount: suppliers.length
      });
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      return res.status(500).json({
        message: 'Error fetching suppliers',
        error: error.message
      });
    }
  }

  /**
   * Obtener un proveedor específico
   */
  static async getSupplier(req, res) {
    try {
      const { id } = req.params;
      const supplier = await Suppliers.findByPk(id);

      if (!supplier) {
        return res.status(404).json({ message: 'Supplier not found' });
      }

      return res.json({ supplier });
    } catch (error) {
      console.error('Error fetching supplier:', error);
      return res.status(500).json({
        message: 'Error fetching supplier',
        error: error.message
      });
    }
  }

  /**
   * Crear un nuevo proveedor
   */
  static async createSupplier(req, res) {
    try {
      const { name, ruc, phone, email, address, contactName } = req.body;

      if (!name) {
        return res.status(400).json({ message: 'Supplier name is required' });
      }

      const supplier = await Suppliers.create({
        name,
        ruc,
        phone,
        email,
        address,
        contactName,
        isActive: true
      });

      return res.status(201).json({ supplier });
    } catch (error) {
      console.error('Error creating supplier:', error);
      return res.status(500).json({
        message: 'Error creating supplier',
        error: error.message
      });
    }
  }

  /**
   * Actualizar un proveedor
   */
  static async updateSupplier(req, res) {
    try {
      const { id } = req.params;
      const { name, ruc, phone, email, address, contactName, isActive } = req.body;

      const supplier = await Suppliers.findByPk(id);

      if (!supplier) {
        return res.status(404).json({ message: 'Supplier not found' });
      }

      await supplier.update({
        name: name || supplier.name,
        ruc: ruc !== undefined ? ruc : supplier.ruc,
        phone: phone !== undefined ? phone : supplier.phone,
        email: email !== undefined ? email : supplier.email,
        address: address !== undefined ? address : supplier.address,
        contactName: contactName !== undefined ? contactName : supplier.contactName,
        isActive: isActive !== undefined ? isActive : supplier.isActive
      });

      return res.json({ supplier });
    } catch (error) {
      console.error('Error updating supplier:', error);
      return res.status(500).json({
        message: 'Error updating supplier',
        error: error.message
      });
    }
  }

  /**
   * Eliminar un proveedor (soft delete)
   */
  static async deleteSupplier(req, res) {
    try {
      const { id } = req.params;

      const supplier = await Suppliers.findByPk(id);

      if (!supplier) {
        return res.status(404).json({ message: 'Supplier not found' });
      }

      await supplier.update({ isActive: false });

      return res.json({ message: 'Supplier deleted successfully' });
    } catch (error) {
      console.error('Error deleting supplier:', error);
      return res.status(500).json({
        message: 'Error deleting supplier',
        error: error.message
      });
    }
  }
}

module.exports = SupplierController;
