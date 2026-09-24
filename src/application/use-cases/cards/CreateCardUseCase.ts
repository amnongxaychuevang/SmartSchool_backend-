class CreateCardUseCase { userAdminRepository?: any; 
  cardRepository: any;
  constructor(cardRepository) {
    this.cardRepository = cardRepository;
  }

  async execute(data, userId) {
    const { cardUid, studentId, expiredDate, notes } = data;

    return this.cardRepository.create({
      cardUid,
      studentId: parseInt(studentId),
      issuedBy: userId,
      ...(expiredDate ? { expiredDate: new Date(expiredDate) } : {}),
      ...(notes ? { notes } : {}),
    });
  }
}

export default CreateCardUseCase;
