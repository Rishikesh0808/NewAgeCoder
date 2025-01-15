const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const ACTIONS = require("./Actions");
const cors = require("cors");
const axios = require("axios");
const server = http.createServer(app);
require("dotenv").config();

const languageConfig = {
  python3: { versionIndex: "3" },
  java: { versionIndex: "3" },
  cpp: { versionIndex: "4" },
  nodejs: { versionIndex: "3" },
  c: { versionIndex: "4" },
  ruby: { versionIndex: "3" },
  go: { versionIndex: "3" },
  scala: { versionIndex: "3" },
  bash: { versionIndex: "3" },
  sql: { versionIndex: "3" },
  pascal: { versionIndex: "2" },
  csharp: { versionIndex: "3" },
  php: { versionIndex: "3" },
  swift: { versionIndex: "3" },
  rust: { versionIndex: "3" },
  r: { versionIndex: "3" },
};

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const userSocketMap = {};
const RoomStatus = new Map();
const timelock=new Map();
// Utility function to get all connected clients in a room
const getAllConnectedClients = (roomId) => {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId],
      };
    }
  );
};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Handle user joining a room
  socket.on(ACTIONS.JOIN, ({ roomId, username },callback) => {
    if(timelock.has(roomId) && timelock.get(roomId)+(60 * 60 * 1000)>Date.now())
    {
       callback({status:true,time:Date.now()+(60*60*1000)-timelock.get(roomId)})
    }
    else{
    userSocketMap[socket.id] = username;
    socket.join(roomId);

    const clients = getAllConnectedClients(roomId);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
    });
  }});

  // Sync code between users in the same room
  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code, line=0, username },callback) => {
    // Check if the line is locked by another user
    if (!RoomStatus.has(roomId)) {
      // Room doesn't exist, create a new locked lines map for this room
      let lockedlines = new Map();
      lockedlines.set(username, line); // Lock the line for this user
      RoomStatus.set(roomId, lockedlines);
      console.log(`Room ${roomId} created with line locked for ${username}`);
      socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code }); // Emit code if no locking conflict
    } else {
      let lockedlines = RoomStatus.get(roomId); // Get the map of locked lines for this room
      let isLocked = false;

      // Check if the line is locked by another user
      lockedlines.forEach((lockedLine, userName) => {
        if (lockedLine === line && userName !== username) {
          isLocked = true;
        }
      });

      if (isLocked) {
        console.log(`Line ${line} is locked by another user`);
        callback(true);
        // Optionally, send a response to the user that the line is locked
      } else {
        // Lock the line for the current user
        lockedlines.set(username, line);
        console.log(`Line ${line} locked successfully for user ${username}`);
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code }); // Emit code if no lock conflict
      }
    }
  });

  // Sync code with a specific user (usually after a request to sync code)
  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });
  socket.on("lock", (roomId, callback) => {
  // Set the current time as the lock timestamp for the room
  timelock.set(roomId, Date.now());

  // Respond back to the client indicating that the room was locked successfully
  

  console.log(`Room ${roomId} locked at ${new Date().toISOString()}`);
});
socket.on("unlock", (roomId, callback) => {
  // Set the current time as the lock timestamp for the room
  timelock.delete(roomId);

  // Respond back to the client indicating that the room was locked successfully
  

  console.log(`Room ${roomId} unlocked at ${new Date().toISOString()}`);
});

  // Handle user disconnecting
  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      const lockedlines = RoomStatus.get(roomId);
      if (lockedlines) {
        // Unlock lines that this user has locked
        lockedlines.delete(userSocketMap[socket.id]);
        console.log(`Unlocked lines for user ${userSocketMap[socket.id]} in room ${roomId}`);
      }
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });

    // Clean up the user and their locked lines when they disconnect
    delete userSocketMap[socket.id];
    rooms.forEach((roomId) => {
      const lockedlines = RoomStatus.get(roomId);
      if (lockedlines) {
        lockedlines.delete(userSocketMap[socket.id]);
      }
    });
    socket.leave();
  });
});

app.post("/compile", async (req, res) => {
  const { code, language } = req.body;
console.log(code+"lang:"+language)
  try {
    const response = await axios.post("https://api.jdoodle.com/v1/execute", {
      script: code,
      language: language,
      versionIndex: languageConfig[language].versionIndex,
      clientId: "ece0ea04c355be86beaea2000ad6ee6f",
      clientSecret: "9277dd586d1369269fea631c83be6271968928d542ee1f03dd2810decea56708"
    });

    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to compile code" });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
