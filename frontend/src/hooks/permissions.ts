import { useAppSelector } from './redux';

/**
 * Hook para verificar permisos del usuario actual
 * @returns {Object} Funciones para verificar permisos
 */
export const usePermissions = () => {
  const { user } = useAppSelector(state => state.auth);

  /**
   * Verifica si el usuario tiene un permiso específico
   * @param {string} permissionName - Nombre del permiso
   * @returns {boolean} True si tiene el permiso
   */
  const hasPermission = (permissionName: string): boolean => {
    if (!user?.permissions) return false;
    return user.permissions.some(permission => permission.name === permissionName);
  };

  /**
   * Verifica si el usuario tiene al menos uno de los permisos especificados
   * @param {string[]} permissionNames - Nombres de permisos
   * @returns {boolean} True si tiene al menos uno
   */
  const hasAnyPermission = (permissionNames: string[]): boolean => {
    return permissionNames.some(permissionName => hasPermission(permissionName));
  };

  /**
   * Verifica si el usuario tiene todos los permisos especificados
   * @param {string[]} permissionNames - Nombres de permisos
   * @returns {boolean} True si tiene todos
   */
  const hasAllPermissions = (permissionNames: string[]): boolean => {
    return permissionNames.every(permissionName => hasPermission(permissionName));
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    permissions: user?.permissions || []
  };
};
