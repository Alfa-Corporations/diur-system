
const app = require("./app");
const http = require("http");
const socketIO = require("socket.io");

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*"
  }
});

require("dotenv").config();
require("./socket.io")(io);

app.set("io", io);
global.io = io;

const PORT = process.env.PORT || 1811;

server.listen(PORT, () => {
  console.log(`servidor corriendo en el puerto ${PORT}`);
});
