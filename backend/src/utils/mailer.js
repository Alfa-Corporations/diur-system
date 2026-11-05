require('dotenv').config();
const nodemailer = require('nodemailer');

const mailUser = process.env.G_NAME || process.env.MAIL_USER;
const mailPassword = process.env.G_PASSWORD || process.env.MAIL_PASSWORD;
const port = Number(process.env.MAIL_PORT || 587);
const secure = process.env.MAIL_SECURE === undefined
  ? port === 587
  : process.env.MAIL_SECURE.toLowerCase() === 'true';
const sender = process.env.MAIL_FROM || mailUser;

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port,
  secure,
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 30000,
  ...(mailUser && mailPassword ? { auth: { user: mailUser, pass: mailPassword } } : {}),
});

const createEmailError = error => {
  const wrapped = new Error(
    error.code === 'EAUTH'
      ? 'El proveedor SMTP rechazó las credenciales. Revisa el usuario y la contraseña de aplicación configurados en el backend.'
      : ['ETIMEDOUT', 'ECONNECTION', 'ESOCKET'].includes(error.code)
        ? 'No se pudo conectar con el servidor SMTP. Revisa host, puerto, cifrado y acceso de red saliente.'
        : error.code === 'EENVELOPE'
          ? 'El servidor de correo rechazó la dirección del destinatario.'
          : `No se pudo entregar el correo${error.responseCode ? ` (SMTP ${error.responseCode})` : ''}.`,
  );
  wrapped.code = 'EMAIL_DELIVERY_FAILED';
  return wrapped;
};

const sendMail = async message => {
  if (!mailUser || !mailPassword) {
    const error = new Error('El correo no está configurado. Define G_NAME/G_PASSWORD o MAIL_USER/MAIL_PASSWORD en el entorno del backend.');
    error.code = 'EMAIL_CONFIG_MISSING';
    throw error;
  }

  try {
    return await transporter.sendMail({ from: sender, ...message });
  } catch (error) {
    console.error('Email delivery failed:', { code: error.code, responseCode: error.responseCode, command: error.command });
    throw createEmailError(error);
  }
};

module.exports = {
  sendMail,
  verify: () => transporter.verify(),
};
