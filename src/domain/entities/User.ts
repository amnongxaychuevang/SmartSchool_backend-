class User {
  userId: number;
  fullNameEn: string;
  fullNameLo: string;
  phoneNumber: string;
  email: string;
  passwordHash: string;
  role: string;
  langPref: string;
  avatarUrl: string;
  isActive: boolean;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;


  constructor({
    userId,
    fullNameEn,
    fullNameLo,
    phoneNumber,
    email,
    passwordHash,
    role,
    langPref = 'lo',
    avatarUrl,
    isActive = true,
    lastLogin,
    createdAt,
    updatedAt,
  }) {
    this.userId = userId;
    this.fullNameEn = fullNameEn;
    this.fullNameLo = fullNameLo;
    this.phoneNumber = phoneNumber;
    this.email = email;
    this.passwordHash = passwordHash;
    this.role = role;
    this.langPref = langPref;
    this.avatarUrl = avatarUrl;
    this.isActive = isActive;
    this.lastLogin = lastLogin;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  isAdmin(): boolean {
    return this.role === 'admin';
  }

  isTeacher(): boolean {
    return this.role === 'teacher';
  }

  isParent(): boolean {
    return this.role === 'parent';
  }

  isActiveUser(): boolean {
    return this.isActive;
  }
}

export default User;
