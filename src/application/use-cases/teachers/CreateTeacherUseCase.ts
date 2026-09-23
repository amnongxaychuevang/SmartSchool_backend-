import bcrypt from 'bcryptjs';

class CreateTeacherUseCase {
  private teacherRepository: any;

  constructor(teacherRepository: any) {
    this.teacherRepository = teacherRepository;
  }

  async execute(data) {
    const {
      // User fields
      fullNameEn, fullNameLo, email, phoneNumber, password, isActive,
      // Teacher fields
      employeeCode, specialization, qualificationEn, qualificationLo,
      hireDate, salary, addressEn, addressLo, notesEn, notesLo,
    } = data;

    const passwordHash = await bcrypt.hash(password || '123456', 10);

    const userData = {
      fullNameEn, fullNameLo,
      ...(email ? { email } : {}),
      ...(phoneNumber ? { phoneNumber } : {}),
      passwordHash,
      isActive: isActive !== undefined ? isActive : true,
    };

    const teacherData = {
      ...(employeeCode ? { employeeCode } : {}),
      ...(specialization !== undefined ? { specialization } : {}),
      ...(qualificationEn !== undefined ? { qualificationEn } : {}),
      ...(qualificationLo !== undefined ? { qualificationLo } : {}),
      ...(hireDate ? { hireDate: new Date(hireDate) } : {}),
      ...(salary !== undefined ? { salary } : {}),
      ...(addressEn !== undefined ? { addressEn } : {}),
      ...(addressLo !== undefined ? { addressLo } : {}),
      ...(notesEn !== undefined ? { notesEn } : {}),
      ...(notesLo !== undefined ? { notesLo } : {}),
    };

    return this.teacherRepository.create(userData, teacherData);
  }
}

export default CreateTeacherUseCase;
