
const app = require("./app");
const http = require("http");
const swaggerDocs = require("../swagger");
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

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  console.log("servidor corriendo");
  swaggerDocs(app, PORT);
});
