import { Server } from 'socket.io';
import DashboardEvents from './DashboardEvents';

let activeSocketManager: SocketManager | null = null;

export const getSocketManager = (): SocketManager | null => activeSocketManager;

class SocketManager {
  io: any;
  dashboardEvents: DashboardEvents;

  constructor(server: any) {
    this.io = new Server(server, {
      cors: {
        origin: '*', // Set specific origins in production
        methods: ['GET', 'POST']
      }
    });

    this.dashboardEvents = new DashboardEvents(this.io);
    activeSocketManager = this;
    this.init();
  }

  init() {
    this.io.on('connection', (socket: any) => {
      // 1. Join user notification room
      socket.on('join:user', (userId: number | string) => {
        if (userId) {
          const room = `user:${userId}`;
          socket.join(room);
        }
      });

      // 2. Join bus route GPS room
      socket.on('join:bus', (routeId: number | string) => {
        if (routeId) {
          const room = `bus:${routeId}`;
          socket.join(room);
        }
      });

      socket.on('leave:bus', (routeId: number | string) => {
        if (routeId) {
          socket.leave(`bus:${routeId}`);
        }
      });

      // 3. Join chat conversation room
      socket.on('join:chat', (conversationId: number | string) => {
        if (conversationId) {
          const room = `chat:${conversationId}`;
          socket.join(room);
        }
      });

      socket.on('leave:chat', (conversationId: number | string) => {
        if (conversationId) {
          socket.leave(`chat:${conversationId}`);
        }
      });

      // Real-time typing indicators
      socket.on('chat:typing', (data: { conversationId: number; userId: number; userName: string; isTyping: boolean }) => {
        if (data?.conversationId) {
          socket.to(`chat:${data.conversationId}`).emit('chat:user-typing', data);
        }
      });

      socket.on('disconnect', () => {
        // cleaned up by socket.io automatically
      });
    });

    // Setup periodic dashboard updates
    this.dashboardEvents.setupPeriodicUpdates();
  }

  /**
   * Broadcast an event to all connected clients (e.g. for live check-in feed)
   */
  broadcast(event: string, payload: any) {
    this.io.emit(event, payload);
  }

  /**
   * Send event to a specific room
   */
  toRoom(room: string, event: string, payload: any) {
    this.io.to(room).emit(event, payload);
  }

  /**
   * Send event to a specific user (e.g. In-App Notification)
   */
  toUser(userId: number | string, event: string, payload: any) {
    this.io.to(`user:${userId}`).emit(event, payload);
  }
}

export default SocketManager;
