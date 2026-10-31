import type { Permission, User } from '../../../shared/types';

export type PermissionGroup = {
  id: string;
  title: string;
  description: string;
  permissions: Permission[];
};

export const roleLabels: Record<User['role'], string> = {
  admin: 'Administrador',
  caja: 'Caja',
  bodega: 'Bodega',
  vendedor: 'Vendedor'
};

export const rolePermissionReferences: Record<User['role'], string[]> = {
  admin: [
    'gestionar_productos', 'crear_producto', 'leer_producto', 'actualizar_producto', 'eliminar_producto',
    'crear_factura', 'leer_factura', 'actualizar_factura', 'cancelar_factura',
    'crear_orden', 'leer_orden', 'actualizar_orden', 'cancelar_orden', 'gestionar_items_orden',
    'crear_usuario', 'leer_usuario', 'actualizar_usuario', 'eliminar_usuario', 'gestionar_usuarios', 'crud_users', 'gestionar_permisos',
    'ver_dashboard', 'ver_reportes', 'acceso_pos', 'acceso_administrativo',
    'crear_clientes', 'leer_clientes', 'actualizar_clientes', 'eliminar_clientes', 'ver_totales'
  ],
  caja: [
    'leer_producto', 'leer_clientes', 'crear_factura', 'leer_factura', 'actualizar_factura',
    'acceso_pos', 'ver_totales', 'leer_orden'
  ],
  bodega: [
    'leer_producto', 'actualizar_producto', 'leer_orden', 'actualizar_orden', 'gestionar_items_orden', 'crear_factura'
  ],
  vendedor: [
    'leer_producto', 'crear_clientes', 'leer_clientes', 'actualizar_clientes',
    'crear_orden', 'leer_orden', 'cancelar_orden', 'crear_factura', 'leer_factura', 'acceso_pos', 'ver_totales'
  ]
};

const groupDefinitions: Record<string, Omit<PermissionGroup, 'permissions'>> = {
  products: { id: 'products', title: 'Productos e inventario', description: 'Consulta, edición e importación de productos.' },
  orders: { id: 'orders', title: 'Órdenes y despachos', description: 'Consulta y administración de pedidos y sus entregas.' },
  invoices: { id: 'invoices', title: 'Facturas y cobros', description: 'Emisión, consulta y administración de facturas.' },
  customers: { id: 'customers', title: 'Clientes', description: 'Consulta y mantenimiento de clientes.' },
  users: { id: 'users', title: 'Usuarios y permisos', description: 'Administración de cuentas y accesos.' },
  dashboard: { id: 'dashboard', title: 'Dashboard y reportes', description: 'Acceso a paneles, indicadores y reportes.' },
  pos: { id: 'pos', title: 'Punto de venta', description: 'Acceso a las funciones de ventas en el local.' },
  other: { id: 'other', title: 'Otros permisos', description: 'Permisos que no pertenecen a los módulos anteriores.' }
};

const groupByPermission = (name: string): string => {
  if (name.includes('producto') || name.includes('stock')) return 'products';
  if (name.includes('orden') || name.includes('pedido')) return 'orders';
  if (name.includes('factura') || name.includes('cobrar')) return 'invoices';
  if (name.includes('cliente')) return 'customers';
  if (name.includes('usuario') || name.includes('permiso') || name === 'crud_users') return 'users';
  if (name.includes('dashboard') || name.includes('reporte') || name.includes('total')) return 'dashboard';
  if (name.includes('pos')) return 'pos';
  return 'other';
};

export const groupPermissions = (permissions: Permission[]): PermissionGroup[] => {
  const grouped = new Map<string, Permission[]>();
  permissions.forEach(permission => {
    const groupId = groupByPermission(permission.name);
    grouped.set(groupId, [...(grouped.get(groupId) || []), permission]);
  });

  return Object.values(groupDefinitions)
    .map(definition => ({
      ...definition,
      permissions: (grouped.get(definition.id) || []).sort((a, b) => a.name.localeCompare(b.name))
    }))
    .filter(group => group.permissions.length > 0);
};

export const permissionLabels: Record<string, string> = {
  gestionar_productos: 'Administrar productos',
  crear_producto: 'Crear e importar productos',
  leer_producto: 'Ver productos',
  actualizar_producto: 'Editar productos y stock',
  eliminar_producto: 'Eliminar productos',
  crear_factura: 'Crear facturas',
  leer_factura: 'Ver facturas',
  actualizar_factura: 'Actualizar facturas y cobros',
  cancelar_factura: 'Cancelar facturas',
  crear_orden: 'Crear órdenes',
  leer_orden: 'Ver órdenes y pendientes',
  actualizar_orden: 'Despachar y actualizar órdenes',
  cancelar_orden: 'Cancelar órdenes',
  gestionar_items_orden: 'Gestionar artículos de órdenes',
  crear_usuario: 'Crear usuarios',
  leer_usuario: 'Ver usuarios',
  actualizar_usuario: 'Editar usuarios',
  eliminar_usuario: 'Eliminar usuarios',
  gestionar_usuarios: 'Administrar usuarios',
  crud_users: 'Acceso completo a gestión de usuarios',
  gestionar_permisos: 'Asignar permisos',
  ver_dashboard: 'Ver dashboard',
  ver_reportes: 'Ver reportes',
  acceso_pos: 'Acceder al punto de venta',
  acceso_administrativo: 'Acceso administrativo',
  crear_clientes: 'Crear clientes',
  leer_clientes: 'Ver clientes',
  actualizar_clientes: 'Editar clientes',
  eliminar_clientes: 'Eliminar clientes',
  ver_totales: 'Ver importes y totales'
};
