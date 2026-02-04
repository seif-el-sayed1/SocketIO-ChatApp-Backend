const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      }
    ],
    clearedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    clearedAt: Date
  },
  { timestamps: true }
);

// Validate that the participants array has exactly 2 users
chatSchema.path("participants").validate(function (value) {
  return value.length === 2;
}, "Participants array must contain exactly 2 users.");

// Pre-save hook to sort participants and prevent duplicate chats
chatSchema.pre("save", async function (next) {
  if (this.isModified("participants")) {
    const chat = this;
    // Sort participants to ensure consistent order
    chat.participants.sort();
    // Check if a chat with the same participants already exists
    const existingChat = await mongoose.model("Chat").findOne({
      participants: { $all: chat.participants, $size: chat.participants.length }
    });
    if (existingChat) {
      const error = new Error("Chat with these participants already exists.");
      error.statusCode = 400;
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model("Chat", chatSchema);
