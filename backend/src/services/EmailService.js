const mailer = require('../utils/mailer');

const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

class EmailService {
  async sendUserCredentials(user, password) {
    const username = escapeHtml(user.username);
    const safePassword = escapeHtml(password);
    const appUrl = (process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const loginUrl = `${appUrl}/login`;
    const safeLoginUrl = escapeHtml(loginUrl);
    await mailer.sendMail({
      to: user.email,
      subject: 'Credenciales de acceso a DIUR SYSTEM',
      text: `Hola ${user.username}, tu cuenta de DIUR SYSTEM fue creada.\nIngresa en: ${loginUrl}\nUsuario: ${user.username}\nPIN temporal de 5 dígitos: ${password}\nDespués de iniciar sesión deberás crear una contraseña nueva de al menos 8 caracteres.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:24px auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;color:#172033">
          <h1 style="color:#123769">Bienvenido a DIUR SYSTEM</h1>
          <p>Hola ${username}, tu cuenta fue creada. Inicia sesión con estos datos:</p>
          <p><a href="${safeLoginUrl}" style="display:inline-block;background:#123769;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Ir a DIUR SYSTEM</a></p>
          <p><strong>Usuario:</strong> ${username}<br><strong>PIN temporal (5 dígitos):</strong> ${safePassword}</p>
          <p>Después de iniciar sesión tendrás que elegir una contraseña nueva de al menos 8 caracteres antes de usar el sistema. No compartas este correo.</p>
        </div>`,
    });
  }
}

module.exports = new EmailService();
