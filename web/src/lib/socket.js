import { io } from 'socket.io-client';

let socket = null;

export function connectSocket(serverUrl, token) {
  if (socket) socket.disconnect();
  socket = io(serverUrl, { auth: { token }, transports: ['websocket', 'polling'] });
  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
