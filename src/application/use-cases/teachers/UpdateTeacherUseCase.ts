import bcrypt from 'bcryptjs';

class UpdateTeacherUseCase { userAdminRepository?: any; 
  teacherRepository: any;
  constructor(teacherRepository) {
    this.teacherRepository = teacherRepository;
  }

  async execute(teacherId, data) {
    const {
      fullNameEn, fullNameLo, email, phoneNumber, password, isActive,
      employeeCode, specialization, qualificationEn, qualificationLo,
      hireDate, salary, addressEn, addressLo, notesEn, notesLo,
    } = data;

    const userData: any = {};
    if (fullNameEn !== undefined) userData.fullNameEn = fullNameEn;
    if (fullNameLo !== undefined) userData.fullNameLo = fullNameLo;
    if (email !== undefined) userData.email = email || null;
    if (phoneNumber !== undefined) userData.phoneNumber = phoneNumber || null;
    if (isActive !== undefined) userData.isActive = isActive;
    if (password) userData.passwordHash = await bcrypt.hash(password, 10);

    const teacherData: any = {};
    if (employeeCode !== undefined) teacherData.employeeCode = employeeCode;
    if (specialization !== undefined) teacherData.specialization = specialization;
    if (qualificationEn !== undefined) teacherData.qualificationEn = qualificationEn;
    if (qualificationLo !== undefined) teacherData.qualificationLo = qualificationLo;
    if (hireDate !== undefined) teacherData.hireDate = hireDate ? new Date(hireDate) : null;
    if (salary !== undefined) teacherData.salary = salary;
    if (addressEn !== undefined) teacherData.addressEn = addressEn;
    if (addressLo !== undefined) teacherData.addressLo = addressLo;
    if (notesEn !== undefined) teacherData.notesEn = notesEn;
    if (notesLo !== undefined) teacherData.notesLo = notesLo;

    return this.teacherRepository.update(teacherId, userData, teacherData);
  }
}

export default UpdateTeacherUseCase;
