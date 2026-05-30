const AccountsReceivableRepository = require('../repositories/AccountsReceivableRepository');
const InvoiceService = require('../services/InvoiceService');

class AccountsReceivableController {
  async listPending(req, res) {
    try {
      const accounts = await AccountsReceivableRepository.findPending();
      console.log('[DEBUG] listPending retrieved', accounts.length, 'accounts');
      res.json({ accounts });
    } catch (error) {
      console.error('[ERROR] listPending failed:', error.message);
      res.status(500).json({ message: error.message });
    }
  }

  async get(req, res) {
    try {
      const { id } = req.params;
      const account = await AccountsReceivableRepository.findById(id);
      if (!account) return res.status(404).json({ message: 'Cuenta no encontrada' });
      res.json({ account });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async pay(req, res) {
    try {
      const { id } = req.params;
      const { amount, paymentMethod, paymentReference } = req.body;
      if (!amount || Number(amount) <= 0) return res.status(400).json({ message: 'Monto inválido' });

      const result = await InvoiceService.recordPayment(id, Number(amount), { paymentMethod, paymentReference, userId: req.user?.id });
      // result: { account, payment }
      res.json({ account: result.account, payment: result.payment });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = new AccountsReceivableController();
