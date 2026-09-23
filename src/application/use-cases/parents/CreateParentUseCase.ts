import bcrypt from 'bcryptjs';

class CreateParentUseCase { userAdminRepository?: any; 
  parentRepository: any;
  constructor(parentRepository) {
    this.parentRepository = parentRepository;
  }

  async execute(data) {
    const {
      // User fields
      fullNameEn, fullNameLo, email, phoneNumber, password, isActive,
      // Parent fields
      occupationEn, occupationLo, addressEn, addressLo,
      emergencyContact, lineId, nationalId, notesEn, notesLo,
    } = data;

    const passwordHash = await bcrypt.hash(password || 'password123', 10);

    const userData = {
      fullNameEn, fullNameLo,
      ...(email ? { email } : {}),
      ...(phoneNumber ? { phoneNumber } : {}),
      passwordHash,
      isActive: isActive !== undefined ? isActive : true,
    };

    const parentData = {
      ...(occupationEn !== undefined ? { occupationEn } : {}),
      ...(occupationLo !== undefined ? { occupationLo } : {}),
      ...(addressEn !== undefined ? { addressEn } : {}),
      ...(addressLo !== undefined ? { addressLo } : {}),
      ...(emergencyContact !== undefined ? { emergencyContact } : {}),
      ...(lineId !== undefined ? { lineId } : {}),
      ...(nationalId !== undefined ? { nationalId } : {}),
      ...(notesEn !== undefined ? { notesEn } : {}),
      ...(notesLo !== undefined ? { notesLo } : {}),
    };

    return this.parentRepository.create(userData, parentData);
  }
}

export default CreateParentUseCase;
