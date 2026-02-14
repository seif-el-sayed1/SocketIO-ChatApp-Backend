const jwt = require("jsonwebtoken");
const socketio = require("socket.io");
const User = require("../models/user.model");

const SocketController = require("../controllers/socket.controller");
const { sendNotification } = require("../utils/sendNotification");

const onlineUsers = new Set();
const chatRoomUsers = {};
let io;

// Authenticate user using JWT, check token, account status, and password change
const getUserDetails = async (socket, token) => {
  try {
    const decoded = await jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = await User.findById(decoded.userId);
    if (!currentUser) return socket.emit("error", "User not found");
    if (currentUser.token !== token) return socket.emit("error", "Session expired");
    if (!currentUser.isActive) return socket.emit("error", "Account deactivated");
    if (currentUser.isBlocked) return socket.emit("error", "Account blocked");
    if (currentUser.passwordChangedAt && parseInt(currentUser.passwordChangedAt.getTime()/1000,10) > decoded.iat)
      return socket.emit("error", "Password changed, login again");
    return currentUser;
  } catch (error) {
    socket.emit("error", "Authentication error: " + error.message);
  }
};

// Send notification for media messages if the user is offline
const sendMediaNotification = ({ fromUser, toUser, roomId, image }) => {
  if (chatRoomUsers[roomId]?.has(toUser._id.toString())) return; // user online, skip push
  if (toUser.notificationToken) {
    sendNotification({
      token: toUser.notificationToken,
      title: `New message from ${fromUser.firstName || fromUser.entityName}`,
      body: "image",
      image,
      caseType: "chat",
      info: roomId,
    });
  }
};

// Setup Socket.IO server and handle events
module.exports = (server, app) => {
  io = socketio(server, { cors: { origin: "*", methods: ["GET","POST"], credentials: true }});
  app.set("socketio", io);

  // COMMIT: Handle socket connection: join personal room, track online users, and emit online status
  io.on("connection", async (socket) => {
    try {
      const token = socket.handshake.headers.authorization;
      const userData = await getUserDetails(socket, token);
      if (!userData) return;

      // Track online users
      socket.join(userData._id.toString());
      onlineUsers.add(userData._id.toString());
      io.emit("online-users", Array.from(onlineUsers));

      // Deliver any pending messages
      SocketController.messagesDeliveredOnConnect(io, socket, userData, chatRoomUsers);

      // COMMIT: Add socket event handlers for typing, messaging, and chat room management
      // Handle chat events
      socket.on("typing", (data) => SocketController.startTyping(socket, userData, data));
      socket.on("stop-typing", (data) => SocketController.stopTyping(socket, userData, data));
      socket.on("message-delivered", (data) => SocketController.messageDelivered(io, socket, userData, chatRoomUsers, data));
      socket.on("join-chat", (data) => SocketController.joinChat(io, socket, userData, chatRoomUsers, data));
      socket.on("leave-chat", (data) => SocketController.leaveChat(socket, userData, chatRoomUsers, data));
      socket.on("new-message", (data) => SocketController.sendChatMessage(io, socket, userData, chatRoomUsers, data, Array.from(onlineUsers)));

      // COMMIT: Handle user disconnect: remove from online list and leave all chat rooms
      // Remove user from online tracking on disconnect
      socket.on("disconnect", () => {
        onlineUsers.delete(userData._id.toString());
        SocketController.leaveAllChats(socket, userData, chatRoomUsers);
        io.emit("online-users", Array.from(onlineUsers));
      });

    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });
};

// Exports
module.exports.chatRoomUsers = chatRoomUsers;
module.exports.getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};
module.exports.sendMediaNotification = sendMediaNotification;
