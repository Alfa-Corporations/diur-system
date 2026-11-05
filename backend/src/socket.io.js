const AuthService = require('./services/AuthService');

/**
 * Manejador de eventos Socket.IO
 * Gestiona conexiones en tiempo real para notificaciones del sistema.
 */
module.exports = io => {
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;

            if (!token) {
                return next(new Error('Unauthorized socket connection'));
            }

            const user = await AuthService.getCurrentUser(token);

            if (!user || user.mustChangePassword) {
                return next(new Error('Unauthorized socket connection'));
            }

            socket.user = user;

            next();
        } catch (error) {
            console.error('❌ ERROR AUTH SOCKET:', error);
            return next(new Error('Unauthorized socket connection'));
        }
    });

    io.on("connection", socket => {
        console.log("User connected to socket server");

        if (socket.user?.role) {
            socket.join(socket.user.role);
            socket.join(`user_${socket.user.id}`);
            console.log(`User joined room: ${socket.user.role}`);
            console.log(`User joined personal room: user_${socket.user.id}`);
        }

        socket.on("join", () => {
            if (socket.user?.role) {
                socket.join(socket.user.role);
                console.log(`User re-joined room: ${socket.user.role}`);
            }
        });

        socket.on("join_user_room", () => {
            if (socket.user?.id) {
                socket.join(`user_${socket.user.id}`);
                console.log(`User re-joined personal room: user_${socket.user.id}`);
            }
        });

        socket.on("ping", () => {
            socket.emit("pong");
        });

        socket.on("disconnect", () => {
            console.log("User disconnected from socket server");
        });
    });
};
