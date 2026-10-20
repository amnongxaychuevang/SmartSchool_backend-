class UpdateTeacherUseCase { userAdminRepository?: any; 
  teacherRepository: any;
  constructor(teacherRepository) {
    this.teacherRepository = teacherRepository;
  }

  async execute(teacherId, data) {
    const {
      fullNameEn, fullNameLo, email, phoneNumber, isActive,
      gender, specialization, qualification,
      hireDate, salary, bankName, bankAccountName, bankAccountNumber,
      provinceId, districtId, village, address, notes,
    } = data;

    const userData: any = {};
    if (fullNameEn !== undefined) userData.fullNameEn = fullNameEn;
    if (fullNameLo !== undefined) userData.fullNameLo = fullNameLo;
    if (email !== undefined) userData.email = email || null;
    if (phoneNumber !== undefined) userData.phoneNumber = phoneNumber || null;
    if (isActive !== undefined) userData.isActive = isActive;

    const teacherData: any = {};
    if (gender !== undefined) teacherData.gender = gender;
    if (specialization !== undefined) teacherData.specialization = specialization;
    if (qualification !== undefined) teacherData.qualification = qualification;
    if (hireDate !== undefined) teacherData.hireDate = hireDate ? new Date(hireDate) : null;
    if (salary !== undefined) teacherData.salary = salary;
    // Empty clears the saved value.
    if (bankName !== undefined) teacherData.bankName = bankName || null;
    if (bankAccountName !== undefined) teacherData.bankAccountName = bankAccountName || null;
    if (bankAccountNumber !== undefined) teacherData.bankAccountNumber = bankAccountNumber || null;
    if (provinceId !== undefined) teacherData.provinceId = provinceId;
    if (districtId !== undefined) teacherData.districtId = districtId;
    if (village !== undefined) teacherData.village = village;
    if (address !== undefined) teacherData.address = address;
    if (notes !== undefined) teacherData.notes = notes;

    return this.teacherRepository.update(teacherId, userData, teacherData);
  }
}

export default UpdateTeacherUseCase;
