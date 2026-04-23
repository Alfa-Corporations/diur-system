// repositories/CustomerRepository.js

const { Customer } = require('../models');

class CustomerRepository {
  async create(data) {
    return await Customer.create(data);
  }

  async findAll() {
    return await Customer.findAll();
  }

  async findById(id) {
    return await Customer.findByPk(id);
  }

  async findByName(name) {
    return await Customer.findOne({ where: { name } });
  }

  async update(id, data) {
    const customer = await Customer.findByPk(id);
    if (!customer) throw new Error('Customer not found');
    return await customer.update(data);
  }

  async delete(id) {
    const customer = await Customer.findByPk(id);
    if (!customer) return false;
    await customer.destroy();
    return true;
  }
}

module.exports = new CustomerRepository();