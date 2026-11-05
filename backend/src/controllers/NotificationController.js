const NotificationService = require('../services/NotificationService');

class NotificationController {
  static getPublicKey(req, res) {
    const key = NotificationService.getPublicKey();
    if (!key) {
      return res.status(503).json({ message: 'Las notificaciones push no están configuradas en el servidor.' });
    }
    return res.json({ publicKey: key });
  }

  static async subscribe(req, res) {
    const { endpoint, keys } = req.body || {};
    if (typeof endpoint !== 'string' || endpoint.length > 2048) {
      return res.status(400).json({ message: 'La suscripción push no es válida.' });
    }

    let parsedEndpoint;
    try {
      parsedEndpoint = new URL(endpoint);
    } catch {
      return res.status(400).json({ message: 'La suscripción push no es válida.' });
    }

    const host = parsedEndpoint.hostname.toLowerCase();
    const isKnownPushService = host === 'fcm.googleapis.com' ||
      host === 'web.push.apple.com' ||
      host === 'push.services.mozilla.com' ||
      host.endsWith('.push.services.mozilla.com');
    if (parsedEndpoint.protocol !== 'https:' || (parsedEndpoint.port && parsedEndpoint.port !== '443') ||
      parsedEndpoint.username || parsedEndpoint.password || !isKnownPushService ||
      typeof keys?.p256dh !== 'string' || keys.p256dh.length < 16 || keys.p256dh.length > 256 ||
      typeof keys?.auth !== 'string' || keys.auth.length < 16 || keys.auth.length > 256) {
      return res.status(400).json({ message: 'La suscripción push no es válida.' });
    }
    if (!NotificationService.getPublicKey()) {
      return res.status(503).json({ message: 'Las notificaciones push no están configuradas en el servidor.' });
    }

    try {
      await NotificationService.saveSubscription(req.user.id, { endpoint, keys });
      return res.status(201).json({ message: 'Notificaciones push activadas.' });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error('Could not save push subscription:', error);
      return res.status(500).json({ message: 'No se pudo guardar la suscripción push.' });
    }
  }

  static async unsubscribe(req, res) {
    const { endpoint } = req.body || {};
    if (typeof endpoint !== 'string' || endpoint.length > 2048) {
      return res.status(400).json({ message: 'El endpoint de la suscripción no es válido.' });
    }

    let parsedEndpoint;
    try {
      parsedEndpoint = new URL(endpoint);
    } catch {
      return res.status(400).json({ message: 'El endpoint de la suscripción no es válido.' });
    }
    if (parsedEndpoint.protocol !== 'https:') {
      return res.status(400).json({ message: 'El endpoint de la suscripción no es válido.' });
    }

    try {
      await NotificationService.removeSubscription(req.user.id, endpoint);
      return res.status(204).end();
    } catch (error) {
      console.error('Could not remove push subscription:', error);
      return res.status(500).json({ message: 'No se pudo desactivar la suscripción push.' });
    }
  }
}

module.exports = NotificationController;
