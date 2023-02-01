const http = require("http");
const SocketIO = require("socket.io");

const server = http.createServer();
server.listen(7001);
server.on("listening", () =>
  console.log("Server is running on http://localhost:7001")
);

const io = SocketIO(server);

io.sockets.on("connection", (socket) => {
  socket.on("message", (room, data) => {
    console.log("message, room: " + room + ", data, type:" + data.type);
    socket.to(room).emit("message", room, data);
  });

  socket.on("join", (room) => {
    socket.join(room);
    var myRoom = io.sockets.adapter.rooms[room];
    var users = myRoom ? Object.keys(myRoom.sockets).length : 0;
    console.log("the user number of room (" + room + ") is: " + users);

    if (users < 3) {
      socket.emit("joined", room, socket.id);
      if (users > 1) {
        socket.to(room).emit("otherjoin", room, socket.id);
      }
    } else {
      socket.leave(room);
      socket.emit("full", room, socket.id);
    }
  });

  socket.on("leave", (room) => {
    socket.leave(room);

    var myRoom = io.sockets.adapter.rooms[room];
    var users = myRoom ? Object.keys(myRoom.sockets).length : 0;
    console.log("the user number of room is: " + users);

    socket.to(room).emit("bye", room, socket.id);
    socket.emit("leaved", room, socket.id);
  });
});
