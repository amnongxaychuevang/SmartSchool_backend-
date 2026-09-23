class DeleteTeacherUseCase { userAdminRepository?: any; 
  teacherRepository: any;
  constructor(teacherRepository) {
    this.teacherRepository = teacherRepository;
  }

  async execute(teacherId) {
    return this.teacherRepository.delete(teacherId);
  }
}

export default DeleteTeacherUseCase;
