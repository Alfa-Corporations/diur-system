
// configurar nodemailer para enviar correos con mi cuenta de Google

let nodemailer = null;
try {
    nodemailer = require("nodemailer");
} catch (error) {
    console.warn("⚠️ nodemailer no está instalado. Ejecuta npm install en backend para habilitar el envío de correos.");
}

require("dotenv").config();

const mailUser = process.env.G_NAME || process.env.MAIL_USER;
const mailPassword = process.env.G_PASSWORD || process.env.MAIL_PASSWORD;

const transporter = nodemailer
    ? nodemailer.createTransport({
        host: process.env.MAIL_HOST || "smtp.gmail.com",
        port: Number(process.env.MAIL_PORT || 465),
        secure: true,
        auth: {
            user: mailUser,
            pass: mailPassword
        }
    })
    : {
        sendMail: async () => {
            throw new Error("Email dependency not installed. Run npm install in backend to enable sending emails.");
        }
    };

module.exports = transporter;
