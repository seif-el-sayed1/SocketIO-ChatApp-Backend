const asyncHandler = require("express-async-handler");
const Message = require("../models/message.model");
const Chat = require("../models/chat.model");
const { LABEL } = require("../utils/constants.js");

class ActionsController {
  // @desc    BLock a User
  // @route   GET /actions/:id/block
  // @access  Private
  blockUser = asyncHandler(async (req, res, next) => {
    let user = req.user;
    let { id: blockedUserId } = req.params;
    let loggedInUserId = req.user._id.toString();
    const io = req.app.get("socketio");

    // Add to blocked users
    await user.updateOne({ $addToSet: { blockedUsers: blockedUserId } });

    // Find chat between users
    let chat = await Chat.findOne({
      participants: { $all: [blockedUserId, loggedInUserId], $size: 2 }
    });

    if (chat) {
      const message = await Message.create({
        chat: chat._id,
        sender: loggedInUserId,
        type: LABEL,
        content: "blocked"
      });

      io.to(blockedUserId).emit("message", {
        _id: message._id.toString(),
        chat: chat._id.toString(),
        type: LABEL,
        content: "blocked",
        createdAt: message.createdAt,
        isMyMsg: false,
        isRead: false
      });

      io.to(loggedInUserId).emit("message", {
        _id: message._id.toString(),
        chat: chat._id.toString(),
        type: LABEL,
        content: "blocked",
        createdAt: message.createdAt,
        isMyMsg: true,
        isRead: false
      });
    }

    res.status(200).json({
      success: true,
      message: "User Has been Blocked Successfully"
    });
  });

  // @desc    Unblock a User
  // @route   GET /actions/:id/unblock
  // @access  Private
  unBlockUser = asyncHandler(async (req, res, next) => {
    let user = req.user;
    let { id: blockedUserId } = req.params;
    let loggedInUserId = req.user._id.toString();
    const io = req.app.get("socketio");
    await user.updateOne({ $pull: { blockedUsers: blockedUserId } });
    let chat = await Chat.findOne({
      participants: { $all: [blockedUserId, loggedInUserId], $size: 2 }
    });
    if (chat) {
      const message = await Message.create({
        chat: chat._id,
        sender: loggedInUserId,
        type: LABEL,
        content: "unblocked"
      });
      io.to(blockedUserId).emit("message", {
        _id: message._id.toString(),
        chat: chat._id.toString(),
        type: LABEL,
        content: "unblocked",
        createdAt: message.createdAt,
        isMyMsg: false,
        isRead: false
      });
      io.to(loggedInUserId).emit("message", {
        _id: message._id.toString(),
        chat: chat._id.toString(),
        type: LABEL,
        content: "unblocked",
        createdAt: message.createdAt,
        isMyMsg: true,
        isRead: false
      });
    }
    res.status(200).json({
      success: true,
      message: "User Has been Unblocked Successfully"
    });
  });
  
}

module.exports = new ActionsController();
