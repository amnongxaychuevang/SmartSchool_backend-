class UpdateParentUseCase { userAdminRepository?: any; 
  parentRepository: any;
  constructor(parentRepository) {
    this.parentRepository = parentRepository;
  }

  async execute(parentId, data) {
    const {
      fullNameEn, fullNameLo, phoneNumber, isActive,
      occupation, provinceId, districtId, village, address,
      emergencyContact, nationalId,
    } = data;

    const userData: any = {};
    if (fullNameEn !== undefined) userData.fullNameEn = fullNameEn;
    if (fullNameLo !== undefined) userData.fullNameLo = fullNameLo;
    if (phoneNumber !== undefined) userData.phoneNumber = phoneNumber;
    if (isActive !== undefined) userData.isActive = isActive;

    const parentData: any = {};
    if (occupation !== undefined) parentData.occupation = occupation;
    if (provinceId !== undefined) parentData.provinceId = provinceId;
    if (districtId !== undefined) parentData.districtId = districtId;
    if (village !== undefined) parentData.village = village;
    if (address !== undefined) parentData.address = address;
    if (emergencyContact !== undefined) parentData.emergencyContact = emergencyContact || null;
    if (nationalId !== undefined) parentData.nationalId = nationalId;

    return this.parentRepository.update(parentId, userData, parentData);
  }
}

export default UpdateParentUseCase;
