const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let rooms = {}; // { roomCode: { name, clients: [{ ws, name }] } }
let clientRoomMap = new Map(); // Map WebSocket -> roomCode

// Function to broadcast updated client list
function broadcastClientList(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    const names = room.clients.map(c => c.name);
    const message = JSON.stringify({ type: "client_list", clients: names });

    room.clients.forEach(c => {
        if (c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(message);
        }
    });
}

wss.on("connection", (ws) => {
    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === "create") {
                const roomCode = uuidv4().slice(0, 6);
                rooms[roomCode] = { name: data.roomName, clients: [{ ws, name: data.clientName }] };
                clientRoomMap.set(ws, roomCode);
                ws.send(JSON.stringify({ type: "created", roomCode, roomName: data.roomName }));

                broadcastClientList(roomCode);

            } else if (data.type === "join") {
                const { roomCode } = data;
                if (rooms[roomCode]) {
                    rooms[roomCode].clients.push({ ws, name: data.clientName });
                    clientRoomMap.set(ws, roomCode);
                    ws.send(JSON.stringify({ type: "joined", roomCode, roomName: rooms[roomCode].name }));

                    broadcastClientList(roomCode);
                } else {
                    ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
                }

            } else {
                // Broadcast within room
                const roomCode = clientRoomMap.get(ws);
                if (roomCode && rooms[roomCode]) {
                    rooms[roomCode].clients.forEach(client => {
                        if (client.ws !== ws && client.ws.readyState === WebSocket.OPEN) {
                            client.ws.send(JSON.stringify(data));
                        }
                    });
                }
            }
        } catch (err) {
            console.error("JSON Parse error:", err);
            ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
        }
    });

    ws.on("close", () => {
        const roomCode = clientRoomMap.get(ws);
        if (roomCode && rooms[roomCode]) {
            rooms[roomCode].clients = rooms[roomCode].clients.filter(client => client.ws !== ws);
            if (rooms[roomCode].clients.length === 0) {
                delete rooms[roomCode];
            } else {
                broadcastClientList(roomCode);
            }
        }
        clientRoomMap.delete(ws);
    });
});

server.listen(3001, () => {
    console.log("WebSocket Signaling Server on http://localhost:3001");
});
