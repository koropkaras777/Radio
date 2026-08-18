import { hostMonitor } from '../stream/hostMonitor.js';
import { createSocketContext } from './context.js';
import { registerConnectionHandlers } from './handlers/connectionHandlers.js';
import { registerListenerHandlers } from './handlers/listenerHandlers.js';
import { registerAdminQueueHandlers } from './handlers/adminQueueHandlers.js';
import { registerLiveHostHandlers } from './handlers/liveHostHandlers.js';
import { registerGuestHandlers } from './handlers/guestHandlers.js';
import { registerModeratorHandlers } from './handlers/moderatorHandlers.js';

export function registerSocketHandlers(io, { radioEngine, dataProvider, radioStream }) {
  hostMonitor.setIo(io);

  const ctx = createSocketContext(io, { radioEngine, dataProvider, radioStream });

  io.on('connection', (socket) => {
    registerConnectionHandlers(socket, ctx);
    registerListenerHandlers(socket, ctx);
    registerAdminQueueHandlers(socket, ctx);
    registerLiveHostHandlers(socket, ctx);
    registerGuestHandlers(socket, ctx);
    registerModeratorHandlers(socket, ctx);
  });
}