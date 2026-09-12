const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Setup directories
const uploadsDir = path.join(__ nationally, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ 
        url: fileUrl, 
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size
    });
});

// Keep track of connected clients
const clients = new Map(); 

// Generate a random guest name
function generateGuestName() {
    return 'Guest-' + Math.floor(1000 + Math.random() * 9000);
}

// Broadcast to all clients except the sender (optional)
function broadcast(message, senderId = null) {
    const messageStr = JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

// Send updated user list to everyone
function broadcastUserList() {
    const users = Array.from(clients.entries()).map(([id, data]) => ({
        id: id,
        name: data.name
    }));
    broadcast({ type: 'user-list', users });
}

wss.on('connection', (ws) => {
    // Assign unique ID and name
    const clientId = Math.random().toString(36).substring(2, 15);
    const clientName = generateGuestName();
    
    clients.set(clientId, { ws, name: clientName });

    // Send the client their ID and name
    ws.send(JSON.stringify({
        type: 'welcome',
        id: clientId,
        name: clientName
    }));

    // Broadcast new user joined
    broadcast({ type: 'system', message: `${clientName} has joined the chat.` });
    broadcastUserList();

    ws.on('message', (messageAsString) => {
        try {
            const data = JSON.parse(messageAsString);
            
            // Rate limiting/validation can be added here
            
            switch (data.type) {
                case 'chat':
                    // Escape basic HTML (Simple XSS prevention on server)
                    const safeMessage = String(data.content).replace(/</g, "&lt;").replace(/>/g, "&gt;");
                    broadcast({
                        type: 'chat',
                        senderId: clientId,
                        senderName: clients.get(clientId).name,
                        content: safeMessage,
                        timestamp: new Date().toISOString()
                    });
                    break;
                case 'file':
                     broadcast({
                        type: 'file',
                        senderId: clientId,
                        senderName: clients.get(clientId).name,
                        fileInfo: data.fileInfo,
                        timestamp: new Date().toISOString()
                    });
                    break;
                case 'rename':
                    const oldName = clients.get(clientId).name;
                    const safeNewName = String(data.newName).replace(/</g, "&lt;").replace(/>/g, "&gt;").substring(0, 20);
                    clients.get(clientId).name = safeNewName;
                    broadcast({ type: 'system', message: `${oldName} changed name to ${safeNewName}.` });
                    broadcastUserList();
                    break;
                    
                // WebRTC Signaling
                case 'webrtc-offer':
                case 'webrtc-answer':
                case 'webrtc-ice':
                case 'webrtc-reject':
                case 'webrtc-end':
                    // Route the signaling message to the specific target
                    const targetClient = clients.get(data.targetId);
                    if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
                        data.senderId = clientId;
                        data.senderName = clients.get(clientId).name;
                        targetClient.ws.send(JSON.stringify(data));
                    }
                    break;
            }
        } catch (error) {
            console.error('Invalid message received:', error);
        }
    });

    ws.on('close', () => {
        const clientData = clients.get(clientId);
        if (clientData) {
            broadcast({ type: 'system', message: `${clientData.name} has left the chat.` });
            clients.delete(clientId);
            broadcastUserList();
        }
    });
});

server.listen(PORT, () => {
    console.log(`NaFyzTalk server running on http://localhost:${PORT}`);
});
