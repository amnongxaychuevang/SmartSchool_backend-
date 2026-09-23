-- ============================================================
-- Smart School System — Database Schema
-- Bilingual Support: English (en) + Lao (lo)
-- Version: 2.0
-- ============================================================
-- Charset: utf8mb4 ຮອງຮັບ Unicode (ພາສາລາວ + Emoji)
-- ============================================================

CREATE DATABASE IF NOT EXISTS smart_school
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smart_school;

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. users — ບັນຊີຜູ້ໃຊ້ງານທັງໝົດ (admin, teacher, parent)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    user_id         INT PRIMARY KEY AUTO_INCREMENT,
    full_name_en    VARCHAR(150) NOT NULL COMMENT 'Full name in English',
    full_name_lo    VARCHAR(150) NOT NULL COMMENT 'ຊື່ເຕັມເປັນພາສາລາວ',
    phone_number    VARCHAR(20) UNIQUE,
    email           VARCHAR(150) UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            ENUM('admin', 'teacher', 'parent') NOT NULL,
    lang_pref       ENUM('en', 'lo') DEFAULT 'lo' COMMENT 'ພາສາທີ່ຜູ້ໃຊ້ຕ້ອງການ',
    avatar_url      VARCHAR(255),
    is_active       BOOLEAN DEFAULT TRUE,
    last_login      DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_phone    (phone_number),
    INDEX idx_email    (email),
    INDEX idx_role     (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ບັນຊີຜູ້ໃຊ້ງານທັງໝົດ | All system user accounts';


-- ============================================================
-- 2. classes — ຫ້ອງຮຽນ
-- ============================================================
CREATE TABLE IF NOT EXISTS classes (
    class_id            INT PRIMARY KEY AUTO_INCREMENT,
    class_name_en       VARCHAR(50) NOT NULL COMMENT 'Class name in English e.g. Grade 3/1',
    class_name_lo       VARCHAR(50) NOT NULL COMMENT 'ຊື່ຫ້ອງໃນລາວ ເຊັ່ນ: ມໍ 3/1',
    grade_level_en      VARCHAR(20) COMMENT 'e.g. Grade 7',
    grade_level_lo      VARCHAR(20) COMMENT 'ຕົວຢ່າງ: ມໍຕົ້ນ 1',
    homeroom_teacher_id INT COMMENT 'ອາຈານປະຈຳຫ້ອງ',
    academic_year       VARCHAR(9) NOT NULL COMMENT 'ສົກຮຽນ e.g. 2026-2027',
    description_en      TEXT COMMENT 'Optional class description (English)',
    description_lo      TEXT COMMENT 'ລາຍລະອຽດຫ້ອງ (ລາວ)',
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (homeroom_teacher_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_academic_year (academic_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ຂໍ້ມູນຫ້ອງຮຽນ | Class information';


-- ============================================================
-- 3. students — ຂໍ້ມູນນັກຮຽນ
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
    student_id      INT PRIMARY KEY AUTO_INCREMENT,
    student_code    VARCHAR(20) UNIQUE NOT NULL COMMENT 'ລະຫັດນັກຮຽນ | Student ID number',
    full_name_en    VARCHAR(150) NOT NULL COMMENT 'Full name in English',
    full_name_lo    VARCHAR(150) NOT NULL COMMENT 'ຊື່ເຕັມພາສາລາວ',
    date_of_birth   DATE,
    gender          ENUM('male', 'female', 'other'),
    photo_url       VARCHAR(255),
    nationality_en  VARCHAR(50) DEFAULT 'Lao' COMMENT 'Nationality (English)',
    nationality_lo  VARCHAR(50) DEFAULT 'ລາວ' COMMENT 'ສັນຊາດ (ລາວ)',
    address_en      TEXT COMMENT 'Home address (English)',
    address_lo      TEXT COMMENT 'ທີ່ຢູ່ (ລາວ)',
    status          ENUM('active', 'graduated', 'transferred') DEFAULT 'active',
    notes_en        TEXT COMMENT 'Admin notes (English)',
    notes_lo        TEXT COMMENT 'ບັນທຶກຂອງ Admin (ລາວ)',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_student_code (student_code),
    INDEX idx_status       (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ຂໍ້ມູນນັກຮຽນ | Student profiles';


-- ============================================================
-- 4. class_students — ນັກຮຽນໃນແຕ່ລະຫ້ອງ
-- ============================================================
CREATE TABLE IF NOT EXISTS class_students (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    class_id        INT NOT NULL,
    student_id      INT NOT NULL,
    enrolled_at     DATE DEFAULT (CURRENT_DATE),

    FOREIGN KEY (class_id)   REFERENCES classes(class_id)   ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    UNIQUE KEY uq_class_student (class_id, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ນັກຮຽນ ↔ ຫ້ອງຮຽນ | Student-Class enrollment';


-- ============================================================
-- 5. parent_student — ຜູ້ປົກຄອງ ↔ ນັກຮຽນ
-- ============================================================
CREATE TABLE IF NOT EXISTS parent_student (
    id                  INT PRIMARY KEY AUTO_INCREMENT,
    parent_user_id      INT NOT NULL,
    student_id          INT NOT NULL,
    relationship_en     ENUM('father', 'mother', 'guardian', 'other') DEFAULT 'guardian',
    relationship_lo     VARCHAR(50) DEFAULT 'ຜູ້ປົກຄອງ' COMMENT 'ຄວາມສຳພັນ ເຊັ່ນ: ພໍ່, ແມ່, ຜູ້ປົກຄອງ',
    is_primary_contact  BOOLEAN DEFAULT TRUE,

    FOREIGN KEY (parent_user_id) REFERENCES users(user_id)     ON DELETE CASCADE,
    FOREIGN KEY (student_id)     REFERENCES students(student_id) ON DELETE CASCADE,
    UNIQUE KEY uq_parent_student (parent_user_id, student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ຜູ້ປົກຄອງ ↔ ນັກຮຽນ | Parent-Student relationship';


-- ============================================================
-- 6. cards — ບັດ RFID/NFC
-- ============================================================
CREATE TABLE IF NOT EXISTS cards (
    card_id         INT PRIMARY KEY AUTO_INCREMENT,
    card_uid        VARCHAR(50) UNIQUE NOT NULL COMMENT 'ລະຫັດຊິບໃນບັດ | RFID chip UID',
    student_id      INT NOT NULL,
    issued_date     DATE DEFAULT (CURRENT_DATE),
    expired_date    DATE,
    status          ENUM('active', 'lost', 'deactivated') DEFAULT 'active',
    notes_en        VARCHAR(255),
    notes_lo        VARCHAR(255),
    issued_by       INT COMMENT 'admin user_id who issued the card',

    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (issued_by)  REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_card_uid  (card_uid),
    INDEX idx_status    (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ບັດ RFID/NFC | Student RFID/NFC cards';


-- ============================================================
-- 7. attendance_logs — Check-in / Check-out
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_logs (
    log_id              INT PRIMARY KEY AUTO_INCREMENT,
    student_id          INT NOT NULL,
    card_id             INT,
    log_type            ENUM('check_in', 'check_out') NOT NULL,
    log_time            DATETIME DEFAULT CURRENT_TIMESTAMP,
    gate_location_en    VARCHAR(50) COMMENT 'Gate location (English) e.g. Main Gate',
    gate_location_lo    VARCHAR(50) COMMENT 'ຈຸດຕິດຕັ້ງ (ລາວ) ຕົວຢ່າງ: ປະຕູໃຫຍ່',
    is_manual_entry     BOOLEAN DEFAULT FALSE COMMENT 'Admin ໃສ່ດ້ວຍມືບໍ່',
    manual_entry_by     INT COMMENT 'user_id of admin who manually entered',
    notified            BOOLEAN DEFAULT FALSE,
    remark_en           VARCHAR(255) COMMENT 'Optional remark (English)',
    remark_lo           VARCHAR(255) COMMENT 'ໝາຍເຫດ (ລາວ)',

    FOREIGN KEY (student_id)      REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (card_id)         REFERENCES cards(card_id) ON DELETE SET NULL,
    FOREIGN KEY (manual_entry_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_student_date (student_id, log_time),
    INDEX idx_log_type     (log_type),
    INDEX idx_log_time     (log_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ບັນທຶກ Check-in/Check-out | Attendance records';


-- ============================================================
-- 8. subjects — ວິຊາຮຽນ
-- ============================================================
CREATE TABLE IF NOT EXISTS subjects (
    subject_id      INT PRIMARY KEY AUTO_INCREMENT,
    subject_name_en VARCHAR(100) NOT NULL COMMENT 'Subject name in English e.g. Mathematics',
    subject_name_lo VARCHAR(100) NOT NULL COMMENT 'ຊື່ວິຊາລາວ ຕົວຢ່າງ: ຄະນິດສາດ',
    subject_code    VARCHAR(20) UNIQUE COMMENT 'ລະຫັດວິຊາ e.g. MATH-01',
    description_en  TEXT,
    description_lo  TEXT,
    teacher_id      INT COMMENT 'ອາຈານຮັບຜິດຊອບ',
    class_id        INT,
    credits         DECIMAL(3,1) DEFAULT 1.0,
    is_active       BOOLEAN DEFAULT TRUE,

    FOREIGN KEY (teacher_id) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (class_id)   REFERENCES classes(class_id) ON DELETE SET NULL,
    INDEX idx_teacher (teacher_id),
    INDEX idx_class   (class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ວິຊາຮຽນ | School subjects';


-- ============================================================
-- 9. grade_types — ປະເພດຄະແນນ (ທົດສອບ, ການບ້ານ, ສອບເສັງ...)
-- ============================================================
CREATE TABLE IF NOT EXISTS grade_types (
    type_id         INT PRIMARY KEY AUTO_INCREMENT,
    type_name_en    VARCHAR(100) NOT NULL COMMENT 'e.g. Mid-term Exam, Homework, Final Exam',
    type_name_lo    VARCHAR(100) NOT NULL COMMENT 'ຕົວຢ່າງ: ສອບເສັງກາງພາກ, ການບ້ານ, ສອບເສັງສຸດພາກ',
    weight_percent  DECIMAL(5,2) DEFAULT 100.00 COMMENT 'ນ້ຳໜັກ % ຂອງຄະແນນລວມ',
    description_en  TEXT,
    description_lo  TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ປະເພດຄະແນນ | Grade/assessment categories';


-- ============================================================
-- 10. grades — ຄະແນນນັກຮຽນ
-- ============================================================
CREATE TABLE IF NOT EXISTS grades (
    grade_id        INT PRIMARY KEY AUTO_INCREMENT,
    student_id      INT NOT NULL,
    subject_id      INT NOT NULL,
    teacher_id      INT NOT NULL,
    grade_type_id   INT COMMENT 'ອ້າງອີງ grade_types',
    score           DECIMAL(5,2),
    max_score       DECIMAL(5,2) DEFAULT 100,
    grade_month     VARCHAR(7)   COMMENT 'ສົກຮຽນ ຕົວຢ່າງ: 2026-07',
    remarks_en      TEXT COMMENT 'Teacher remarks in English',
    remarks_lo      TEXT COMMENT 'ຄຳເຫັນຂອງອາຈານ (ລາວ)',
    is_published    BOOLEAN DEFAULT FALSE COMMENT 'ຜູ້ປົກຄອງເຫັນໄດ້ບໍ',
    recorded_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id)    REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id)    REFERENCES subjects(subject_id)  ON DELETE CASCADE,
    FOREIGN KEY (teacher_id)    REFERENCES users(user_id)        ON DELETE RESTRICT,
    FOREIGN KEY (grade_type_id) REFERENCES grade_types(type_id)  ON DELETE SET NULL,
    INDEX idx_student_month (student_id, grade_month),
    INDEX idx_subject       (subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ຄະແນນນັກຮຽນ | Student grades';


-- ============================================================
-- 11. shops — ຮ້ານຄ້າໃນໂຮງຮຽນ
-- ============================================================
CREATE TABLE IF NOT EXISTS shops (
    shop_id         INT PRIMARY KEY AUTO_INCREMENT,
    shop_name_en    VARCHAR(100) NOT NULL COMMENT 'Shop name in English e.g. Cafeteria',
    shop_name_lo    VARCHAR(100) NOT NULL COMMENT 'ຊື່ຮ້ານລາວ ຕົວຢ່າງ: ໂຮງອາຫານ',
    location_en     VARCHAR(100) COMMENT 'Location description (English)',
    location_lo     VARCHAR(100) COMMENT 'ທີ່ຕັ້ງ (ລາວ)',
    description_en  TEXT,
    description_lo  TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ຮ້ານຄ້າໃນໂຮງຮຽນ | In-school shops';


-- ============================================================
-- 12. wallet_accounts — ບັນຊີເງິນຂອງນັກຮຽນ
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_accounts (
    wallet_id       INT PRIMARY KEY AUTO_INCREMENT,
    student_id      INT UNIQUE NOT NULL,
    balance         DECIMAL(10,2) DEFAULT 0.00,
    daily_limit     DECIMAL(10,2) DEFAULT NULL COMMENT 'ຈຳກັດຍອດໃຊ້ຈ່າຍຕໍ່ມື້',
    status          ENUM('active', 'frozen') DEFAULT 'active',
    currency_code   VARCHAR(3) DEFAULT 'LAK' COMMENT 'LAK = ກີບລາວ, THB, USD',
    notes_en        VARCHAR(255),
    notes_lo        VARCHAR(255),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ບັນຊີ E-Wallet ຂອງນັກຮຽນ | Student e-wallet accounts';


-- ============================================================
-- 13. wallet_transactions — ປະຫວັດທຸລະກຳ (Append-only, ຫ້າມ DELETE)
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
    transaction_id      INT PRIMARY KEY AUTO_INCREMENT,
    wallet_id           INT NOT NULL,
    shop_id             INT COMMENT 'NULL ຖ້າເປັນການເຕີມເງິນ ຫຼືຄືນເງິນ',
    transaction_type    ENUM('top_up', 'purchase', 'refund') NOT NULL,
    amount              DECIMAL(10,2) NOT NULL,
    balance_before      DECIMAL(10,2) NOT NULL COMMENT 'ຍອດກ່ອນທຸລະກຳ',
    balance_after       DECIMAL(10,2) NOT NULL COMMENT 'ຍອດຫຼັງທຸລະກຳ',
    description_en      VARCHAR(255) COMMENT 'Transaction description (English)',
    description_lo      VARCHAR(255) COMMENT 'ລາຍລະອຽດທຸລະກຳ (ລາວ)',
    reference_no        VARCHAR(50) UNIQUE COMMENT 'ເລກອ້າງອີງທຸລະກຳ',
    processed_by        INT COMMENT 'user_id ຜູ້ດຳເນີນການ (admin/shop)',
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (wallet_id) REFERENCES wallet_accounts(wallet_id),
    FOREIGN KEY (shop_id)   REFERENCES shops(shop_id) ON DELETE SET NULL,
    FOREIGN KEY (processed_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_wallet_date (wallet_id, created_at),
    INDEX idx_type        (transaction_type),
    INDEX idx_ref_no      (reference_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ປະຫວັດທຸລະກຳ E-Wallet | Wallet transaction history (append-only)';


-- ============================================================
-- 14. top_up_requests — ຄຳຂໍເຕີມເງິນ
-- ============================================================
CREATE TABLE IF NOT EXISTS top_up_requests (
    request_id      INT PRIMARY KEY AUTO_INCREMENT,
    student_id      INT NOT NULL,
    parent_user_id  INT NOT NULL,
    amount          DECIMAL(10,2) NOT NULL,
    method          ENUM('cash', 'mobile_banking', 'admin_manual') NOT NULL,
    method_label_en VARCHAR(100) COMMENT 'e.g. BCEL One, LDB Mobile',
    method_label_lo VARCHAR(100) COMMENT 'ຕົວຢ່າງ: BCEL ວັນ, LDB ໂມບາຍ',
    status          ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    approved_by     INT COMMENT 'admin user_id',
    reject_reason_en TEXT,
    reject_reason_lo TEXT,
    slip_url        VARCHAR(255) COMMENT 'ໄຟລ໌ slip ການໂອນ',
    requested_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at    DATETIME,

    FOREIGN KEY (student_id)     REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (parent_user_id) REFERENCES users(user_id)       ON DELETE CASCADE,
    FOREIGN KEY (approved_by)    REFERENCES users(user_id)       ON DELETE SET NULL,
    INDEX idx_status      (status),
    INDEX idx_student     (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ຄຳຂໍເຕີມເງິນ | Top-up requests';


-- ============================================================
-- 15. notifications — ບັນທຶກການແຈ້ງເຕືອນ
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    notification_id     INT PRIMARY KEY AUTO_INCREMENT,
    recipient_user_id   INT NOT NULL,
    student_id          INT,
    type                ENUM('check_in','check_out','absence','grade','transaction','general') NOT NULL,
    channel             ENUM('sms','line','telegram','app_push','email') NOT NULL,
    message_en          TEXT NOT NULL COMMENT 'Notification message in English',
    message_lo          TEXT NOT NULL COMMENT 'ຂໍ້ຄວາມແຈ້ງເຕືອນ (ລາວ)',
    sent_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
    delivered_at        DATETIME COMMENT 'ເວລາສົ່ງສຳເລັດ',
    status              ENUM('sent','failed','pending') DEFAULT 'pending',
    error_message       TEXT COMMENT 'Error detail if failed',

    FOREIGN KEY (recipient_user_id) REFERENCES users(user_id)     ON DELETE CASCADE,
    FOREIGN KEY (student_id)        REFERENCES students(student_id) ON DELETE SET NULL,
    INDEX idx_recipient (recipient_user_id),
    INDEX idx_type      (type),
    INDEX idx_status    (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ປະຫວັດການແຈ້ງເຕືອນ | Notification history';


-- ============================================================
-- 16. spending_limits — ຂອບເຂດການໃຊ້ຈ່າຍ (ຜູ້ປົກຄອງຕັ້ງ)
-- ============================================================
CREATE TABLE IF NOT EXISTS spending_limits (
    limit_id            INT PRIMARY KEY AUTO_INCREMENT,
    student_id          INT UNIQUE NOT NULL,
    daily_max           DECIMAL(10,2) COMMENT 'ວົງເງິນໃຊ້ຈ່າຍຕໍ່ວັນ',
    weekly_max          DECIMAL(10,2) COMMENT 'ວົງເງິນໃຊ້ຈ່າຍຕໍ່ອາທິດ',
    per_transaction_max DECIMAL(10,2) COMMENT 'ວົງເງິນຕໍ່ 1 ທຸລະກຳ',
    blocked_shops       JSON COMMENT 'Array of blocked shop_ids e.g. [1, 3]',
    alert_threshold     DECIMAL(10,2) COMMENT 'ແຈ້ງເຕືອນເມື່ອຍອດຕ່ຳກວ່ານີ້',
    notes_en            VARCHAR(255),
    notes_lo            VARCHAR(255),
    set_by              INT NOT NULL COMMENT 'parent user_id',
    updated_at          DATETIME ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (set_by)     REFERENCES users(user_id)       ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ຂອບເຂດການໃຊ້ຈ່າຍ | Parent-controlled spending limits';


-- ============================================================
-- 17. i18n_messages — ຂໍ້ຄວາມ Template ສຳລັບແຈ້ງເຕືອນ 2 ພາສາ
-- ============================================================
CREATE TABLE IF NOT EXISTS i18n_messages (
    message_key     VARCHAR(100) PRIMARY KEY COMMENT 'e.g. notify.check_in, notify.absence',
    message_en      TEXT NOT NULL COMMENT 'Template in English (supports {{variables}})',
    message_lo      TEXT NOT NULL COMMENT 'Template in Lao (ຮອງຮັບ {{ຕົວແປ}})',
    description     VARCHAR(255) COMMENT 'Admin note about this message',
    updated_at      DATETIME ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ຂໍ້ຄວາມ template 2 ພາສາ | Bilingual notification message templates';


SET FOREIGN_KEY_CHECKS = 1;
