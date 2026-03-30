
// configurar nodemailer para enviar correos con mi cuenta de Google

const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.G_NAME,  // Debes colocar tu correo
        pass: process.env.G_PASSWORD
    }
});

module.exports = transporter;
