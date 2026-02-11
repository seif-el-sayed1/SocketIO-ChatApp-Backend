const asyncHandler = require("express-async-handler");
const Message = require("../models/message.model");
const Chat = require("../models/chat.model");
const User = require("../models/user.model");
const ApiFeatures = require("../utils/ApiFeatures");
const ApiError = require("../utils/ApiError");
const { default: mongoose } = require("mongoose");
const FirebaseImageController = require("./firebase.controller");
const { sendMediaNotification } = require("./../startup/socket");
const { translate } = require("../utils/translation");

class ChatController {

  //@desc Get ALl Users 
  //@route GET /chats/users
  //@access Private
  getAllUsers = asyncHandler(async (req, res) => {
    const apiFeatures = new ApiFeatures(User.find({_id: {$ne: req.user._id}}).select("firstName lastName profilePicture isActive email"), req.query, "User").search().filter().paginate().cleanResponse();

    const users = await apiFeatures.query;
    
    res.json({
      success: true,
      totalResults: users.length,
      pagination: {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20, 
      },
      data: users
    });
  })

  // @desc    Get My Chats
  // @route   GET /chats
  // @access  Private
  getMyChats = asyncHandler(async (req, res) => {
    const { _id: userId, blockedUsers: loggedUserBlockedUsers } = req.user;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const noOfMessages = parseInt(req.query.noOfMessages) || 10;

    // Match chats where the user is a participant
    const matchParticipantStage = {
      $match: {
        participants: userId
      }
    };

    // Populate participants info
    const lookupUsersStage = {
      $lookup: {
        from: "users",
        localField: "participants",
        foreignField: "_id",
        as: "participants"
      }
    };

    // Compute 'to' user (other participant) & if chat cleared by me
    const addToStage = {
      $addFields: {
        to: {
          $arrayElemAt: [
            {
              $filter: {
                input: "$participants",
                as: "participant",
                cond: {
                  $ne: ["$$participant._id", userId]
                }
              }
            },
            0
          ]
        },
        isClearedByMe: {
          $eq: ["$clearedBy", userId]
        }
      }
    };

    // Filter by search term if provided
    const searchStage = search
      ? [
          {
            $match: {
              $or: [
                {
                  "to.firstName": {
                    $regex: search,
                    $options: "i"
                  }
                },
                {
                  "to.lastName": {
                    $regex: search,
                    $options: "i"
                  }
                }
              ]
            }
          }
        ]
      : [];

    // Lookup last N messages, ignore cleared ones
    const lookupMessagesStage = {
      $lookup: {
        from: "messages",
        let: {
          chatId: "$_id",
          clearedAt: "$clearedAt",
          isClearedByMe: "$isClearedByMe"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: ["$chat", "$$chatId"]
                  },
                  {
                    $or: [
                      { $eq: ["$$isClearedByMe", false] },
                      { $gt: ["$createdAt", "$$clearedAt"] }
                    ]
                  }
                ]
              }
            }
          },
          {
            $sort: {
              createdAt: -1
            }
          },
          {
            $limit: noOfMessages
          }
        ],
        as: "messages"
      }
    };

    // Flatten messages for grouping
    const unwindStage = {
      $unwind: {
        path: "$messages",
        preserveNullAndEmptyArrays: true
      }
    };

    // Group back chats and attach last message
    const groupStage = {
      $group: {
        _id: "$_id",
        messages: {
          $push: "$messages"
        },
        to: {
          $first: "$to"
        },
        blockedByArray: {
          $first: "$blockedByArray"
        },
        lastMessage: {
          $first: {
            $cond: {
              if: { $isArray: "$messages" },
              then: { $arrayElemAt: ["$messages", 0] },
              else: "$messages"
            }
          }
        }
      }
    };

    // Remove chats with no messages
    const removeEmptyChatsStage = {
      $match: {
        messages: { $ne: [] }
      }
    };

    // Compute unread count and blocked status
    const addComputedFieldsStage = {
      $addFields: {
        blockedByArray: {
          $cond: {
            if: { $isArray: "$blockedByArray" },
            then: "$blockedByArray",
            else: []
          }
        },
        unreadMessagesCount: {
          $sum: {
            $map: {
              input: { $ifNull: ["$messages", []] },
              as: "msg",
              in: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$$msg.isRead", false] },
                      { $ne: ["$$msg.sender", userId] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        },
        blocked: {
          $or: [
            { $in: ["$to._id", loggedUserBlockedUsers] },
            { $in: [userId, "$to.blockedUsers"] }
          ]
        },
        blockedByMe: {
          $in: ["$to._id", loggedUserBlockedUsers]
        },
        blockedByOtherUser: {
          $in: [userId, "$to.blockedUsers"]
        },
        lastMessageCreatedAt: {
          $ifNull: ["$lastMessage.createdAt", null]
        }
      }
    };

    // Project only necessary fields to frontend
    const projectStage = {
      $project: {
        to: {
          _id: 1,
          profilePicture: 1,
          isActive: 1,
          fullName: {
            $concat: ["$to.firstName", " ", "$to.lastName"]
          }
        },
        messages: {
          $map: {
            input: { $ifNull: ["$messages", []] },
            as: "msg",
            in: {
              _id: "$$msg._id",
              content: "$$msg.content",
              type: "$$msg.type",
              isDelivered: "$$msg.isDelivered",
              isRead: "$$msg.isRead",
              createdAt: "$$msg.createdAt",
              isMyMsg: {
                $eq: ["$$msg.sender", userId]
              }
            }
          }
        },
        unreadMessagesCount: 1,
        blocked: 1,
        blockedByMe: 1,
        blockedByOtherUser: 1,
        lastMessageCreatedAt: 1
      }
    };

    // Only include active users
    const activeUsersStage = {
      $match: {
        "to.isActive": true
      }
    };

    // Sort chats by last message
    const sortStage = {
      $sort: {
        lastMessageCreatedAt: -1
      }
    };

    const basePipeline = [
      matchParticipantStage,
      lookupUsersStage,
      addToStage,
      ...searchStage,
      lookupMessagesStage,
      unwindStage,
      groupStage,
      removeEmptyChatsStage,
      addComputedFieldsStage,
      projectStage,
      activeUsersStage,
      sortStage
    ];

    const pipeline = [
      ...basePipeline,
      { $skip: skip },
      { $limit: limit }
    ];

    const countPipeline = [
      ...basePipeline,
      { $count: "totalChats" }
    ];

    // Run aggregation in parallel
    const [chats, totalCountResult] = await Promise.all([
      Chat.aggregate(pipeline),
      Chat.aggregate(countPipeline)
    ]);

    // Mark messages as delivered
    await Message.updateMany(
      {
        sender: { $ne: userId },
        chat: { $in: chats.map(chat => chat._id) }
      },
      {
        isDelivered: true
      }
    );

    const totalChats = totalCountResult[0]?.totalChats || 0;
    const totalPages = Math.ceil(totalChats / limit);

    res.status(200).json({
      success: true,
      pagination: {
        totalResults: totalChats,
        totalPages,
        page,
        limit
      },
      data: chats
    });
  });

  // @desc    Get one chat
  // @route   GET /chats/:id
  // @access  Private
  getOneChat = asyncHandler(async (req, res) => {
    const noOfMessages = parseInt(req.query.noOfMessages) || 10;
    // Find the chat by ID and populate participants
    const chat = await Chat.findById(req.params.id).populate(
      "participants",
      "_id firstName lastName profilePicture blockedUsers"
    );
    // Find the participant who is not the logged-in user
    const toParticipant = chat.participants.find(
      (participant) => participant._id.toString() !== req.user._id.toString()
    );
    // Determine if the logged-in user has blocked the other participant
    const blockedByMe = req.user.blockedUsers.includes(toParticipant._id);
    // Determine if the other participant has blocked the logged-in user
    const blockedByOtherUser = toParticipant.blockedUsers.includes(req.user._id);
    // Prepare the response data
    let data = {
      _id: chat._id,
      to: {
        _id: toParticipant._id,
        profilePicture: toParticipant.profilePicture,
        fullName: `${toParticipant.firstName} ${toParticipant.lastName}`
      },
      blocked: blockedByMe || blockedByOtherUser,
      blockedByMe,
      blockedByOtherUser,
      messages: []
    };
    // Retrieve the latest messages for this chat
    const query = {
      chat: req.params.id
    };
    if (chat.clearedBy && chat.clearedBy?.toString() === req.user._id.toString())
      query.createdAt = { $gt: chat.clearedAt };
    const messages = await Message.find(query).sort({ createdAt: -1 }).limit(noOfMessages);
    // Format the messages for the response
    data.messages = messages.map((msg) => ({
      _id: msg._id,
      content: msg.content,
      type: msg.type,
      isMyMsg: msg.sender.toString() === req.user._id.toString(),
      isDelivered: msg.isDelivered,
      isRead: msg.isRead,
      createdAt: msg.createdAt
    }));
    // Send the response
    res.status(200).json({
      success: true,
      data
    });
  });

  // @desc    Get chat messages
  // @route   POST /chats/:id/messages
  // @access  Private
  getChatMessages = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { _id: userId } = req.user;
    const lang = req.headers.lang || "en";
    
    const chat = await Chat.findById(id);
    if (!chat)
      return res.status(404).json({
        success: false,
        message: translate("Chat Not Found!", lang)
      });
    
    if (!chat.participants.includes(userId))
      return res.status(403).json({
        success: false,
        message: translate("You are not a participant in this chat", lang)
      });
    
    // Build query, ignore messages cleared by user
    const query = { chat: id };
    if (chat.clearedBy && chat.clearedBy?.toString() === req.user._id.toString())
      query.createdAt = { $gt: chat.clearedAt };
    
    // Apply filters, search, pagination via ApiFeatures
    const apiFeatures = new ApiFeatures(
      Message.find(query)
        .select("_id sender content type isDelivered isRead createdAt updatedAt")
        .sort({ createdAt: -1 }),
      req.query,
      "Message"
    )
      .filter()
      .search();
    
    await apiFeatures.calculatePagination();
    apiFeatures.paginate().cleanResponse();
    
    // Execute the query
    const messages = await apiFeatures.query;
    
    // Transform messages for frontend
    const transformedMessages = messages.map((message) => ({
      ...message._doc,
      sender: undefined, // hide sender object
      isDelivered: message.sender.toString() === userId.toString() ? message.isDelivered : true,
      isRead: message.sender.toString() === userId.toString() ? message.isRead : true,
      isMyMsg: message.sender.toString() === userId.toString()
    }));
    
    // Mark all messages from others as delivered & read
    await Message.updateMany(
      { sender: { $ne: req.user._id }, chat: id },
      { isDelivered: true, isRead: true }
    );
    
    // Send response with pagination info
    res.status(200).json({
      success: true,
      totalResults: transformedMessages.length,
      pagination: apiFeatures.paginationResult,
      data: transformedMessages
    });
  });

  // @desc    Send new message
  // @route   POST /chat/send/:id
  // @access  Private
  sendMediaMessage = asyncHandler(async (req, res, next) => {  
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { _id: sender } = req.user;
        const { receiverId, chatId, media } = req.body;
        const lang = req.headers.lang || "en";

        let chat;
        let firstMsg = false;

        // Check if a chat already exists or needs to be created
        if (chatId && !receiverId) {
            chat = await Chat.findById(chatId)
                .populate(
                    "participants",
                    "_id profilePicture firstName lastName lang notificationToken"
                )
                .session(session);

            if (!chat) throw new ApiError(translate("Chat not found", lang), 404);

        } else if (receiverId && !chatId) {
            chat = await Chat.findOne({ participants: { $all: [sender, receiverId] } })
                .populate(
                    "participants",
                    "_id profilePicture firstName lastName lang notificationToken"
                )
                .session(session);

            if (!chat) {
                // Create a new chat if none exists
                chat = await Chat.create(
                    [{ participants: [sender, receiverId] }],
                    { session }
                );

                firstMsg = true;

                // Populate participants after creating the chat
                chat = await Chat.findById(chat[0]._id)
                    .populate(
                        "participants",
                        "_id profilePicture firstName lastName lang notificationToken"
                    )
                    .session(session);
            }

        } else {
            throw new ApiError("Please provide either chat id or receiver id", 400);
        }

        // Check cleared messages if needed (BEFORE creating new messages)
        if (!firstMsg && chat.clearedBy && chat.clearedAt) {
            const messagesAfterClear = await Message.find({ 
                chat: chat._id, 
                createdAt: { $gt: chat.clearedAt } 
            }).session(session);
            
            firstMsg = messagesAfterClear.length === 0;
        }

        // Create media messages
        const promises = media.map((one) =>
            Message.create(
                [
                    {
                        chat: chat._id,
                        sender,
                        type: "image",
                        content: one,
                    },
                ],
                { session }
            )
        );

        let messages = await Promise.all(promises);
        messages = messages.map((msg) => msg[0]);

        // Get the other participant (receiver)
        const toParticipant = chat.participants.find(
            p => p._id.toString() !== sender.toString()
        );

        // Emit messages through socket.io
        const io = req.app.get("socketio");

        // Loop through each message
        messages.forEach((newMessage, index) => {
            // Only the FIRST message should trigger "new-chat"
            const isFirstMessage = firstMsg && index === 0;

            for (let participant of chat.participants) {
                // Get the other participant for this specific participant
                const otherParticipant = chat.participants.find(
                    p => p._id.toString() !== participant._id.toString()
                );

                if (isFirstMessage) {
                    // Emit new-chat event ONLY for first message
                    io.to(participant._id.toString()).emit("new-chat", {
                        _id: chat._id,
                        to: {
                            _id: otherParticipant._id,
                            profilePicture: otherParticipant?.profilePicture || "",
                            fullName: `${otherParticipant.firstName} ${otherParticipant.lastName}`
                        },
                        messages: [{
                            _id: newMessage._id,
                            sender: {
                                _id: req.user._id,
                                fullName: participant._id.toString() === req.user._id.toString() 
                                    ? "You" 
                                    : req.user.firstName
                            },
                            content: newMessage.content,
                            type: newMessage.type,
                            isDelivered: newMessage.isDelivered,
                            isRead: newMessage.isRead,
                            isMyMsg: participant._id.toString() === req.user._id.toString(),
                            createdAt: newMessage.createdAt
                        }],
                        unreadMessagesCount: participant._id.toString() === req.user._id.toString() ? 0 : 1,
                        blocked: false
                    });
                } else {
                    // Emit regular message event
                    io.to(participant._id.toString()).emit("message", {
                        ...newMessage.toObject(),
                        sender: undefined,
                        isMyMsg: participant._id.toString() === req.user._id.toString()
                    });
                }
            }
        });

        // Send ONE notification for all media (not per message)
        if (toParticipant?.notificationToken) {
            sendMediaNotification({
                fromUser: req.user,
                toUser: toParticipant,
                roomId: chat._id.toString(),
                image: messages[0].content,
                count: messages.length
            });
        }

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        // Send response
        res.status(201).json({
            success: true,
            chat: firstMsg
                ? {
                      _id: chat._id,
                      to: {
                          _id: toParticipant._id,
                          profilePicture: toParticipant.profilePicture,
                          fullName: `${toParticipant.firstName} ${toParticipant.lastName}`
                      },
                      messages: messages.map((msg) => ({
                          ...msg.toObject(),
                          sender: undefined,
                          isMyMsg: true,
                      })),
                      unreadMessagesCount: 0,
                      blocked: false,
                  }
                : undefined,
            messages: firstMsg
                ? undefined
                : messages.map((msg) => ({
                      ...msg.toObject(),
                      sender: undefined,
                      isMyMsg: true,
                  })),
        });

    } catch (error) {
        // Abort the transaction in case of error
        if (session.inTransaction()) await session.abortTransaction();
        session.endSession();

        // Rollback uploaded images
        FirebaseImageController.rollbackChatImages(req);

        next(error);
    }
  });

  // @desc    Clear user chat
  // @route   PATCH /chat/clear/:id
  // @access  Private
  clearChat = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const { _id: userId } = req.user;
    const lang = req.headers.lang || "en";
    // Start a session
    const session = await Chat.startSession();
    session.startTransaction();
    try {
      const chat = await Chat.findById(id).session(session);
      if (!chat) throw new ApiError(translate("Chat not found", lang), 404);
      // Check if the user is a participant in the chat
      if (!chat.participants.includes(userId))
        throw new ApiError(translate("You are not a participant in this chat", lang), 403);
      if (chat.clearedBy && chat.clearedBy?.toString() === userId.toString()) {
        chat.clearedAt = new Date();
        await chat.save({ session });
      } else if (chat.clearedBy) {
        let messagesAfterDeletion = await Message.find({
          chat: id,
          createdAt: { $gt: chat.clearedAt }
        }).session(session);
        if (messagesAfterDeletion.length === 0) {
          await chat.deleteOne({ session });
          await Message.deleteMany(
            {
              chat: id
            },
            { session }
          );
        } else {
          // Delete messages older than the last cleared date
          await Message.deleteMany({ chat: id, createdAt: { $lt: chat.clearedAt } }).session(
            session
          );
          chat.clearedBy = userId;
          chat.clearedAt = new Date();
          await chat.save({ session });
        }
      } else {
        chat.clearedBy = userId;
        chat.clearedAt = new Date();
        await chat.save({ session });
      }
      // Save the chat within the transaction
      // Commit the transaction
      await session.commitTransaction();
      session.endSession();
      res.status(200).json({
        success: true,
        message: "Chat cleared successfully"
      });
    } catch (error) {
      // Abort the transaction on error
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  });

}

module.exports = new ChatController();
