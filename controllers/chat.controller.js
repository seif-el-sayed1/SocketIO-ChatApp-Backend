const asyncHandler = require("express-async-handler");
const Message = require("../models/message.model");
const Chat = require("../models/chat.model");
const ApiFeatures = require("../utils/ApiFeatures");
const ApiError = require("../utils/ApiError");
const { default: mongoose } = require("mongoose");
const FirebaseImageController = require("./firebase.controller");
const { sendMediaNotification } = require("./../startup/socket");
const { translate } = require("../utils/translation");

class ChatController {
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

  
}

module.exports = new ChatController();
