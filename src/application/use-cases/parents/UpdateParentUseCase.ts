import bcrypt from 'bcryptjs';

class UpdateParentUseCase { userAdminRepository?: any; 
  parentRepository: any;
  constructor(parentRepository) {
    this.parentRepository = parentRepository;
  }

  async execute(parentId, data) {
    const {
      fullNameEn, fullNameLo, email, phoneNumber, password, isActive,
      occupationEn, occupationLo, addressEn, addressLo,
      emergencyContact, lineId, nationalId, notesEn, notesLo,
    } = data;

    const userData: any = {};
    if (fullNameEn !== undefined) userData.fullNameEn = fullNameEn;
    if (fullNameLo !== undefined) userData.fullNameLo = fullNameLo;
    if (email !== undefined) userData.email = email || null;
    if (phoneNumber !== undefined) userData.phoneNumber = phoneNumber || null;
    if (isActive !== undefined) userData.isActive = isActive;
    if (password) userData.passwordHash = await bcrypt.hash(password, 10);

    const parentData: any = {};
    if (occupationEn !== undefined) parentData.occupationEn = occupationEn;
    if (occupationLo !== undefined) parentData.occupationLo = occupationLo;
    if (addressEn !== undefined) parentData.addressEn = addressEn;
    if (addressLo !== undefined) parentData.addressLo = addressLo;
    if (emergencyContact !== undefined) parentData.emergencyContact = emergencyContact;
    if (lineId !== undefined) parentData.lineId = lineId;
    if (nationalId !== undefined) parentData.nationalId = nationalId;
    if (notesEn !== undefined) parentData.notesEn = notesEn;
    if (notesLo !== undefined) parentData.notesLo = notesLo;

    return this.parentRepository.update(parentId, userData, parentData);
  }
}

export default UpdateParentUseCase;
