
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const db = require('./utils/database');
const initModels = require('./models/initModels');
const PermissionService = require('./services/PermissionService');
const routes = require('./routes');
const swaggerDocs = require('../swagger');
const hendleError = require('./middlewares/error.middleware');

const app = express();

app.use(express.json({ limit: '4mb' }));
app.use(morgan('dev'));
app.use(cors());
swaggerDocs(app);

db.sync({ force: false, alter: process.env.NODE_ENV !== 'production' })
    .then(async () => {
        console.log('Database synchronized');
        if (process.env.NODE_ENV === 'production') {
            await db.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT FALSE');
            await db.query('ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "note" TEXT');
            await db.query('ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "quantityLoaded" INTEGER NOT NULL DEFAULT 0');
            await db.query('ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "dispatchStatus" VARCHAR(20) NOT NULL DEFAULT \'pendiente\'');
            await db.query('ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "deliveryEvidence" TEXT');
            await db.query('ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "hasDeliveryEvidence" BOOLEAN NOT NULL DEFAULT FALSE');
            await db.query(`
                CREATE TABLE IF NOT EXISTS "push_subscriptions" (
                    "id" SERIAL PRIMARY KEY,
                    "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
                    "endpoint" TEXT NOT NULL UNIQUE,
                    "subscription" JSONB NOT NULL,
                    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            `);
        }
        initModels(); // Inicializar asociaciones después de sincronizar
        await PermissionService.initializeDefaultPermissions();
        console.log('Default permissions synchronized');
        // Ejecutar seeding en desarrollo
        // if (process.env.NODE_ENV !== 'production') {
        //     seedDatabase();
        // }
    })
    .catch(error => console.log('Database sync failed:', error));

// Rutas de la API
app.use('/api/v1', routes);

// Ruta de bienvenida
app.get('/', (req, res) => {
    res.json({ message: 'Bienvenido al API del Sistema de Facturación DIUR' });
});

// Middleware de manejo de errores
app.use(hendleError);

module.exports = app;

// npm i express sequelize pg pg-hstore dotenv jsonwebtoken bcrypt cors swagger-jsdoc swagger-ui-express ------> dependencias básicas
// npm i nodemailer  -------> Dependencias para envio de correo
// npm i multer @aws-sdk/client-s3  ------> Depenendencias para almacenar imagenes en S3 de AWS
// npm i socket.io  ------> Dependencias para los sockets, interaccions en tiempo real

//npm i nodemon morgan -D
