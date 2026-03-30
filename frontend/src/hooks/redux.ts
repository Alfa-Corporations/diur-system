import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from '../redux/store';

/**
 * Hooks tipados para Redux
 * Proporciona acceso tipado al store y dispatch
 */

// Hook para dispatch tipado
export const useAppDispatch = () => useDispatch<AppDispatch>();

// Hook para selector tipado
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
