
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const db = require('./utils/database');
const hendleError = require('./middlewares/error.middleware');

const app = express();

app.use(express.json());
app.use(morgan('dev'));
app.use(cors());

db.authenticate()
    .then(() => console.log('Authenticate complete'))
    .catch(error => console.log(error));
    
db.sync({ force: false })
    .then(() => console.log('Synchronized database'))
    .catch(error => console.log(error));

app.get('/', (req, res) => {
    console.log('Bienvenido al server');
});

app.use(hendleError);

module.exports = app;

// npm i express sequelize pg pg-hstore dotenv jsonwebtoken bcrypt cors swagger-jsdoc swagger-ui-express ------> dependencias básicas
// npm i nodemailer  -------> Dependencias para envio de correo
// npm i multer @aws-sdk/client-s3  ------> Depenendencias para almacenar imagenes en S3 de AWS
// npm i socket.io  ------> Dependencias para los sockets, interaccions en tiempo real

//npm i nodemon morgan -D
