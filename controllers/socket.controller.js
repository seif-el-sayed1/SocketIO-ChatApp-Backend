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
            if (participant.toString() !== userData._id.toString()) {
                socket.to(participant.toString()).emit("typing", {
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

  stopTyping = async (socket, userData, { chatId }) => {
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

      // Notify other participants that user stopped typing
      chat.participants.forEach((participant) => {
        if (participant.toString() !== userData._id.toString()) {
          socket.to(participant.toString()).emit("stop-typing", {
            chatId,
            userId: userData._id,
            userName: userData.firstName
          });
        }
      });
        
    } catch (error) {
      console.error("Error in stopTyping:", error);
      socket.emit("error", "Failed to send stop typing indicator");
    }
  };

  sendChatMessage = async (io, socket, userData, chatRoomUsers, data, onlineUsers) => {
    try {
        let { content, chatId, otherUserId, type = "text" } = data;
        let firstMsg = false;

        if (chatId && otherUserId) {
            socket.emit("error", "You can't send a message to a chat and a user at the same time");
            return;
        }

        // Handle new chat creation if sending to a user directly
        if (otherUserId) {
            const otherUser = await User.findById(otherUserId).select("_id blockedUsers lang");
            if (!otherUser) return socket.emit("error", "User not found");

            // Check if either user has blocked the other
            if (userData.blockedUsers.includes(otherUserId) || otherUser.blockedUsers.includes(userData._id))
                return socket.emit("error", "You can't send a message to a blocked user");

            // Find or create a 1-on-1 chat
            let chat = await Chat.findOne({
                participants: { $all: [userData._id, otherUserId], $size: 2 }
            });
            if (!chat) {
                chat = await Chat.create({ participants: [userData._id, otherUserId] });
                firstMsg = true; // mark as first message in this chat
            }

            // Join user to the chat room
            socket.join(chat._id.toString());
            if (!chatRoomUsers[chat._id]) chatRoomUsers[chat._id] = new Set();
            chatRoomUsers[chat._id].add(userData._id.toString());
            chatId = chat._id.toString();

        } else if (chatId) {
            // Handle sending message in an existing chat
            const chat = await Chat.findById(chatId);
            if (!chat || !chat.participants.includes(userData._id)) {
                socket.emit("error", "Chat not found or unauthorized");
                return;
            }

            const otherUser = await User.findById(chat.participants.find((p) => p !== userData._id))
                .select("_id blockedUsers lang");
            if (!otherUser) return socket.emit("error", "User not found");

            // Check if either user has blocked the other
            if (userData.blockedUsers.includes(otherUser._id) || otherUser.blockedUsers.includes(userData._id))
                return socket.emit("error", "You can't send a message to a blocked user");
        }

        // Create and save the message
        const msgBody = { chat: chatId, sender: userData._id, content, type, isDelivered: false, isRead: false };
        const newMessage = await Message.create(msgBody);

        // Fetch chat with participants populated
        const chat = await Chat.findById(chatId).populate(
            "participants",
            "_id firstName lastName profilePicture notificationToken lang"
        );

        // Loop through participants to emit message events
        for (let participant of chat.participants) {
            // Determine if this message is the first message after chat cleared
            if (chat && chat.clearedBy) {
                if (chat.clearedBy.toString() === participant._id.toString()) {
                    let messages = await Message.find({ chat: chat._id, createdAt: { $gt: chat.clearedAt } });
                    firstMsg = messages.length === 0 || (messages.length === 1 && messages[0]._id.toString() === newMessage._id.toString());
                } else firstMsg = false;
            }

            // Emit new-chat event if first message
            if (firstMsg) {
                const toParticipant = chat.participants.find(p => p._id.toString() !== participant._id.toString());
                io.to(participant._id.toString()).emit("new-chat", {
                    _id: chatId,
                    to: {
                        _id: otherUserId,
                        profilePicture: toParticipant?.profilePicture || "",
                        fullName: toParticipant?.firstName + " " + toParticipant.lastName
                    },
                    messages: [{
                        _id: newMessage._id,
                        sender: {
                            _id: userData._id,
                            fullName: participant._id.toString() === userData._id.toString() ? "You" : userData.firstName
                        },
                        content: newMessage.content,
                        type: newMessage.type,
                        isDelivered: newMessage.isDelivered,
                        isRead: newMessage.isRead,
                        isMyMsg: participant._id.toString() === userData._id.toString(),
                        createdAt: newMessage.createdAt
                    }],
                    unreadMessagesCount: participant._id.toString() === userData._id.toString() ? 0 : 1,
                    blocked: false
                });
            } else {
                // Emit regular message event
                io.to(participant._id.toString()).emit("message", {
                    ...newMessage.toObject(),
                    sender: undefined,
                    isMyMsg: participant._id.toString() === userData._id.toString()
                });
            }
        }

        // Send push notification if other user is offline
        const otherUser = chat.participants.find(p => p._id.toString() !== userData._id.toString());
        if (otherUser.notificationToken &&
            (!chatRoomUsers[chatId] || !chatRoomUsers[chatId]?.has(otherUser._id.toString()))) {
            sendNotification({
                token: otherUser.notificationToken,
                title: `${translate("New message from", otherUser.lang)} ${userData.firstName || userData.entityName}`,
                icon: userData?.icon,
                body: content,
                caseType: "chat",
                info: chatId.toString(),
                isDataOnly: true
            });
        }

    } catch (error) {
        socket.emit("error", { message: error.message });
    }
  };
  
  messagesDeliveredOnConnect = async (io, socket, userData, chatRoomUsers) => {
    try {
        let chats = await Chat.find({ participants: userData._id });
        let chatIds = chats.map((chat) => chat._id.toString());

        // Find undelivered and unread messages sent by others
        const messages = await Message.find({
            chat: { $in: chatIds },
            sender: { $ne: userData._id }, 
            isDelivered: false,
            isRead: false
        });

        for (let message of messages) {
            if (!message || !message.chat) continue;

            const chatId = message.chat.toString();
            const chat = await Chat.findById(chatId);
            
            if (!chat || !chat.participants.includes(userData._id.toString()))
                return socket.emit("error", "Chat not found or unauthorized");

            // Prepare update: mark as delivered, and read if user is in chat room
            const updateBody = { isDelivered: true };
            if (chatRoomUsers[chatId] && chatRoomUsers[chatId].has(userData._id.toString()))
                updateBody.isRead = true;

            // Update all messages up to current message timestamp
            await Message.updateMany(
                {
                    chat: chatId,
                    sender: { $ne: userData._id },
                    createdAt: { $lte: message.createdAt }
                },
                updateBody
            );

            // Find the other participant to notify
            const otherUserId = chat.participants.find(
                (participant) => participant.toString() !== userData._id.toString()
            );

            if (otherUserId) {
                // Notify other user that message has been delivered
                io.to(otherUserId.toString()).emit("message-delivered", {
                    chatId,
                    messageId: message._id,
                    messageTime: message.createdAt
                });

                // If user is active in chat, also mark as seen
                if (chatRoomUsers[chatId] && chatRoomUsers[chatId].has(userData._id.toString()))
                    io.to(otherUserId.toString()).emit("messages-seen", {
                        chatId,
                        seenTime: new Date()
                    });
            }
        }

    } catch (error) {
        socket.emit("error", { message: error.message });
    }
  };

  messageDelivered = async (io, socket, userData, chatRoomUsers, { messageId }) => {
    try {
        const message = await Message.findById(messageId);
        if (!message) return;

        const chatId = message.chat.toString();
        const chat = await Chat.findById(chatId);

        if (!chat || !chat.participants.includes(userData._id.toString()))
            return socket.emit("error", "Chat not found or unauthorized");

        // Prepare update: mark as delivered, and read if user is active in the chat room
        const updateBody = { isDelivered: true };
        if (chatRoomUsers[chatId] && chatRoomUsers[chatId].has(userData._id.toString()))
            updateBody.isRead = true;

        // Update all messages up to this message timestamp
        await Message.updateMany(
            {
                chat: chatId,
                sender: { $ne: userData._id },
                createdAt: { $lte: message.createdAt }
            },
            updateBody
        );

        // Find the other participant to notify
        const otherUserId = chat.participants.find(
            (participant) => participant.toString() !== userData._id.toString()
        );

        if (otherUserId) {
            // Notify other participant that message is delivered
            io.to(otherUserId.toString()).emit("message-delivered", {
                chatId,
                messageId: message._id,
                messageTime: message.createdAt
            });

            // If user is active in chat, also mark as seen
            if (chatRoomUsers[chatId] && chatRoomUsers[chatId].has(userData._id.toString()))
                io.to(otherUserId.toString()).emit("messages-seen", {
                    chatId,
                    seenTime: new Date()
                });
        }

    } catch (error) {
        // Handle any errors
        socket.emit("error", { message: error.message });
    }
  };

  leaveChat = async (socket, userData, chatRoomUsers, { chatId }) => {
    try {
        // Leave the specific socket room
        socket.leave(chatId.toString());

        // Remove user from in-memory chatRoomUsers map
        if (chatRoomUsers[chatId]) {
            chatRoomUsers[chatId].delete(userData._id.toString());

            // If no users left in this chat, remove the chat from map
            if (chatRoomUsers[chatId].size === 0) delete chatRoomUsers[chatId];
        }

    } catch (error) {
        socket.emit("error", { message: error.message });
    }
  };

  leaveAllChats = (socket, userData, chatRoomUsers) => {
    try {
        const userId = userData._id.toString();

        // Iterate over all chat rooms
        for (const [chatId, users] of Object.entries(chatRoomUsers)) {
            if (users.has(userId)) {
                // Remove user from the socket room
                socket.leave(chatId.toString());

                // Remove user from in-memory map
                users.delete(userId);

                // Clean up empty chat room
                if (users.size === 0) {
                    delete chatRoomUsers[chatId];
                }

            }
        }

    } catch (error) {
        socket.emit("error", { message: error.message });
    }
  };

}

module.exports = new SocketController();