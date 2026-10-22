import busRepository from '../../infrastructure/repositories/BusRepository';

class BusController {
  // Vehicles
  async listVehicles(req: any, res: any, next: any) {
    try {
      const vehicles = await busRepository.listVehicles();
      res.json({ success: true, data: { vehicles } });
    } catch (error) {
      next(error);
    }
  }

  async createVehicle(req: any, res: any, next: any) {
    try {
      const vehicle = await busRepository.createVehicle(req.body);
      res.status(201).json({ success: true, data: { vehicle } });
    } catch (error) {
      next(error);
    }
  }

  async updateVehicle(req: any, res: any, next: any) {
    try {
      const { id } = req.params;
      const vehicle = await busRepository.updateVehicle(Number(id), req.body);
      res.json({ success: true, data: { vehicle } });
    } catch (error) {
      next(error);
    }
  }

  async deleteVehicle(req: any, res: any, next: any) {
    try {
      const { id } = req.params;
      await busRepository.deleteVehicle(Number(id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // Routes
  async listRoutes(req: any, res: any, next: any) {
    try {
      const routes = await busRepository.listRoutes();
      res.json({ success: true, data: { routes } });
    } catch (error) {
      next(error);
    }
  }

  async createRoute(req: any, res: any, next: any) {
    try {
      const route = await busRepository.createRoute(req.body);
      res.status(201).json({ success: true, data: { route } });
    } catch (error) {
      next(error);
    }
  }

  async updateRoute(req: any, res: any, next: any) {
    try {
      const { id } = req.params;
      const route = await busRepository.updateRoute(Number(id), req.body);
      res.json({ success: true, data: { route } });
    } catch (error) {
      next(error);
    }
  }

  async deleteRoute(req: any, res: any, next: any) {
    try {
      const { id } = req.params;
      await busRepository.deleteRoute(Number(id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // Assigned Students
  async listBusStudents(req: any, res: any, next: any) {
    try {
      const { routeId } = req.query;
      const students = await busRepository.listBusStudents(routeId ? Number(routeId) : undefined);
      res.json({ success: true, data: { students } });
    } catch (error) {
      next(error);
    }
  }

  async assignStudent(req: any, res: any, next: any) {
    try {
      const assignment = await busRepository.assignStudent(req.body);
      res.status(201).json({ success: true, data: { assignment } });
    } catch (error) {
      next(error);
    }
  }

  async removeStudent(req: any, res: any, next: any) {
    try {
      const { studentId } = req.params;
      await busRepository.removeStudent(Number(studentId));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // Card Tap / Scan on Bus
  async scanBusCard(req: any, res: any, next: any) {
    try {
      const log = await busRepository.scanBusCard({
        ...req.body,
        scannedBy: req.user?.userId,
      });

      if (req.app.get('socketManager')) {
        req.app.get('socketManager').broadcast('bus-scan-update', log);
      }

      res.status(201).json({ success: true, data: { log } });
    } catch (error) {
      next(error);
    }
  }

  // Logs & Manifest
  async listLogs(req: any, res: any, next: any) {
    try {
      const { vehicleId, studentId, date, page, limit } = req.query;
      const result = await busRepository.listLogs({
        vehicleId: vehicleId ? Number(vehicleId) : undefined,
        studentId: studentId ? Number(studentId) : undefined,
        date,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getLiveManifest(req: any, res: any, next: any) {
    try {
      const { vehicleId } = req.query;
      const manifest = await busRepository.getLiveManifest(vehicleId ? Number(vehicleId) : undefined);
      res.json({ success: true, data: manifest });
    } catch (error) {
      next(error);
    }
  }

  // ─── GPS Live Tracking ──────────────────────────────────
  async recordLocation(req: any, res: any, next: any) {
    try {
      const { vehicleId, routeId, latitude, longitude, speed, heading } = req.body;
      if (!vehicleId || latitude == null || longitude == null) {
        return res.status(400).json({ success: false, message: 'vehicleId, latitude, and longitude are required' });
      }

      const location = await busRepository.recordLocation({
        vehicleId: Number(vehicleId),
        routeId: routeId ? Number(routeId) : undefined,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        speed: speed != null ? parseFloat(speed) : undefined,
        heading: heading != null ? parseFloat(heading) : undefined,
      });

      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        // Broadcast to fleet subscribers
        socketManager.broadcast('bus:location-update', location);
        // Also emit to specific route room
        if (location.routeId) {
          socketManager.toRoom(`bus:${location.routeId}`, 'bus:location-update', location);
        }
      }

      res.status(201).json({ success: true, data: { location } });
    } catch (error) {
      next(error);
    }
  }

  async getFleetLocations(req: any, res: any, next: any) {
    try {
      const fleet = await busRepository.getFleetLocations();
      res.json({ success: true, data: { fleet } });
    } catch (error) {
      next(error);
    }
  }

  async getRouteLocation(req: any, res: any, next: any) {
    try {
      const { routeId } = req.params;
      const data = await busRepository.getRouteLocation(Number(routeId));
      if (!data) {
        return res.status(404).json({ success: false, message: 'Route or vehicle not found' });
      }
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export default new BusController();
