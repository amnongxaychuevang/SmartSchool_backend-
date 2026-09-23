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
  addressEn: string;
  addressLo: string;
  status: string;
  notesEn: string;
  notesLo: string;
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
    addressEn,
    addressLo,
    status = 'active',
    notesEn,
    notesLo,
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
    this.addressEn = addressEn;
    this.addressLo = addressLo;
    this.status = status;
    this.notesEn = notesEn;
    this.notesLo = notesLo;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  isActive(): boolean {
    return this.status === 'active';
  }
}

export default Student;
