// controllers/CustomerController.js

const CustomerService = require('../services/CustomerService');

class CustomerController {
  static async createCustomer(req, res) {
    try {
      const customer = await CustomerService.createCustomer(req.body);
      res.status(201).json(customer);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  static async getCustomers(req, res) {
    try {
      const customers = await CustomerService.getCustomers();
      res.json({
        customers,
        totalCount: customers.length
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  static async updateCustomer(req, res) {
    try {
      const { id } = req.params;

      const customer = await CustomerService.updateCustomer(id, req.body);

      res.json(customer);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  static async deleteCustomer(req, res) {
    try {
      const { id } = req.params;

      await CustomerService.deleteCustomer(id);

      res.json({ message: 'Cliente eliminado' });
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }
}

module.exports = CustomerController;