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
      occupation, address,
      emergencyContact, lineId, nationalId, notes,
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
      ...(occupation !== undefined ? { occupation } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(emergencyContact !== undefined ? { emergencyContact } : {}),
      ...(lineId !== undefined ? { lineId } : {}),
      ...(nationalId !== undefined ? { nationalId } : {}),
      ...(notes !== undefined ? { notes } : {}),
    };

    return this.parentRepository.create(userData, parentData);
  }
}

export default CreateParentUseCase;
