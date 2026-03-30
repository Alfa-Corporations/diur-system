
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const db = require('./utils/database');
const initModels = require('./models/initModels');
const seedDatabase = require('./seeders/seedDatabase');
const routes = require('./routes');
const hendleError = require('./middlewares/error.middleware');

const app = express();

app.use(express.json());
app.use(morgan('dev'));
app.use(cors());

db.authenticate()
    .then(() => console.log('Database authentication successful'))
    .catch(error => console.log('Database authentication failed:', error));

db.sync({ force: false, alter: process.env.NODE_ENV !== 'production' })
    .then(() => {
        console.log('Database synchronized');
        initModels(); // Inicializar asociaciones después de sincronizar
        // Ejecutar seeding en desarrollo
        if (process.env.NODE_ENV !== 'production') {
            seedDatabase();
        }
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
