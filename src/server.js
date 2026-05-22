import http from 'http';
import { execSync } from 'child_process';
import { Server } from 'socket.io';
import { config } from './config.js';
import { createApp } from './createApp.js';
import { RoomStore } from './game/roomStore.js';
import { RoomService } from './game/roomService.js';
import { createRoomBroadcaster } from './socket/roomBroadcast.js';
import { registerSocketHandlers } from './socket/registerHandlers.js';

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: config.corsOrigin } });

const roomStore = new RoomStore();
const roomService = new RoomService(roomStore);
const emitRoomState = createRoomBroadcaster(io, roomService);

registerSocketHandlers(io, roomService, emitRoomState);

server.listen(config.port, config.host, () => {
  console.log(`Game 200 — http://localhost:${config.port}`);
  if (config.host === '0.0.0.0') {
    try {
      const ip = execSync('ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1', {
        encoding: 'utf8',
      }).trim();
      if (ip) console.log(`LAN: http://${ip}:${config.port}`);
    } catch {
      /* optional LAN hint */
    }
  }
});
