import { Server  } from 'socket.io';
import DashboardEvents from './DashboardEvents';

class SocketManager {
  io: any;
  dashboardEvents: DashboardEvents;

  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: '*', // Set specific origins in production
        methods: ['GET', 'POST']
      }
    });

    this.dashboardEvents = new DashboardEvents(this.io);
    this.init();
  }

  init() {
    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
      });
    });

    // Setup periodic dashboard updates
    this.dashboardEvents.setupPeriodicUpdates();
  }

  /**
   * Broadcast an event to all connected clients (e.g. for live check-in feed)
   */
  broadcast(event, payload) {
    this.io.emit(event, payload);
  }
}

export default SocketManager;
