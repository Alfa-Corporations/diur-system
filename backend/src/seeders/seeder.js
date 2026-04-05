
const db = require("../utils/database");
const initModels = require("../models/initModels");
const { User, Permission, UserPermission } = require("../models");
const PermissionService = require("../services/PermissionService");

initModels();

const permissions = [
    { name: 'crear_orden', description: 'Crear pedidos' },
    { name: 'cancelar_orden', description: 'Cancelar pedidos' },
    { name: 'invoice_order', description: 'Facturar pedidos' },
    { name: 'crud_products', description: 'CRUD productos' },
    { name: 'close_day', description: 'Cierre de día' },
    { name: 'crud_users', description: 'CRUD usuarios' },
    { name: 'ver_reportes', description: 'Ver reportes' },
    { name: 'manage_inventory', description: 'Gestionar inventario' },
];

const users = [
    {
        username: 'admin',
        email: 'admin@diur.com',
        password: '$2a$10$hashedpassword', // Contraseña hasheada para 'admin123'
        role: 'admin',
        isActive: true,
    },
    {
        username: 'cashier',
        email: 'cashier@diur.com',
        password: '$2a$10$hashedpassword', // Contraseña hasheada para 'cashier123'
        role: 'cashier',
        isActive: true,
    },
    {
        username: 'warehouse',
        email: 'warehouse@diur.com',
        password: '$2a$10$hashedpassword', // Contraseña hasheada para 'warehouse123'
        role: 'warehouse',
        isActive: true,
    },
];

const userPermissions = [
    // Admin tiene todos los permisos
    { userIndex: 0, permissions: ['crear_orden', 'cancelar_orden', 'invoice_order', 'crud_products', 'close_day', 'crud_users', 'ver_reportes', 'manage_inventory'] },
    // Cashier puede crear pedidos de venta, facturar, gestionar productos básicos
    { userIndex: 1, permissions: ['crear_orden', 'invoice_order', 'crud_products'] },
    // Warehouse puede gestionar inventario y pedidos de compra
    { userIndex: 2, permissions: ['crear_orden', 'manage_inventory', 'crud_products'] },
];

async function seedDatabase() {
    try {
        console.log("Iniciando la plantación de Información");

        // Crear permisos
        for (const perm of permissions) {
            try {
                await Permission.create(perm);
                console.log(`Permiso creado: ${perm.name}`);
            } catch (error) {
                console.log(`Permiso ya existe: ${perm.name}`);
            }
        }

        // Crear usuarios
        const createdUsers = [];
        for (const user of users) {
            try {
                const createdUser = await User.create(user);
                createdUsers.push(createdUser);
                console.log(`Usuario creado: ${user.username}`);
            } catch (error) {
                console.log(`Error creando usuario ${user.username}:`, error.message);
            }
        }

        // Asignar permisos a usuarios
        for (const assignment of userPermissions) {
            const user = createdUsers[assignment.userIndex];
            if (user) {
                const permissionIds = [];
                for (const permName of assignment.permissions) {
                    const perm = await Permission.findOne({ where: { name: permName } });
                    if (perm) {
                        permissionIds.push(perm.id);
                    }
                }
                await UserPermission.bulkCreate(
                    permissionIds.map(permId => ({ userId: user.id, permissionId: permId }))
                );
                console.log(`Permisos asignados a ${user.username}`);
            }
        }

        console.log("Implantación completa");
    } catch (error) {
        console.log("Error en seeding:", error);
    }
}

db.sync({ force: true })
    .then(() => seedDatabase())
    .catch((error) => console.log("Error en sync:", error));
