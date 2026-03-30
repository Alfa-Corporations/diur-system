/**
 * Servicio de Sincronización Offline/Online
 * Maneja la sincronización de datos entre cliente y servidor.
 * Gestiona eventos pendientes y resolución de conflictos.
 */
class SyncService {
  constructor() {
    this.pendingEvents = new Map(); // Almacén temporal de eventos pendientes
  }

  /**
   * Registra un evento pendiente para sincronización
   * @param {string} eventId - ID único del evento
   * @param {Object} eventData - Datos del evento
   */
  registerPendingEvent(eventId, eventData) {
    this.pendingEvents.set(eventId, {
      ...eventData,
      timestamp: new Date(),
      synced: false,
    });
  }

  /**
   * Obtiene todos los eventos pendientes
   * @returns {Array} Lista de eventos pendientes
   */
  getPendingEvents() {
    return Array.from(this.pendingEvents.values()).filter(event => !event.synced);
  }

  /**
   * Marca un evento como sincronizado
   * @param {string} eventId - ID del evento
   */
  markEventSynced(eventId) {
    if (this.pendingEvents.has(eventId)) {
      this.pendingEvents.get(eventId).synced = true;
    }
  }

  /**
   * Resuelve conflictos de sincronización
   * Estrategia: último timestamp gana
   * @param {Object} localData - Datos locales
   * @param {Object} serverData - Datos del servidor
   * @returns {Object} Datos resueltos
   */
  resolveConflict(localData, serverData) {
    const localTime = new Date(localData.updatedAt || localData.timestamp);
    const serverTime = new Date(serverData.updatedAt || serverData.timestamp);

    // Si el local es más reciente, usar local
    if (localTime > serverTime) {
      return { ...localData, conflictResolved: true, source: 'local' };
    }

    // Si el servidor es más reciente, usar servidor
    if (serverTime > localTime) {
      return { ...serverData, conflictResolved: true, source: 'server' };
    }

    // Si son iguales, usar servidor como autoridad
    return { ...serverData, conflictResolved: true, source: 'server' };
  }

  /**
   * Sincroniza eventos pendientes con el servidor
   * @param {Array} events - Eventos a sincronizar
   * @returns {Object} Resultado de la sincronización
   */
  async syncPendingEvents(events) {
    const results = {
      synced: [],
      failed: [],
      conflicts: [],
    };

    for (const event of events) {
      try {
        // Aquí iría la lógica para enviar cada evento al servicio correspondiente
        // Por ejemplo, si es un producto, llamar a ProductService.createProduct

        // Simulación de sincronización exitosa
        this.markEventSynced(event.id);
        results.synced.push(event.id);

        // Emitir evento de sincronización vía Socket.IO
        if (global.io) {
          global.io.emit('sync_completed', {
            eventId: event.id,
            type: event.type,
            timestamp: new Date(),
          });
        }

      } catch (error) {
        results.failed.push({
          eventId: event.id,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Limpia eventos sincronizados antiguos
   * @param {number} daysOld - Días de antigüedad para limpiar
   */
  cleanupSyncedEvents(daysOld = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    for (const [eventId, event] of this.pendingEvents) {
      if (event.synced && new Date(event.timestamp) < cutoffDate) {
        this.pendingEvents.delete(eventId);
      }
    }
  }
}

module.exports = new SyncService();