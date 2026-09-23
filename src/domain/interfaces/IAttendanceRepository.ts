export interface IAttendanceRepository {
  getLastLogToday(studentId: number): Promise<{logType: string, logTime: Date} | null>;
  create(data: {studentId: number, cardId: number, logType: string, gateLocationEn: string, gateLocationLo: string}): Promise<{logTime: Date}>;
}
