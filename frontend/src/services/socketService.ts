import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { Notification as AppNotification } from '../../../shared/types';

/**
 * Servicio de Socket.IO
 * Gestiona conexiones en tiempo real con el servidor
 */
class SocketService {
  private socket: Socket | null = null;
  private maxReconnectAttempts = 5;
  private currentUserData: { id: number; role: string } | null = null;
  private heartbeatInterval: number | null = null;
  private isManuallyDisconnected = false;
  private recentNotifications = new Map<string, number>();

  private clearHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      window.clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();

    this.heartbeatInterval = window.setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000);
  }

  /**
   * Conecta al servidor Socket.IO
   */
  connect(userData?: { id: number; role: string }): void {
    if (userData) {
      this.currentUserData = userData;
    }

    const activeUser = userData ?? this.currentUserData;
    const token = localStorage.getItem('token');

    if (!token) return;

    this.isManuallyDisconnected = false;

    if (this.socket) {
      this.socket.auth = { token };

      if (this.socket.connected) {
        if (activeUser) {
          this.socket.emit('join', activeUser);
          this.socket.emit('join_user_room', activeUser.id);
        }
        this.startHeartbeat();
        return;
      }

      this.socket.connect();
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL?.replace(/\/api\/v1$/, '') || 'http://localhost:8001';

    this.socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000
    });

    this.socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      this.startHeartbeat();

      if (activeUser) {
        this.socket?.emit('join', activeUser);
        this.socket?.emit('join_user_room', activeUser.id);
      }
    });

    this.socket.on('disconnect', reason => {
      console.log('Disconnected from Socket.IO server:', reason);
      this.clearHeartbeat();

      if (this.isManuallyDisconnected || reason === 'io client disconnect') {
        return;
      }
    });

    this.socket.on('connect_error', error => {
      console.error('Socket.IO connection error:', error);
      this.clearHeartbeat();
    });

    this.socket.on('notification', (notification: AppNotification) => {
      this.handleNotification(notification);
    });
  }

  /**
   * Desconecta del servidor
   */
  disconnect(): void {
    this.isManuallyDisconnected = true;
    this.clearHeartbeat();

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.currentUserData = null;
  }

  private getNotificationTypeLabel(type: AppNotification['type']): string {
    switch (type) {
      case 'invoice_created':
        return 'Factura creada';
      case 'invoice_paid':
        return 'Factura pagada';
      case 'invoice_deleted':
        return 'Factura eliminada';
      case 'inventory_updated':
        return 'Inventario actualizado';
      case 'order_created':
        return 'Pedido creado';
      case 'order_updated':
        return 'Pedido actualizado';
      case 'order_assigned':
        return 'Pedido asignado';
      default:
        return 'Notificación del sistema';
    }
  }

  private isDuplicateNotification(notification: AppNotification): boolean {
    const payload = typeof notification.data === 'object' && notification.data !== null ? (notification.data as { invoiceId?: number | string; status?: string }) : {};
    const key = `${notification.type}:${payload.invoiceId ?? 'na'}:${payload.status ?? 'na'}:${notification.message}`;
    const now = Date.now();

    for (const [storedKey, timestamp] of this.recentNotifications.entries()) {
      if (now - timestamp > 10000) {
        this.recentNotifications.delete(storedKey);
      }
    }

    const lastSeen = this.recentNotifications.get(key);
    if (lastSeen && now - lastSeen < 4000) {
      return true;
    }

    this.recentNotifications.set(key, now);
    return false;
  }

  /**
   * Maneja notificaciones entrantes
   */
  private handleNotification(notification: AppNotification): void {
    if (this.isDuplicateNotification(notification)) {
      return;
    }

    window.dispatchEvent(new CustomEvent('socket-notification', { detail: notification }));

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.message, {
        body: `Evento: ${this.getNotificationTypeLabel(notification.type)}`,
        icon: '/favicon.ico'
      });
    }
  }

  /**
   * Emite eventos al servidor
   */
  emit(event: string, data?: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected, event not sent:', event);
    }
  }

  /**
   * Escucha eventos del servidor
   */
  on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Deja de escuchar eventos
   */
  off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  /**
   * Verifica si está conectado
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Solicita permisos para notificaciones del navegador
   */
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;

    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
}

export default new SocketService();
