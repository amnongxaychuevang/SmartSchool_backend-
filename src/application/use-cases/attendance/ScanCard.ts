class ScanCard {
  cardRepository: any;
  attendanceRepository: any;
  notificationService: any;

  constructor(cardRepository, attendanceRepository, notificationService) {
    this.cardRepository = cardRepository;
    this.attendanceRepository = attendanceRepository;
    this.notificationService = notificationService;
  }

  /**
   * Execute the scan card use case
   * @param {string} cardUid 
   * @param {string} gateLocation 
   */
  async execute(cardUid, gateLocation) {
    if (!cardUid) {
      throw new Error('Card UID is required');
    }

    // 1. Validate Card
    const card = await this.cardRepository.findByUid(cardUid);
    if (!card) {
      throw new Error('Card not found');
    }
    if (card.status !== 'active') {
      throw new Error(`Card is ${card.status}`);
    }

    // 2. Determine if Check-in or Check-out
    // Logic: Look at today's logs for this student. If they checked in but haven't checked out, it's a check out.
    // For simplicity, we assume an alternating pattern or just use a flag from the gate if available.
    const lastLog = await this.attendanceRepository.getLastLogToday(card.studentId);
    let logType = 'check_in';
    
    if (lastLog && lastLog.logType === 'check_in') {
      logType = 'check_out';
    }

    // 3. Record Attendance
    const attendanceLog = await this.attendanceRepository.create({
      studentId: card.studentId,
      cardId: card.cardId,
      logType,
      gateLocationEn: gateLocation,
      gateLocationLo: gateLocation, // could be mapped based on location ID
    });

    // 4. Notify Parent (Asynchronous)
    // We don't await this so the response is fast
    this.notificationService.notifyParentAttendance(card.studentId, logType, new Date())
      .catch(err => console.error('Failed to notify parent:', err));

    return {
      success: true,
      logType,
      studentId: card.studentId,
      time: attendanceLog.logTime
    };
  }
}

export default ScanCard;
