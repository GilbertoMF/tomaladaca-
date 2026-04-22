import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  // Basic API for health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Socket.io logic
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join_room', (roomCode) => {
      socket.join(roomCode);
      
      // Update room size for everyone in this room
      const roomSize = io.sockets.adapter.rooms.get(roomCode)?.size || 0;
      io.to(roomCode).emit('room_status', { roomCode, size: roomSize });
      
      // Store roomCode on socket to handle disconnect updates
      (socket as any).currentRoom = roomCode;
      
      console.log(`User ${socket.id} joined room ${roomCode}. Total size: ${roomSize}`);
    });

    socket.on('send_message', (data) => {
      const { roomCode, payload, sender } = data;
      // Send to everyone in the room except the sender
      socket.to(roomCode).emit('receive_message', {
         payload,
         sender,
         timestamp: new Date().toISOString()
      });
    });

    socket.on('disconnect', () => {
      const roomCode = (socket as any).currentRoom;
      if (roomCode) {
        const roomSize = io.sockets.adapter.rooms.get(roomCode)?.size || 0;
        io.to(roomCode).emit('room_status', { roomCode, size: roomSize });
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
