import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SyncEvent, RealtimeNotification } from '../../../../shared/types';

/**
 * Slice de sincronización offline/online
 * Gestiona eventos pendientes y estado de conectividad
 */
interface SyncState {
  isOnline: boolean;
  pendingEvents: SyncEvent[];
  notifications: RealtimeNotification[];
  syncing: boolean;
  lastSync: string | null;
  error: string | null;
}

const initialState: SyncState = {
  isOnline: navigator.onLine,
  pendingEvents: [],
  notifications: [],
  syncing: false,
  lastSync: null,
  error: null
};

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    setOnline: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    addPendingEvent: (state, action: PayloadAction<SyncEvent>) => {
      state.pendingEvents.push(action.payload);
      // Guardar en localStorage para persistencia
      localStorage.setItem('pendingEvents', JSON.stringify(state.pendingEvents));
    },
    removePendingEvent: (state, action: PayloadAction<string>) => {
      state.pendingEvents = state.pendingEvents.filter(event => event.id !== action.payload);
      localStorage.setItem('pendingEvents', JSON.stringify(state.pendingEvents));
    },
    clearPendingEvents: state => {
      state.pendingEvents = [];
      localStorage.removeItem('pendingEvents');
    },
    startSync: state => {
      state.syncing = true;
      state.error = null;
    },
    syncSuccess: (state, action: PayloadAction<{ syncedEvents: string[]; lastSync: string }>) => {
      state.syncing = false;
      state.lastSync = action.payload.lastSync;
      // Remover eventos sincronizados
      state.pendingEvents = state.pendingEvents.filter(event => !action.payload.syncedEvents.includes(event.id));
      localStorage.setItem('pendingEvents', JSON.stringify(state.pendingEvents));
      state.error = null;
    },
    syncFailure: (state, action: PayloadAction<string>) => {
      state.syncing = false;
      state.error = action.payload;
    },
    addNotification: (state, action: PayloadAction<RealtimeNotification>) => {
      const incoming = action.payload;
      const incomingData = typeof incoming.data === 'object' && incoming.data !== null ? (incoming.data as { invoiceId?: number | string; status?: string }) : {};
      const incomingTime = new Date(incoming.timestamp).getTime();

      const isDuplicate = state.notifications.some(notification => {
        const existingData = typeof notification.data === 'object' && notification.data !== null ? (notification.data as { invoiceId?: number | string; status?: string }) : {};
        const existingTime = new Date(notification.timestamp).getTime();

        return (
          notification.type === incoming.type && String(existingData.invoiceId ?? '') === String(incomingData.invoiceId ?? '') && String(existingData.status ?? '') === String(incomingData.status ?? '') && Math.abs(existingTime - incomingTime) < 4000
        );
      });

      if (isDuplicate) {
        return;
      }

      state.notifications.unshift(incoming);
      // Mantener solo las últimas 50 notificaciones
      if (state.notifications.length > 50) {
        state.notifications = state.notifications.slice(0, 50);
      }
    },
    clearNotifications: state => {
      state.notifications = [];
    },
    markNotificationRead: (state, action: PayloadAction<number>) => {
      // Aquí podríamos agregar lógica para marcar como leída
      // Por simplicidad, solo removemos la notificación
      state.notifications.splice(action.payload, 1);
    },
    loadFromStorage: state => {
      // Cargar eventos pendientes del localStorage
      const stored = localStorage.getItem('pendingEvents');
      if (stored) {
        try {
          state.pendingEvents = JSON.parse(stored);
        } catch (error) {
          console.error('Error loading pending events from storage:', error);
          state.pendingEvents = [];
        }
      }
    }
  }
});

export const { setOnline, addPendingEvent, removePendingEvent, clearPendingEvents, startSync, syncSuccess, syncFailure, addNotification, clearNotifications, markNotificationRead, loadFromStorage } = syncSlice.actions;

export default syncSlice.reducer;
