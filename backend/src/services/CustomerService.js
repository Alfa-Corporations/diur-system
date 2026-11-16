// services/CustomerService.js

const CustomerRepository = require('../repositories/CustomerRepository');
const { Customer } = require('../models');

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

  async importCustomers(records) {
    if (!Array.isArray(records) || records.length === 0 || records.length > 500) {
      throw new Error('La importación debe incluir entre 1 y 500 clientes por lote.');
    }

    const result = { created: 0, updated: 0, errors: [] };
    for (const [index, record] of records.entries()) {
      const name = typeof record?.name === 'string' ? record.name.trim() : '';
      if (!name) {
        result.errors.push({
          file: record?.source,
          row: record?.row || index + 1,
          message: 'Falta el nombre del cliente.',
        });
        continue;
      }

      const identificationNumber = String(record.identificationNumber || '').trim() || null;
      const identificationType = ['none', 'cedula', 'ruc', 'passport'].includes(record.identificationType)
        ? record.identificationType
        : identificationNumber ? (identificationNumber.length > 10 ? 'ruc' : 'cedula') : 'none';
      const payload = {
        name,
        identificationType,
        identificationNumber,
        email: String(record.email || '').trim().toLowerCase() || null,
        phone: String(record.phone || '').trim() || null,
        address: String(record.address || '').trim() || null,
        isFinalConsumer: false,
      };

      try {
        const existing = identificationNumber
          ? await Customer.findOne({ where: { identificationType, identificationNumber } })
          : await Customer.findOne({ where: Customer.sequelize.where(
            Customer.sequelize.fn('LOWER', Customer.sequelize.col('name')),
            name.toLowerCase()
          ) });

        if (existing) {
          await existing.update(Object.fromEntries(
            Object.entries(payload).filter(([, value]) => value !== null && value !== '')
          ));
          result.updated += 1;
        } else {
          await Customer.create(payload);
          result.created += 1;
        }
      } catch (error) {
        result.errors.push({
          file: record?.source,
          row: record?.row || index + 1,
          message: error.message || 'No se pudo guardar este cliente.',
        });
      }
    }

    return result;
  }
}

module.exports = new CustomerService();