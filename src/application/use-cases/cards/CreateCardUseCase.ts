class CreateCardUseCase { userAdminRepository?: any; 
  cardRepository: any;
  constructor(cardRepository) {
    this.cardRepository = cardRepository;
  }

  async execute(data, userId) {
    const { cardUid, studentId, expiredDate, notesEn, notesLo } = data;

    return this.cardRepository.create({
      cardUid,
      studentId: parseInt(studentId),
      issuedBy: userId,
      ...(expiredDate ? { expiredDate: new Date(expiredDate) } : {}),
      ...(notesEn ? { notesEn } : {}),
      ...(notesLo ? { notesLo } : {}),
    });
  }
}

export default CreateCardUseCase;
