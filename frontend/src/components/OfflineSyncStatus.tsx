import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Spinner } from 'react-bootstrap';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { startSync, syncFailure, syncSuccess } from '../redux/slices/syncSlice';
import localDBService from '../services/localDBService';
import offlineSyncService from '../services/offlineSyncService';
import type { SyncEvent } from '../../../shared/types';

const OfflineSyncStatus: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isOnline, syncing, lastSync, error } = useAppSelector(state => state.sync);
  const { user } = useAppSelector(state => state.auth);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflicts, setConflicts] = useState<SyncEvent[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const refreshQueueStatus = useCallback(async () => {
    const [storage, pendingConflicts] = await Promise.all([
      localDBService.getStorageInfo(),
      localDBService.getConflicts(),
    ]);
    setPendingCount(storage.pendingEvents);
    setConflicts(pendingConflicts);
  }, []);

  useEffect(() => {
    void refreshQueueStatus();
  }, [refreshQueueStatus, syncing]);

  const synchronize = async () => {
    if (!user || !isOnline || syncing) return;
    dispatch(startSync());
    try {
      await localDBService.ensureOwner(user.id);
      const { syncedEventIds, failedEvents } = await offlineSyncService.syncPendingChanges();
      const snapshotErrors = await offlineSyncService.refreshLocalSnapshots(user);
      dispatch(syncSuccess({ syncedEvents: syncedEventIds, lastSync: new Date().toISOString() }));
      if (failedEvents.length > 0) {
        dispatch(syncFailure(`Quedaron ${failedEvents.length} cambio(s) pendientes o en conflicto.`));
      } else if (snapshotErrors.length > 0) {
        dispatch(syncFailure(`Algunos datos no pudieron actualizarse: ${snapshotErrors.join('; ')}`));
      }
    } catch (syncError) {
      dispatch(syncFailure(syncError instanceof Error ? syncError.message : 'No se pudo completar la sincronización.'));
    } finally {
      await refreshQueueStatus();
    }
  };

  const resolveConflict = async (conflict: SyncEvent, resolution: 'server' | 'local') => {
    if (!user) return;
    setResolvingId(conflict.id);
    try {
      await offlineSyncService.resolveConflict(conflict, resolution);
      if (resolution === 'server') {
        const warnings = await offlineSyncService.refreshLocalSnapshots(user);
        if (warnings.length > 0) dispatch(syncFailure(`Algunos datos no pudieron actualizarse: ${warnings.join('; ')}`));
      } else {
        await synchronize();
      }
      await refreshQueueStatus();
    } catch (resolveError) {
      dispatch(syncFailure(resolveError instanceof Error ? resolveError.message : 'No se pudo resolver el conflicto.'));
    } finally {
      setResolvingId(null);
    }
  };

  if (!user) return null;

  return (
    <div className='offline-sync-status container-fluid px-3 pt-2'>
      <div className={`d-flex flex-wrap align-items-center gap-2 small ${isOnline ? 'text-success' : 'text-warning-emphasis'}`}>
        <strong>{isOnline ? '● Conectado' : '● Sin conexión'}</strong>
        <span>{pendingCount} cambio(s) pendiente(s)</span>
        {lastSync && <span className='text-muted'>Última sincronización: {new Date(lastSync).toLocaleString()}</span>}
        {isOnline && pendingCount > 0 && (
          <Button size='sm' variant='outline-primary' onClick={() => void synchronize()} disabled={syncing}>
            {syncing && <Spinner size='sm' className='me-1' />}
            Sincronizar ahora
          </Button>
        )}
      </div>
      {error && <Alert variant='warning' className='py-2 mt-2 mb-2'>{error}</Alert>}
      {conflicts.length > 0 && (
        <Alert variant='danger' className='py-2 mt-2 mb-2'>
          <strong>{conflicts.length} conflicto(s) requieren revisión.</strong>
          {conflicts.map(conflict => (
            <div key={conflict.id} className='d-flex flex-wrap align-items-center gap-2 mt-2'>
              <span className='flex-grow-1'>{conflict.error || `Cambio pendiente: ${conflict.type}`}</span>
              <Button
                size='sm'
                variant='outline-secondary'
                disabled={!isOnline || resolvingId === conflict.id}
                onClick={() => void resolveConflict(conflict, 'server')}
              >
                Usar versión del servidor
              </Button>
              <Button
                size='sm'
                variant='danger'
                disabled={!isOnline || resolvingId === conflict.id}
                onClick={() => void resolveConflict(conflict, 'local')}
              >
                Volver a aplicar mi cambio
              </Button>
            </div>
          ))}
        </Alert>
      )}
    </div>
  );
};

export default OfflineSyncStatus;
