import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { Notification as AppNotification } from '../../../shared/types';

/**
 * Servicio de Socket.IO
 * Gestiona conexiones en tiempo real con el servidor
 */
class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * Conecta al servidor Socket.IO
   */
  connect(userData?: { id: number; role: string }): void {
    if (this.socket?.connected) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    this.socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:8001', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      this.reconnectAttempts = 0;

      // Unirse a salas basadas en el rol
      if (userData) {
        this.socket?.emit('join', userData);
        this.socket?.emit('join_user_room', userData.id);
      }
    });

    this.socket.on('disconnect', reason => {
      console.log('Disconnected from Socket.IO server:', reason);
      this.handleReconnect();
    });

    this.socket.on('connect_error', error => {
      console.error('Socket.IO connection error:', error);
      this.handleReconnect();
    });

    // Escuchar notificaciones
    this.socket.on('notification', (notification: AppNotification) => {
      this.handleNotification(notification);
    });

    // Mantener conexión activa
    setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, 30000); // Ping cada 30 segundos
  }

  /**
   * Desconecta del servidor
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Maneja reconexión automática
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`Attempting to reconnect in ${delay}ms...`);

      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  /**
   * Maneja notificaciones entrantes
   */
  private handleNotification(notification: AppNotification): void {
    // Emitir evento personalizado para que los componentes lo escuchen
    window.dispatchEvent(new CustomEvent('socket-notification', { detail: notification }));

    // Mostrar notificación del navegador si es soportado
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.message, {
        body: `Tipo: ${notification.type}`,
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
