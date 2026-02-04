const User = require("../models/user.model");
const Chat = require("../models/chat.model");
const Message = require("../models/message.model");
const { translate } = require("../utils/translation") 
const {
  sendNotification,
} = require("../utils/sendNotification");

class SocketController {

  joinChat = async (io, socket, userData, chatRoomUsers, { chatId }) => {
    try {
      if (!chatId) {
        socket.emit("error", "Chat ID is required");
        return;
      }

      const chat = await Chat.findById(chatId);
      if (!chat || !chat.participants.includes(userData._id.toString())) {
        socket.emit("error", "Chat not found or unauthorized");
        return;
      }

      // Join socket room for real-time updates
      socket.join(chatId.toString());

      // Register user inside in-memory room tracker
      if (!chatRoomUsers[chatId]) {
        chatRoomUsers[chatId] = new Set();
      }
      chatRoomUsers[chatId].add(userData._id.toString());

      // Mark all incoming messages as delivered & read
      await Message.updateMany(
        {
          chat: chatId,
          sender: { $ne: userData._id }
        },
        {
          isDelivered: true,
          isRead: true
        }
      );

      // Notify the other participant that messages are seen
      const otherUserId = chat.participants.find(
        (participant) => participant.toString() !== userData._id.toString()
      );

      if (otherUserId) {
        io.to(otherUserId.toString()).emit("messages-seen", {
          chatId,
          seenTime: new Date()
        });
      }

    } catch (error) {
      console.error("Error in joinChat:", error);
      socket.emit("error", "Failed to join chat");
    }
  };

  startTyping = async (socket, userData, { chatId }) => {
    try {
        if (!chatId) {
            socket.emit("error", "Chat ID is required");
            return;
        }

        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(userData._id.toString())) {
            socket.emit("error", "Chat not found or unauthorized");
            return;
        }

        // Notify other participants that current user is typing
        chat.participants.forEach((participant) => {
            if (participant !== userData._id.toString()) {
                socket.to(participant).emit("typing", {
                    chatId,
                    userId: userData._id,
                    userName: userData.firstName
                });
            }
        });

    } catch (error) {
        console.error("Error in startTyping:", error);
        socket.emit("error", "Failed to send typing indicator");
    }
  };

}

module.exports = new SocketController();