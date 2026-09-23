import { Server } from 'socket.io';

import { verifyToken } from '../common/utils/security.js';

let io;

const libraryRoom = (libraryId) => `library:${libraryId}`;
const userRoom = (userId) => `user:${userId}`;

const initializeSocket = (httpServer, allowedOrigins) => {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
      || socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');

    try {
      const user = verifyToken(token, 'access');
      if (!user.libraryId || !['STUDENT', 'LIBRARIAN'].includes(user.role)) {
        throw new Error('A library member account is required');
      }
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid or expired socket token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(libraryRoom(socket.user.libraryId));
    socket.join(userRoom(socket.user.id));
    socket.emit('socket:ready', { libraryId: socket.user.libraryId });
  });

  return io;
};

const emitToLibrary = (libraryId, event, payload) => {
  if (!io) return;
  io.to(libraryRoom(libraryId)).emit(event, payload);
};

const emitToUser = (userId, event, payload) => {
  if (!io) return;
  io.to(userRoom(userId)).emit(event, payload);
};

export { initializeSocket, emitToLibrary, emitToUser };
