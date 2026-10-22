import dispatcher from '../../../infrastructure/notifications/NotificationDispatcher';

class ScanCard {
  cardRepository: any;
  attendanceRepository: any;
  dailyAttendanceRepository: any;

  constructor(cardRepository, attendanceRepository, dailyAttendanceRepository) {
    this.cardRepository = cardRepository;
    this.attendanceRepository = attendanceRepository;
    this.dailyAttendanceRepository = dailyAttendanceRepository;
  }

  async execute(cardUid, gateLocation) {
    if (!cardUid) {
      throw new Error('Card UID is required');
    }

    const card = await this.cardRepository.findByUid(cardUid);
    if (!card) {
      throw Object.assign(new Error('Card not found'), { statusCode: 404 });
    }
    if (card.status !== 'active') {
      throw Object.assign(new Error(`Card is ${card.status}`), { statusCode: 409 });
    }

    const lastLog = await this.attendanceRepository.getLastLogToday(card.studentId);
    let logType = 'check_in';

    if (lastLog && lastLog.logType === 'check_in') {
      logType = 'check_out';
    }

    const attendanceLog = await this.attendanceRepository.create({
      studentId: card.studentId,
      cardId: card.cardId,
      logType,
      gateLocationEn: gateLocation,
      gateLocationLo: gateLocation,
    });

    if (logType === 'check_in') {
      await this.dailyAttendanceRepository.recordCheckIn(card.studentId, attendanceLog.logTime);
    }

    const timeStr = new Date(attendanceLog.logTime).toLocaleString('en-GB', {
      timeZone: 'Asia/Vientiane',
      hour: '2-digit',
      minute: '2-digit',
    });
    const student = card.student;
    const nameEn = student?.fullNameEn || `Student #${card.studentId}`;
    const nameLo = student?.fullNameLo || nameEn;
    const actionEn = logType === 'check_in' ? 'arrived at school' : 'left school';
    const actionLo = logType === 'check_in' ? 'ມາຮອດໂຮງຮຽນ' : 'ອອກຈາກໂຮງຮຽນ';

    dispatcher.notifyParents(
      card.studentId,
      logType as any,
      `${nameEn} ${actionEn} at ${timeStr}.`,
      `${nameLo} ${actionLo} ເວລາ ${timeStr}.`,
    ).catch(err => console.error('Failed to notify parents:', err));

    return {
      success: true,
      logType,
      studentId: card.studentId,
      cardUid,
      time: attendanceLog.logTime,
      student: student ? {
        fullNameLo: student.fullNameLo,
        fullNameEn: student.fullNameEn,
        studentCode: student.studentCode,
        photoUrl: student.photoUrl,
        class: student.classStudents?.[0]?.class ?? null,
      } : null,
    };
  }
}

export default ScanCard;
