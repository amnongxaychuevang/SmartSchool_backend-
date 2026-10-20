class CreateParentUseCase { userAdminRepository?: any;
  parentRepository: any;
  constructor(parentRepository) {
    this.parentRepository = parentRepository;
  }

  async execute(data) {
    const {
      // User fields
      fullNameEn, fullNameLo, phoneNumber, isActive,
      // Parent fields
      occupation, provinceId, districtId, village, address,
      emergencyContact, nationalId,
    } = data;

    const userData = {
      fullNameEn, fullNameLo, phoneNumber,
      passwordHash: null, // no login yet; never a shared default password
      isActive: isActive !== undefined ? isActive : true,
    };

    const parentData = {
      ...(occupation !== undefined ? { occupation } : {}),
      ...(provinceId !== undefined ? { provinceId } : {}),
      ...(districtId !== undefined ? { districtId } : {}),
      ...(village !== undefined ? { village } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(emergencyContact ? { emergencyContact } : {}),
      ...(nationalId !== undefined ? { nationalId } : {}),
    };

    return this.parentRepository.create(userData, parentData);
  }
}

export default CreateParentUseCase;
