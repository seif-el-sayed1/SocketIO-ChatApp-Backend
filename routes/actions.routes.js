const express = require("express");

// Auth middlewares
const { protect, allowedTo } = require("../middleware/auth.middleware");

// Constants
const { USER } = require("../utils/constants");

// Classes
const ActionsController = require("../controllers/actions.controller");
const UserValidator = require("../validators/user.validator");
const GlobalValidator = require("../validators/global.validator");
// Router
const router = express.Router();

// Routes

router
  .route("/lang")
  .patch(
      protect,
      allowedTo(USER),
      GlobalValidator.updateUserLangValidator,
      ActionsController.updateUserLang
  );

router
  .route("/:id/block")
  .post(
    protect,
    allowedTo(USER),
    UserValidator.validateUserBlock,
    ActionsController.blockUser
  );

router
  .route("/:id/unblock")
  .post(
    protect,
    allowedTo(USER),
    UserValidator.validateUserBlock,
    ActionsController.unBlockUser
  );

module.exports = router;
