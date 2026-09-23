class DeleteCardUseCase { userAdminRepository?: any; 
  cardRepository: any;
  constructor(cardRepository) {
    this.cardRepository = cardRepository;
  }

  async execute(cardId) {
    return this.cardRepository.delete(cardId);
  }
}

export default DeleteCardUseCase;
