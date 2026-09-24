import bcrypt from 'bcryptjs';

class UpdateTeacherUseCase { userAdminRepository?: any; 
  teacherRepository: any;
  constructor(teacherRepository) {
    this.teacherRepository = teacherRepository;
  }

  async execute(teacherId, data) {
    const {
      fullNameEn, fullNameLo, email, phoneNumber, password, isActive,
      employeeCode, specialization, qualification,
      hireDate, salary, address, notes,
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
    if (qualification !== undefined) teacherData.qualification = qualification;
    if (hireDate !== undefined) teacherData.hireDate = hireDate ? new Date(hireDate) : null;
    if (salary !== undefined) teacherData.salary = salary;
    if (address !== undefined) teacherData.address = address;
    if (notes !== undefined) teacherData.notes = notes;

    return this.teacherRepository.update(teacherId, userData, teacherData);
  }
}

export default UpdateTeacherUseCase;
