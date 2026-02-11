const express = require("express");

// Auth middlewares
const { protect, allowedTo } = require("../middleware/auth.middleware");

// Constants
const { USER } = require("../utils/constants");

// Classes
const ChatController = require("../controllers/chat.controller");
const FirebaseImageController = require("../controllers/firebase.controller");

const upload = require("../middleware/upload.middleware");

// Router
const router = express.Router();  

// Routes
router.route("/").get(protect, allowedTo(USER), ChatController.getMyChats);
router.route("/users").get(protect, allowedTo(USER), ChatController.getAllUsers);

router.route("/:id").get(protect, allowedTo(USER), ChatController.getOneChat);

router.route("/:id/messages").get(protect, allowedTo(USER), ChatController.getChatMessages);

router
  .route("/")
  .post(
    protect,
    allowedTo(USER),
    upload.uploadMultipleImagesForChat,
    FirebaseImageController.uploadMultipleImagesForTheChat("Chats"),
    ChatController.sendMediaMessage
  );

router.route("/clear/:id").patch(protect, allowedTo(USER), ChatController.clearChat);

module.exports = router;