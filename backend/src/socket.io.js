
/**
 * Manejador de eventos Socket.IO
 * Gestiona conexiones en tiempo real para notificaciones del sistema.
 */
module.exports = io => {
    io.on("connection", socket => {
        console.log("User connected to socket server");

        // Unirse a una sala basada en el rol del usuario
        socket.on("join", (userData) => {
            if (userData.role) {
                socket.join(userData.role);
                console.log(`User joined room: ${userData.role}`);
            }
        });

        // Evento para nueva factura creada
        socket.on("invoice_created", (invoiceData) => {
            // Notificar a administradores y cajeros
            io.to('admin').to('cashier').emit("notification", {
                type: "invoice_created",
                message: `Nueva factura creada: ${invoiceData.invoiceNumber}`,
                data: invoiceData,
                timestamp: new Date()
            });
        });

        // Evento para actualización de inventario
        socket.on("inventory_updated", (productData) => {
            // Notificar a administradores y bodega
            io.to('admin').to('warehouse').emit("notification", {
                type: "inventory_updated",
                message: `Inventario actualizado: ${productData.name}`,
                data: productData,
                timestamp: new Date()
            });
        });

        // Evento para nuevo pedido
        socket.on("order_created", (orderData) => {
            // Notificar a administradores y delivery
            io.to('admin').to('delivery').emit("notification", {
                type: "order_created",
                message: `Nuevo pedido creado`,
                data: orderData,
                timestamp: new Date()
            });
        });

        // Evento para actualización de pedido
        socket.on("order_updated", (orderData) => {
            // Notificar al usuario asignado y administradores
            if (orderData.deliveryUserId) {
                io.to(`user_${orderData.deliveryUserId}`).emit("notification", {
                    type: "order_assigned",
                    message: `Pedido asignado para entrega`,
                    data: orderData,
                    timestamp: new Date()
                });
            }
            io.to('admin').emit("notification", {
                type: "order_updated",
                message: `Pedido actualizado: ${orderData.status}`,
                data: orderData,
                timestamp: new Date()
            });
        });

        // Unirse a sala de usuario específico
        socket.on("join_user_room", (userId) => {
            socket.join(`user_${userId}`);
            console.log(`User joined personal room: user_${userId}`);
        });

        // Ping/Pong para mantener conexión
        socket.on("ping", () => {
            socket.emit("pong");
        });

        // Desconexión
        socket.on("disconnect", () => {
            console.log("User disconnected from socket server");
        });
    });
};
