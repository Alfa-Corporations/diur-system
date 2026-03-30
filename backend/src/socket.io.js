
module.exports = io => {
    io.on("connection", socket => {
        console.log("User connected to socket server");
        
        /* Escuchamos el evento socket */
        
        socket.on("invitation", async data => {
            //Escribimos la logíca de la función
        });

        /* Emitir eventos */
        
        io.to(socket.id).emit("feedback", "string o variable"); //Evento dirigído a un socket específico
        
        io.emit("feedback", "string o variable"); //Evento dirigído a todos los sockets conectados al server
        
        socket.broadcast.emit("hello", "string o variable"); //Evento dirigído a todos los sockets a esepción del emisor
        
        /* Recibimos el evento cuando el usuario cierra secion*/
        
        socket.on("disconnect", () => {
            console.log("User disconnected to socket server");
        });
    });
};
