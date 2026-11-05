# Sistema de Facturación DIUR

Sistema completo de facturación para ferreterías/almacenes con arquitectura de microservicios, modo offline-first y comunicación en tiempo real.

## 🏗️ Arquitectura

- **Backend**: Node.js + Express + PostgreSQL + Sequelize
- **Frontend**: React + TypeScript + Redux Toolkit + Bootstrap
- **Comunicación**: Socket.IO para tiempo real
- **Offline**: IndexedDB para almacenamiento local
- **Autenticación**: JWT con roles (admin, cashier, warehouse, delivery)

## 🚀 Características Principales

### ✅ Funcionalidades Implementadas

- ✅ Sistema de autenticación con JWT
- ✅ Gestión de usuarios con roles
- ✅ CRUD completo de productos
- ✅ Sistema de facturación básico
- ✅ Comunicación en tiempo real con Socket.IO
- ✅ Modo offline con sincronización
- ✅ Interfaz responsive con Bootstrap
- ✅ Arquitectura modular y escalable

### 🔄 Próximas Funcionalidades

- Gestión completa de pedidos
- Punto de venta (POS)
- Reportes y exportación (XML, CSV)
- Dashboard administrativo
- Notificaciones push
- API REST completa

## 📁 Estructura del Proyecto

```
/
├── backend/                    # API Backend
│   ├── src/
│   │   ├── controllers/        # Controladores de rutas
│   │   ├── services/          # Lógica de negocio
│   │   ├── repositories/      # Acceso a datos
│   │   ├── models/           # Modelos de base de datos
│   │   ├── middlewares/      # Middlewares personalizados
│   │   ├── routes/           # Definición de rutas
│   │   ├── sockets/          # Eventos Socket.IO
│   │   └── utils/            # Utilidades
│   └── package.json
├── diur-system/              # Frontend React
│   ├── src/
│   │   ├── components/       # Componentes React
│   │   ├── pages/           # Páginas de la aplicación
│   │   ├── redux/           # Estado global
│   │   ├── services/        # Servicios API/Socket
│   │   ├── interfaces/      # Interfaces TypeScript
│   │   ├── hooks/           # Hooks personalizados
│   │   └── utils/           # Utilidades
│   └── package.json
├── shared/                   # Tipos compartidos
└── README.md
```

## 🛠️ Instalación y Configuración

### Prerrequisitos

- Node.js 18+
- PostgreSQL 12+
- npm o yarn

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd diur-system
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

Para habilitar el envío de facturas y las credenciales de nuevos usuarios, configura el SMTP en `backend/.env`:

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=tu-cuenta@gmail.com
MAIL_PASSWORD=tu-contraseña-de-aplicacion
MAIL_FROM=tu-cuenta@gmail.com
APP_URL=https://tu-dominio-de-la-aplicacion
```

En Gmail usa una contraseña de aplicación (con verificación en dos pasos habilitada), no la contraseña normal de la cuenta. No subas el archivo `.env` al repositorio. También puedes usar `G_NAME` y `G_PASSWORD` en lugar de `MAIL_USER` y `MAIL_PASSWORD`.

El enlace del correo de bienvenida apunta a `${APP_URL}/login` (o `FRONTEND_URL` si `APP_URL` no está definido). Cada usuario nuevo recibe un PIN temporal de 5 dígitos y debe cambiarlo por una contraseña de al menos 8 caracteres antes de usar cualquier módulo.

### Notificaciones en tiempo real y push

Las operaciones exitosas de creación, actualización y eliminación generan avisos en tiempo real para los usuarios conectados. Para recibir notificaciones push incluso cuando la aplicación no está abierta, cada usuario debe activar **Activar push** desde su dashboard en cada dispositivo y permitir las notificaciones del navegador. La aplicación debe estar publicada por HTTPS.

Configura las claves VAPID en `backend/.env`; puedes generarlas desde `backend` con `npx web-push generate-vapid-keys`. Se admiten los servicios push habituales de Chrome/Edge, Firefox y Safari:

```env
VAPID_PUBLIC_KEY=clave-publica-generada
VAPID_PRIVATE_KEY=clave-privada-generada
VAPID_SUBJECT=mailto:admin@tu-dominio.com
```

No compartas ni subas la clave privada al repositorio. Los pedidos nuevos y el inicio o finalización de visitas tienen mensajes específicos; los demás cambios muestran el módulo afectado y el usuario que realizó la operación.

### 3. Instalar dependencias del backend

```bash
cd backend
npm install
```

### 4. Instalar dependencias del frontend

```bash
cd ../diur-system
npm install
```

### 5. Configurar base de datos

```sql
CREATE DATABASE diur_system;
-- Las tablas se crearán automáticamente con Sequelize
```

### 6. Ejecutar migraciones (si es necesario)

```bash
cd backend
npm run dev  # Esto crea las tablas automáticamente
```

### 7. Iniciar el backend

```bash
cd backend
npm run dev
```

### 8. Iniciar el frontend (en otra terminal)

```bash
cd diur-system
npm run dev
```

## 🔧 Scripts Disponibles

### Backend

- `npm run dev` - Inicia servidor en modo desarrollo con nodemon
- `npm start` - Inicia servidor en producción
- `npm test` - Ejecuta tests

### Frontend

- `npm run dev` - Inicia servidor de desarrollo Vite
- `npm run build` - Construye para producción
- `npm run preview` - Vista previa de producción
- `npm run lint` - Ejecuta ESLint

## 🔐 Usuarios de Prueba

El sistema incluye seeders para crear usuarios de prueba. Los usuarios por defecto son:

- **Admin**: admin@diur.com / admin123 (rol: admin)
- **Cajero**: cashier@diur.com / cashier123 (rol: cashier)
- **Bodega**: warehouse@diur.com / warehouse123 (rol: warehouse)

## 🌐 API Endpoints

### Autenticación

- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Inicio de sesión
- `GET /api/auth/profile` - Perfil del usuario

### Productos

- `GET /api/products` - Lista productos
- `POST /api/products` - Crear producto
- `PUT /api/products/:id` - Actualizar producto
- `DELETE /api/products/:id` - Eliminar producto

### Facturas

- `GET /api/invoices` - Lista facturas
- `POST /api/invoices` - Crear factura
- `GET /api/invoices/:id` - Detalles de factura

### Sincronización

- `GET /api/sync/pending` - Eventos pendientes
- `POST /api/sync/events` - Sincronizar eventos

## 🔄 Modo Offline

La aplicación funciona completamente offline:

1. **Almacenamiento local**: Usa IndexedDB para guardar datos
2. **Eventos pendientes**: Los cambios offline se guardan como eventos
3. **Sincronización automática**: Al reconectarse, sincroniza automáticamente
4. **Resolución de conflictos**: Estrategia "último gana" por timestamp

## 📊 Tecnologías Utilizadas

### Backend

- **Express.js** - Framework web
- **Sequelize** - ORM para PostgreSQL
- **Socket.IO** - Comunicación en tiempo real
- **JWT** - Autenticación
- **bcrypt** - Hash de contraseñas

### Frontend

- **React 18** - Framework UI
- **TypeScript** - Tipado estático
- **Redux Toolkit** - Gestión de estado
- **React Router** - Enrutamiento
- **Bootstrap 5** - Framework CSS
- **Axios** - Cliente HTTP
- **Dexie** - Wrapper IndexedDB

### Base de Datos

- **PostgreSQL** - Base de datos principal
- **IndexedDB** - Almacenamiento offline

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia ISC.

## 📞 Soporte

Para soporte técnico o preguntas:

- Crear un issue en GitHub
- Contactar al equipo de desarrollo

---

**Desarrollado con ❤️ para optimizar la gestión de ferreterías y almacenes**
