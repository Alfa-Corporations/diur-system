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
                return next();
            }

            socket.user = await AuthService.getCurrentUser(token);
            return next();
        } catch (error) {
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

        socket.on("invoice_created", invoiceData => {
            io.emit("notification", {
                type: "invoice_created",
                message: `Nueva factura creada: ${invoiceData.invoiceNumber}`,
                data: invoiceData,
                timestamp: new Date().toISOString()
            });
        });

        socket.on("invoice_paid", invoiceData => {
            io.to('admin').emit("notification", {
                type: "invoice_paid",
                message: `Factura pagada: ${invoiceData.invoiceNumber || `#${invoiceData.id}`}`,
                data: invoiceData,
                timestamp: new Date().toISOString()
            });
        });

        socket.on("inventory_updated", productData => {
            io.to('admin').to('warehouse').emit("notification", {
                type: "inventory_updated",
                message: `Inventario actualizado: ${productData.name}`,
                data: productData,
                timestamp: new Date().toISOString()
            });
        });

        socket.on("order_created", orderData => {
            io.to('admin').to('delivery').emit("notification", {
                type: "order_created",
                message: `Nuevo pedido creado`,
                data: orderData,
                timestamp: new Date().toISOString()
            });
        });

        socket.on("order_updated", orderData => {
            if (orderData.deliveryUserId) {
                io.to(`user_${orderData.deliveryUserId}`).emit("notification", {
                    type: "order_assigned",
                    message: `Pedido asignado para entrega`,
                    data: orderData,
                    timestamp: new Date().toISOString()
                });
            }

            io.to('admin').emit("notification", {
                type: "order_updated",
                message: `Pedido actualizado: ${orderData.status}`,
                data: orderData,
                timestamp: new Date().toISOString()
            });
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
