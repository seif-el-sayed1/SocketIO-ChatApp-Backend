const mongoose = require("mongoose");
const { MESSAGE_TYPES } = require("../utils/constants");

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      default: null
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      validate: {
        validator: function (value) {
          // If the message type is "label", sender is not required
          if (this.type === "label") {
            return true;
          }
          return value != null;
        },
        message: "Sender is required"
      }
    },
    content: {
      type: String,
      trim: true,
      required: [true, "Message content is required"]
    },
    type: {
      type: String,
      enum: MESSAGE_TYPES,
      default: "text"
    },
    isDelivered: {
      type: Boolean,
      default: false
    },
    isRead: {
      type: Boolean,
      default: false
    },
    isMyMsg: {
      type: Boolean
    }
  },
  {timestamps: true,}
);

// Add indexes
messageSchema.index({ chat: 1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ isDelivered: 1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ createdAt: 1 });

messageSchema.pre(/^find/, function (next) {
  if (this.getOptions().senderPopulation) {
    this.populate({
      path: "sender",
      model: "User",
      select:
        "type firstName lastName fullName profilePicture",
      options: {
        skipPopulation: true
      }
    });
  }
  next();
});

module.exports = mongoose.model("Message", messageSchema);
