const VisitService = require('../services/VisitService');

class VisitController {
  static async create(req, res) {
    const { customerId, visitDate, latitude, longitude, street, city, province, country } = req.body;
    const [year, month, day] = typeof visitDate === 'string' ? visitDate.split('-').map(Number) : [];
    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    const isValidDate = parsedDate.getUTCFullYear() === year && parsedDate.getUTCMonth() === month - 1 && parsedDate.getUTCDate() === day;
    if (!Number.isSafeInteger(Number(customerId)) || Number(customerId) <= 0 ||
      typeof visitDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(visitDate) || !isValidDate ||
      !Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90 ||
      !Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180 ||
      ![street, city, province, country].every(value => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ message: 'Cliente, coordenadas y dirección completa son obligatorios' });
    }

    try {
      const visit = await VisitService.create(req.user.id, {
        customerId: Number(customerId),
        visitDate,
        latitude: Number(latitude),
        longitude: Number(longitude),
        street,
        city,
        province,
        country,
      });
      return res.status(201).json({ visit });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }

  static async list(req, res) {
    try {
      const { customerId, dateFrom, dateTo, userId } = req.query;
      const filters = {};

      if (req.user.role !== 'admin') {
        filters.userId = req.user.id;
      } else if (userId !== undefined) {
        const parsedUserId = Number(userId);
        if (!Number.isSafeInteger(parsedUserId) || parsedUserId <= 0) {
          return res.status(400).json({ message: 'userId debe ser un entero positivo' });
        }
        filters.userId = parsedUserId;
      }

      if (customerId !== undefined) {
        const parsedCustomerId = Number(customerId);
        if (!Number.isSafeInteger(parsedCustomerId) || parsedCustomerId <= 0) {
          return res.status(400).json({ message: 'customerId debe ser un entero positivo' });
        }
        filters.customerId = parsedCustomerId;
      }

      const isValidDate = value => {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
      };
      if (dateFrom !== undefined) {
        if (!isValidDate(dateFrom)) return res.status(400).json({ message: 'dateFrom debe usar el formato YYYY-MM-DD' });
        filters.dateFrom = dateFrom;
      }
      if (dateTo !== undefined) {
        if (!isValidDate(dateTo)) return res.status(400).json({ message: 'dateTo debe usar el formato YYYY-MM-DD' });
        filters.dateTo = dateTo;
      }
      if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
        return res.status(400).json({ message: 'dateFrom no puede ser posterior a dateTo' });
      }

      const visits = await VisitService.list(filters);
      return res.json({ visits });
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  }

  static async finish(req, res) {
    const visitId = Number(req.params.id);
    if (!Number.isSafeInteger(visitId) || visitId <= 0) {
      return res.status(400).json({ message: 'El identificador de visita no es válido' });
    }

    try {
      const visit = await VisitService.finish(req.user.id, visitId);
      return res.json({ visit });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }
}

module.exports = VisitController;
