// services/CustomerService.js

const CustomerRepository = require('../repositories/CustomerRepository');

class CustomerService {
  async createCustomer(data) {
    if (!data.name) {
      throw new Error('Customer name is required');
    }

    const existing = await CustomerRepository.findByName(data.name);
    if (existing) {
      throw new Error('Customer already exists');
    }

    return await CustomerRepository.create(data);
  }

  async getCustomers() {
    return await CustomerRepository.findAll();
  }

  async getCustomerById(id) {
    const customer = await CustomerRepository.findById(id);
    if (!customer) throw new Error('Customer not found');
    return customer;
  }

  async updateCustomer(id, data) {
    return await CustomerRepository.update(id, data);
  }

  async deleteCustomer(id) {
    const deleted = await CustomerRepository.delete(id);
    if (!deleted) throw new Error('Customer not found');
    return true;
  }
}

module.exports = new CustomerService();