import prisma from '../database/PrismaClient';
import dispatcher from '../notifications/NotificationDispatcher';

export class BusRepository {
  // ─── Vehicles ──────────────────────────────────────────
  async listVehicles() {
    return prisma.busVehicle.findMany({
      orderBy: { plateNumber: 'asc' },
      include: {
        _count: { select: { busStudents: true, routes: true } },
      },
    });
  }

  async createVehicle(data: {
    plateNumber: string;
    model?: string;
    capacity?: number;
    driverName: string;
    driverPhone: string;
    status?: string;
  }) {
    return prisma.busVehicle.create({
      data: {
        plateNumber: data.plateNumber,
        model: data.model,
        capacity: data.capacity ?? 15,
        driverName: data.driverName,
        driverPhone: data.driverPhone,
        status: data.status ?? 'active',
      },
    });
  }

  async updateVehicle(
    vehicleId: number,
    data: {
      plateNumber?: string;
      model?: string;
      capacity?: number;
      driverName?: string;
      driverPhone?: string;
      status?: string;
    }
  ) {
    return prisma.busVehicle.update({
      where: { vehicleId },
      data,
    });
  }

  async deleteVehicle(vehicleId: number) {
    return prisma.busVehicle.delete({
      where: { vehicleId },
    });
  }

  // ─── Routes ────────────────────────────────────────────
  async listRoutes() {
    return prisma.busRoute.findMany({
      orderBy: { routeId: 'asc' },
      include: {
        vehicle: true,
        _count: { select: { busStudents: true } },
      },
    });
  }

  async createRoute(data: {
    routeNameEn: string;
    routeNameLo: string;
    vehicleId?: number;
    description?: string;
    stops?: any;
    isActive?: boolean;
  }) {
    return prisma.busRoute.create({
      data: {
        routeNameEn: data.routeNameEn,
        routeNameLo: data.routeNameLo,
        vehicleId: data.vehicleId,
        description: data.description,
        stops: data.stops,
        isActive: data.isActive ?? true,
      },
      include: { vehicle: true },
    });
  }

  async updateRoute(
    routeId: number,
    data: {
      routeNameEn?: string;
      routeNameLo?: string;
      vehicleId?: number;
      description?: string;
      stops?: any;
      isActive?: boolean;
    }
  ) {
    return prisma.busRoute.update({
      where: { routeId },
      data,
      include: { vehicle: true },
    });
  }

  async deleteRoute(routeId: number) {
    return prisma.busRoute.delete({
      where: { routeId },
    });
  }

  // ─── Bus Students ──────────────────────────────────────
  async listBusStudents(routeId?: number) {
    const where: any = {};
    if (routeId) where.routeId = routeId;

    return prisma.busStudent.findMany({
      where,
      include: {
        student: {
          select: {
            studentId: true,
            studentCode: true,
            fullNameEn: true,
            fullNameLo: true,
            photoUrl: true,
            cards: { where: { status: 'active' }, select: { cardUid: true } },
            classStudents: {
              select: { class: { select: { nameEn: true, nameLo: true } } },
            },
          },
        },
        route: true,
        vehicle: true,
      },
    });
  }

  async assignStudent(data: {
    studentId: number;
    routeId: number;
    vehicleId?: number;
    pickupStop?: string;
    dropoffStop?: string;
  }) {
    return prisma.busStudent.upsert({
      where: { studentId: data.studentId },
      update: {
        routeId: data.routeId,
        vehicleId: data.vehicleId,
        pickupStop: data.pickupStop,
        dropoffStop: data.dropoffStop,
        isActive: true,
      },
      create: {
        studentId: data.studentId,
        routeId: data.routeId,
        vehicleId: data.vehicleId,
        pickupStop: data.pickupStop,
        dropoffStop: data.dropoffStop,
        isActive: true,
      },
      include: {
        student: true,
        route: true,
      },
    });
  }

  async removeStudent(studentId: number) {
    return prisma.busStudent.delete({
      where: { studentId },
    });
  }

  // ─── Smart Card Tap on Bus ─────────────────────────────
  async scanBusCard(params: {
    cardUid: string;
    vehicleId?: number;
    logType?: 'board' | 'alight';
    direction?: 'to_school' | 'to_home';
    location?: string;
    scannedBy?: number;
  }) {
    const { cardUid, vehicleId, location, scannedBy } = params;
    const card = await prisma.card.findUnique({
      where: { cardUid },
      include: {
        student: {
          include: {
            busStudent: {
              include: { route: true, vehicle: true },
            },
          },
        },
      },
    });

    if (!card) {
      throw Object.assign(new Error('Card not found'), { statusCode: 404 });
    }
    if (card.status !== 'active') {
      throw Object.assign(new Error(`Card is ${card.status}`), { statusCode: 409 });
    }

    const student = card.student;
    const resolvedVehicleId = vehicleId || student.busStudent?.vehicleId;
    const resolvedRouteId = student.busStudent?.routeId;

    // Determine direction and logType if not explicitly passed
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const lastLog = await prisma.busLog.findFirst({
      where: {
        studentId: student.studentId,
        logTime: { gte: todayStart },
      },
      orderBy: { logTime: 'desc' },
    });

    let logType = params.logType;
    if (!logType) {
      logType = (!lastLog || lastLog.logType === 'alight') ? 'board' : 'alight';
    }

    let direction = params.direction;
    if (!direction) {
      // Before 12:00 = to_school, after 12:00 = to_home
      direction = now.getHours() < 12 ? 'to_school' : 'to_home';
    }

    const busLog = await prisma.busLog.create({
      data: {
        studentId: student.studentId,
        cardId: card.cardId,
        vehicleId: resolvedVehicleId,
        routeId: resolvedRouteId,
        logType,
        direction,
        location: location || (logType === 'board' ? 'Pickup Point' : 'School/Home Dropoff'),
        scannedBy,
      },
      include: {
        student: true,
        vehicle: true,
        route: true,
      },
    });

    // Notify parents in real time
    const vehicleInfo = busLog.vehicle ? ` (ລົດ ${busLog.vehicle.plateNumber})` : '';
    const vehicleInfoEn = busLog.vehicle ? ` (Bus ${busLog.vehicle.plateNumber})` : '';
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    let msgEn = '';
    let msgLo = '';

    if (logType === 'board') {
      const dirTextEn = direction === 'to_school' ? 'heading to school' : 'heading home';
      const dirTextLo = direction === 'to_school' ? 'ກຳລັງເດີນທາງມາໂຮງຮຽນ' : 'ກຳລັງເດີນທາງກັບບ້ານ';
      msgEn = `🚌 School Bus Alert: ${student.fullNameEn} boarded the school bus${vehicleInfoEn} at ${timeStr}, ${dirTextEn}.`;
      msgLo = `🚌 ແຈ້ງເຕືອນລົດຮັບສົ່ງ: ນ້ອງ ${student.fullNameLo} ໄດ້ຂຶ້ນລົດຮັບສົ່ງ${vehicleInfo} ເວລາ ${timeStr}, ${dirTextLo}.`;
    } else {
      const dirTextEn = direction === 'to_school' ? 'arrived at school' : 'arrived at home/stop';
      const dirTextLo = direction === 'to_school' ? 'ຮອດໂຮງຮຽນແລ້ວ' : 'ຮອດຈຸດສົ່ງ/ບ້ານແລ້ວ';
      msgEn = `🚌 School Bus Alert: ${student.fullNameEn} alighted the school bus${vehicleInfoEn} at ${timeStr} (${dirTextEn}).`;
      msgLo = `🚌 ແຈ້ງເຕືອນລົດຮັບສົ່ງ: ນ້ອງ ${student.fullNameLo} ໄດ້ລົງລົດຮັບສົ່ງ${vehicleInfo} ເວລາ ${timeStr} (${dirTextLo}).`;
    }

    dispatcher.notifyParents(
      student.studentId,
      'transport',
      msgEn,
      msgLo
    ).catch((err) => console.error('[Bus] Parent notification error:', err));

    return busLog;
  }

  // ─── Logs & Live Manifest ──────────────────────────────
  async listLogs(query: {
    vehicleId?: number;
    studentId?: number;
    date?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 30));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.vehicleId) where.vehicleId = query.vehicleId;
    if (query.studentId) where.studentId = query.studentId;

    if (query.date) {
      const start = new Date(`${query.date}T00:00:00.000Z`);
      const end = new Date(`${query.date}T23:59:59.999Z`);
      where.logTime = { gte: start, lte: end };
    }

    const [total, logs] = await Promise.all([
      prisma.busLog.count({ where }),
      prisma.busLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { logTime: 'desc' },
        include: {
          student: {
            select: {
              studentId: true,
              studentCode: true,
              fullNameEn: true,
              fullNameLo: true,
              photoUrl: true,
              classStudents: {
                select: { class: { select: { nameEn: true, nameLo: true } } },
              },
            },
          },
          vehicle: true,
          route: true,
        },
      }),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getLiveManifest(vehicleId?: number) {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const busStudents = await prisma.busStudent.findMany({
      where: vehicleId ? { vehicleId } : {},
      include: {
        student: {
          select: {
            studentId: true,
            studentCode: true,
            fullNameEn: true,
            fullNameLo: true,
            photoUrl: true,
            cards: { where: { status: 'active' }, select: { cardUid: true } },
          },
        },
        route: true,
        vehicle: true,
      },
    });

    const studentIds = busStudents.map((b) => b.studentId);
    const todayLogs = await prisma.busLog.findMany({
      where: {
        studentId: { in: studentIds },
        logTime: { gte: todayStart },
      },
      orderBy: { logTime: 'asc' },
    });

    const manifest = busStudents.map((bs) => {
      const logs = todayLogs.filter((l) => l.studentId === bs.studentId);
      const lastLog = logs[logs.length - 1];
      const currentlyOnboard = lastLog?.logType === 'board';

      return {
        student: bs.student,
        route: bs.route,
        vehicle: bs.vehicle,
        pickupStop: bs.pickupStop,
        dropoffStop: bs.dropoffStop,
        todayLogs: logs,
        status: currentlyOnboard ? 'onboard' : (lastLog ? 'alighted' : 'not_boarded'),
        lastLog,
      };
    });

    return {
      totalAssigned: busStudents.length,
      currentlyOnboard: manifest.filter((m) => m.status === 'onboard').length,
      completedTrip: manifest.filter((m) => m.status === 'alighted').length,
      notBoarded: manifest.filter((m) => m.status === 'not_boarded').length,
      manifest,
    };
  }
}

export default new BusRepository();
