import React, { useEffect, useState } from 'react';
import apiService from '../services/apiService';

const decodeVapidKey = (key: string): ArrayBuffer => {
  const padding = '='.repeat((4 - key.length % 4) % 4);
  const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return buffer;
};

const PushNotificationSettings: React.FC = () => {
  const supported = typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    window.isSecureContext;
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supported) return;
    let active = true;
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => registration.pushManager.getSubscription())
      .then(subscription => {
        if (active) setEnabled(Boolean(subscription));
      })
      .catch(() => {
        if (active) setError('No se pudo preparar el servicio de notificaciones.');
      });

    return () => {
      active = false;
    };
  }, [supported]);

  const enablePush = async () => {
    setBusy(true);
    setError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError(permission === 'denied'
          ? 'El navegador bloqueó las notificaciones. Habilítalas en la configuración del sitio.'
          : 'Debes permitir las notificaciones para recibir avisos.');
        return;
      }

      const publicKey = await apiService.getPushPublicKey();
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(publicKey),
      });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error('El navegador devolvió una suscripción incompleta.');
      }

      await apiService.savePushSubscription({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      setEnabled(true);
    } catch (subscriptionError) {
      setError(subscriptionError instanceof Error
        ? subscriptionError.message
        : 'No se pudieron activar las notificaciones push.');
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async () => {
    setBusy(true);
    setError('');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await apiService.removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setEnabled(false);
    } catch (subscriptionError) {
      setError(subscriptionError instanceof Error
        ? subscriptionError.message
        : 'No se pudieron desactivar las notificaciones push.');
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;

  return (
    <div className='notification-push-control'>
      <button
        type='button'
        className='btn btn-outline-primary btn-sm'
        onClick={() => void (enabled ? disablePush() : enablePush())}
        disabled={busy}
        aria-pressed={enabled}
        title={enabled ? 'Desactivar notificaciones push' : 'Activar notificaciones push'}
      >
        {busy ? 'Configurando...' : enabled ? '🔔 Push activado' : '🔕 Activar push'}
      </button>
      {error && <span className='small text-danger d-block' role='status'>{error}</span>}
    </div>
  );
};

export default PushNotificationSettings;
