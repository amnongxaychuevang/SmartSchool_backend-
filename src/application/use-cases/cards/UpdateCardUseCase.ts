class UpdateCardUseCase { userAdminRepository?: any; 
  cardRepository: any;
  constructor(cardRepository) {
    this.cardRepository = cardRepository;
  }

  async execute(cardId, data) {
    const { status, expiredDate, notesEn, notesLo } = data;

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (expiredDate !== undefined) updateData.expiredDate = expiredDate ? new Date(expiredDate) : null;
    if (notesEn !== undefined) updateData.notesEn = notesEn;
    if (notesLo !== undefined) updateData.notesLo = notesLo;

    return this.cardRepository.update(cardId, updateData);
  }
}

export default UpdateCardUseCase;
