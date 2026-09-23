import { Server  } from 'socket.io';

class SocketManager { io: any;
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: '*', // Set specific origins in production
        methods: ['GET', 'POST']
      }
    });

    this.init();
  }

  init() {
    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Broadcast an event to all connected clients (e.g. for live check-in feed)
   */
  broadcast(event, payload) {
    this.io.emit(event, payload);
  }
}

export default SocketManager;
