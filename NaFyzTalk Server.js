const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;

// Store connected users in-memory: client -> { userId, nickname, joinedAt }
const activeUsers = new Map();

// Serve static frontend files if hosted together
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', onlineCount: activeUsers.size });
});

function logDebug(category, message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${category}] ${message}`);
}

function broadcastAll(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function broadcastExcept(senderClient, data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client !== senderClient && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function sendToUser(targetUserId, data) {
  const payload = JSON.stringify(data);
  for (const [client, user] of activeUsers.entries()) {
    if (user.userId === targetUserId && client.readyState === WebSocket.OPEN) {
      client.send(payload);
      return true;
    }
  }
  return false;
}

function getOnlineUsersList() {
  const list = [];
  for (const user of activeUsers.values()) {
    list.push({
      userId: user.userId,
      nickname: user.nickname
    });
  }
  return list;
}

wss.on('connection', (ws, req) => {
  // Generate automatic unique session ID & nickname for new user
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const userId = 'usr_' + Math.random().toString(36).substring(2, 9);
  let nickname = `Guest-${randomSuffix}`;

  // Store user session info
  const userInfo = { userId, nickname, joinedAt: new Date() };
  activeUsers.set(ws, userInfo);

  logDebug('WebSocket connected', `User connected from ${req.socket.remoteAddress}. ID: ${userId}, Nick: ${nickname}`);

  // Send initial state to newly connected client
  ws.send(JSON.stringify({
    type: 'INIT_SESSION',
    payload: {
      userId,
      nickname,
      onlineUsers: getOnlineUsersList()
    }
  }));

  logDebug('Online users received', `Sent initial user list (${activeUsers.size} total) to ${userId}`);

  // Notify all OTHER online users that a new user joined
  broadcastExcept(ws, {
    type: 'USER_JOINED',
    payload: {
      user: { userId, nickname }
    }
  });
  logDebug('User joined', `Broadcasted USER_JOINED for ${userId} (${nickname})`);

  ws.on('message', (messageRaw) => {
    try {
      const data = JSON.parse(messageRaw);
      const { type, payload } = data;
      const currentUser = activeUsers.get(ws);

      if (!currentUser) return;

      switch (type) {
        case 'PING':
          ws.send(JSON.stringify({ type: 'PONG' }));
          break;

        case 'NICK_CHANGE':
          const newNick = (payload.newNick || '').trim().substring(0, 25);
          if (newNick) {
            logDebug('Nick change', `${currentUser.nickname} changed nickname to ${newNick}`);
            currentUser.nickname = newNick;
            activeUsers.set(ws, currentUser);

            broadcastAll({
              type: 'USER_UPDATED',
              payload: {
                userId: currentUser.userId,
                nickname: newNick
              }
            });
          }
          break;

        case 'CHAT_MSG':
          logDebug('Message sent', `From: ${currentUser.userId} (${currentUser.nickname}) -> ${payload.content}`);
          broadcastAll({
            type: 'CHAT_MSG',
            payload: {
              senderId: currentUser.userId,
              senderNick: currentUser.nickname,
              content: payload.content,
              time: payload.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          });
          logDebug('Message received', `Broadcasted chat message to ${activeUsers.size} clients.`);
          break;

        case 'CHAT_AUDIO':
          logDebug('Audio message sent', `From: ${currentUser.userId}`);
          broadcastAll({
            type: 'CHAT_AUDIO',
            payload: {
              senderId: currentUser.userId,
              senderNick: currentUser.nickname,
              attachment: payload.attachment,
              time: payload.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          });
          break;

        case 'CHAT_FILE':
          logDebug('File attachment sent', `From: ${currentUser.userId} - File: ${payload.attachment?.name}`);
          broadcastAll({
            type: 'CHAT_FILE',
            payload: {
              senderId: currentUser.userId,
              senderNick: currentUser.nickname,
              content: payload.content,
              attachment: payload.attachment,
              time: payload.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          });
          break;

        case 'RTC_OFFER':
        case 'RTC_ANSWER':
        case 'RTC_ICE':
        case 'RTC_HANGUP':
        case 'RTC_BUSY':
          if (payload.targetId) {
            logDebug('WebRTC Signal', `Relaying ${type} from ${currentUser.userId} to ${payload.targetId}`);
            sendToUser(payload.targetId, {
              type,
              payload: {
                ...payload,
                senderId: currentUser.userId,
                senderNick: currentUser.nickname
              }
            });
          }
          break;

        default:
          logDebug('Unknown Message', `Received unhandled type: ${type}`);
          break;
      }
    } catch (err) {
      console.error('[Error] Failed to process incoming message:', err.message);
    }
  });

  ws.on('close', () => {
    const user = activeUsers.get(ws);
    if (user) {
      logDebug('WebSocket disconnected', `User disconnected: ${user.userId} (${user.nickname})`);
      activeUsers.delete(ws);

      // Broadcast user left event to remaining clients
      broadcastAll({
        type: 'USER_LEFT',
        payload: {
          userId: user.userId,
          nickname: user.nickname
        }
      });
      logDebug('User left', `Broadcasted USER_LEFT for ${user.userId}`);
    }
  });

  ws.on('error', (err) => {
    console.error(`[WebSocket Error] ${userId}:`, err.message);
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 NaFyzTalk Backend Server running on port ${PORT}`);
  console.log(`📡 WebSocket Endpoint: ws://localhost:${PORT}`);
  console.log(`====================================================`);
});