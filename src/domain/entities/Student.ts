class Student {
  studentId: number;
  studentCode: string;
  fullNameEn: string;
  fullNameLo: string;
  dateOfBirth: Date;
  gender: string;
  photoUrl: string;
  nationalityEn: string;
  nationalityLo: string;
  address: string;
  status: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;


  constructor({
    studentId,
    studentCode,
    fullNameEn,
    fullNameLo,
    dateOfBirth,
    gender,
    photoUrl,
    nationalityEn = 'Lao',
    nationalityLo = 'ລາວ',
    address,
    status = 'active',
    notes,
    createdAt,
    updatedAt,
  }) {
    this.studentId = studentId;
    this.studentCode = studentCode;
    this.fullNameEn = fullNameEn;
    this.fullNameLo = fullNameLo;
    this.dateOfBirth = dateOfBirth;
    this.gender = gender;
    this.photoUrl = photoUrl;
    this.nationalityEn = nationalityEn;
    this.nationalityLo = nationalityLo;
    this.address = address;
    this.status = status;
    this.notes = notes;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  isActive(): boolean {
    return this.status === 'active';
  }
}

export default Student;
