const { Visit, Customer, User } = require('../models');
const { Op } = require('sequelize');

class VisitService {
  async create(userId, data) {
    const activeVisit = await Visit.findOne({ where: { userId, departureAt: null } });
    if (activeVisit) throw new Error('Finaliza la visita activa antes de iniciar otra');

    const customer = await Customer.findByPk(data.customerId);
    if (!customer) throw new Error('Cliente no encontrado');

    return Visit.create({
      userId,
      customerId: customer.id,
      visitDate: data.visitDate,
      arrivalAt: new Date(),
      latitude: data.latitude,
      longitude: data.longitude,
      street: data.street.trim(),
      city: data.city.trim(),
      province: data.province.trim(),
      country: data.country.trim(),
    });
  }

  async list(filters = {}) {
    const where = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.dateFrom || filters.dateTo) {
      where.visitDate = {};
      if (filters.dateFrom) where.visitDate[Op.gte] = filters.dateFrom;
      if (filters.dateTo) where.visitDate[Op.lte] = filters.dateTo;
    }

    return Visit.findAll({
      where,
      include: [
        { model: Customer, as: 'customer' },
        { model: User, as: 'user', attributes: ['id', 'username', 'email'] },
      ],
      order: [['arrivalAt', 'DESC']],
    });
  }

  async finish(userId, visitId) {
    const visit = await Visit.findOne({ where: { id: visitId, userId } });
    if (!visit) throw new Error('Visita no encontrada');
    if (visit.departureAt) throw new Error('La visita ya fue finalizada');

    const departureAt = new Date();
    const durationSeconds = Math.max(0, Math.floor((departureAt.getTime() - new Date(visit.arrivalAt).getTime()) / 1000));
    await visit.update({ departureAt, durationSeconds });
    return visit;
  }
}

module.exports = new VisitService();
