const webPush = require('web-push');
const { PushSubscription, User } = require('../models');

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;
const isConfigured = Boolean(publicKey && privateKey && subject);

if (isConfigured) {
  webPush.setVapidDetails(subject, publicKey, privateKey);
}

class NotificationService {
  getPublicKey() {
    return isConfigured ? publicKey : null;
  }

  async saveSubscription(userId, subscription) {
    const [existing] = await PushSubscription.findOrCreate({
      where: { endpoint: subscription.endpoint },
      defaults: {
        userId,
        endpoint: subscription.endpoint,
        subscription,
      },
    });

    if (existing.userId !== userId) {
      const error = new Error('Esta suscripción ya está asociada a otro usuario.');
      error.statusCode = 409;
      throw error;
    }

    await existing.update({ subscription });
  }

  async removeSubscription(userId, endpoint) {
    await PushSubscription.destroy({ where: { userId, endpoint } });
  }

  async sendToAll(notification) {
    if (!isConfigured) return;

    const subscriptions = await PushSubscription.findAll({
      include: [{
        model: User,
        as: 'user',
        attributes: [],
        where: { isActive: true },
        required: true,
      }],
    });

    await Promise.all(subscriptions.map(async savedSubscription => {
      try {
        await webPush.sendNotification(savedSubscription.subscription, JSON.stringify({
          title: 'DIUR SYSTEM',
          message: notification.message,
          type: notification.type,
          timestamp: notification.timestamp,
        }));
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await savedSubscription.destroy();
          return;
        }
        console.error('Push notification delivery failed:', {
          statusCode: error.statusCode,
          endpointHost: (() => {
            try {
              return new URL(savedSubscription.endpoint).host;
            } catch {
              return 'invalid';
            }
          })(),
        });
      }
    }));
  }
}

module.exports = new NotificationService();
