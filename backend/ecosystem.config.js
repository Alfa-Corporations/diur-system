module.exports = {
  apps: [
    {
      name: 'diur_system',
      script: 'npm start /src/server.js',
      watch: '.'
    }
  ],
  deploy: {
    production: {
      user: 'alfa', // Usuario SSH
      host: '192.168.1.2', // Dirección IP del servidor
      ref: 'origin/main', // Rama que quieres desplegar (puedes cambiar a>
      repo: 'https://github.com/Alfa-Corporations/diur-system.git', //>
      path: '/home/alfa/project/diur-system/backend', // Ruta de desti>
      'pre-deploy-local': '', // Aquí puedes agregar comandos locales pre>
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env>',
      'pre-setup': '' // Comandos que se ejecutan antes de la configuraci>
    }
  }
};