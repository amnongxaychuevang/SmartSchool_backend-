class GetMeUseCase { userAdminRepository?: any; 
  /**
   * @param {import('../../../domain/interfaces/IUserRepository')} userRepository
   */
  userRepository: any;
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  /**
   * Fetch the currently authenticated user's profile.
   * @param {number} userId - Extracted from the verified JWT by AuthMiddleware
   * @returns {Promise<Object>} Public user profile
   */
  async execute(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      userId: user.userId,
      fullNameEn: user.fullNameEn,
      fullNameLo: user.fullNameLo,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      langPref: user.langPref,
      avatarUrl: user.avatarUrl,
    };
  }
}

export default GetMeUseCase;
