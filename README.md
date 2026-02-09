# 💬 Chat & Messaging API

This repository contains a **real-time chat and messaging system** built with **Node.js**, **Express**, **MongoDB**, and **Socket.IO**.  
It supports **1-on-1 chats**, **media messages**, **push notifications**, **typing indicators**, **chat clearing**, and a **user block system**.

---

## ✨ Features

### 🔐 User Authentication
- JWT-based authentication for API and socket connections.
- Session validation with token expiration and password change check.
- Account status checks (`isActive`, `isBlocked`).

### ⚡ Real-time Chat (Socket.IO)
- Online user tracking.
- Typing indicators (`typing`, `stop-typing` events).
- Real-time message delivery and read receipts.
- Chat rooms for each conversation.
- Notifications sent to offline users.

### 📨 Messaging
- Send text and media messages (images supported).
- Auto-create 1-on-1 chat if it doesn't exist.
- Messages are marked as **delivered** and **read** appropriately.
- Push notifications to offline users using device tokens.

### 🏗️ Chat Management
- Join / leave chat rooms in real-time.
- Clear chat messages (per-user or full deletion based on chat state).
- Fetch all chats with pagination and search.
- Fetch a single chat with latest messages.

### 🚫 Block System
- Users can block each other.
- Blocked users **cannot send messages** to each other.
- `blockedByMe` and `blockedByOtherUser` statuses are tracked.
- Blocked status affects:
  - Sending messages
  - Real-time notifications
  - Chat listing

### 🖼️ Media Messages
- Send multiple images in one request.
- Only the first image triggers a "new chat" event if it's the first message.
- Push notifications for media messages.

---

## 🛠️ Tech Stack

- **Node.js**  
- **Express.js**  
- **MongoDB** & **Mongoose**  
- **Socket.IO** (for real-time messaging)  
- **JWT** (authentication)  
- **Firebase / Cloud Notification** (media push notifications)  

---

### 📡 Messages
- **Real-time Socket.IO events:**
  - `new-message` – send message
  - `typing` / `stop-typing` – typing indicator
  - `message-delivered` – mark message as delivered
  - `join-chat` / `leave-chat` – join/leave rooms
  - `new-chat` – notify first message in chat

---

## 🌐 Socket.IO Usage

- Connect using JWT token in `authorization` header.
- Each user has a personal room: `socket.join(userId)`.
- `online-users` event emits currently online users.
- Users automatically leave chat rooms on disconnect.
- Chat room state is tracked in-memory (`chatRoomUsers`).

---

## 📚 Developer Guide

[Download Developer Guide](https://drive.google.com/file/d/1x9BX4ciKlzzUWzInMJmV_xMuiYD0Aj8k/view?usp=sharing)
