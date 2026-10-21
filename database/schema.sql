-- GENERATED from prisma/schema.prisma — do not edit by hand.
-- Regenerate with: npm run db:sql

-- CreateTable
CREATE TABLE `roles` (
    `role_id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name_en` VARCHAR(100) NOT NULL,
    `name_lo` VARCHAR(100) NOT NULL,
    `portal` ENUM('admin', 'teacher', 'parent') NOT NULL DEFAULT 'admin',
    `is_system` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `roles_code_key`(`code`),
    PRIMARY KEY (`role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `role_id` INTEGER NOT NULL,
    `permission` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`role_id`, `permission`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `full_name_en` VARCHAR(150) NOT NULL,
    `full_name_lo` VARCHAR(150) NOT NULL,
    `phone_number` VARCHAR(20) NULL,
    `email` VARCHAR(150) NULL,
    `password_hash` VARCHAR(255) NULL,
    `role_id` INTEGER NOT NULL,
    `lang_pref` ENUM('en', 'lo') NOT NULL DEFAULT 'lo',
    `avatar_url` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_login` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_phone_number_key`(`phone_number`),
    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_role_id_idx`(`role_id`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `token_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `user_agent` VARCHAR(255) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    INDEX `refresh_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`token_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_codes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `code_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `password_reset_codes_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `audit_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `action` ENUM('login', 'login_failed', 'logout', 'create', 'update', 'delete', 'approve', 'reject', 'status_change') NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` VARCHAR(50) NULL,
    `detail` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_user_id_idx`(`user_id`),
    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`audit_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teachers` (
    `teacher_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `employee_code` VARCHAR(20) NOT NULL,
    `gender` ENUM('male', 'female', 'other') NULL,
    `specialization` VARCHAR(100) NULL,
    `qualification` VARCHAR(150) NULL,
    `hire_date` DATE NULL,
    `salary` DECIMAL(12, 2) NULL,
    `bank_name` VARCHAR(100) NULL,
    `bank_account_name` VARCHAR(150) NULL,
    `bank_account_number` VARCHAR(30) NULL,
    `province_id` INTEGER NULL,
    `district_id` INTEGER NULL,
    `village` VARCHAR(100) NULL,
    `address` TEXT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `teachers_user_id_key`(`user_id`),
    UNIQUE INDEX `teachers_employee_code_key`(`employee_code`),
    PRIMARY KEY (`teacher_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parents` (
    `parent_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `occupation` VARCHAR(150) NULL,
    `province_id` INTEGER NULL,
    `district_id` INTEGER NULL,
    `village` VARCHAR(100) NULL,
    `address` TEXT NULL,
    `emergency_contact` VARCHAR(20) NULL,
    `national_id` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `parents_user_id_key`(`user_id`),
    PRIMARY KEY (`parent_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `classes` (
    `class_id` INTEGER NOT NULL AUTO_INCREMENT,
    `class_name_en` VARCHAR(50) NOT NULL,
    `class_name_lo` VARCHAR(50) NOT NULL,
    `grade_level_en` VARCHAR(20) NULL,
    `grade_level_lo` VARCHAR(20) NULL,
    `homeroom_teacher_id` INTEGER NULL,
    `academic_year` VARCHAR(9) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `classes_academic_year_idx`(`academic_year`),
    PRIMARY KEY (`class_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `student_id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_code` VARCHAR(20) NOT NULL,
    `full_name_en` VARCHAR(150) NOT NULL,
    `full_name_lo` VARCHAR(150) NOT NULL,
    `date_of_birth` DATE NULL,
    `gender` ENUM('male', 'female', 'other') NULL,
    `photo_url` VARCHAR(255) NULL,
    `nationality_en` VARCHAR(50) NOT NULL DEFAULT 'Lao',
    `nationality_lo` VARCHAR(50) NOT NULL DEFAULT 'ລາວ',
    `village` VARCHAR(100) NULL,
    `province_id` INTEGER NULL,
    `district_id` INTEGER NULL,
    `address` TEXT NULL,
    `ethnicity_id` INTEGER NULL,
    `birth_place` VARCHAR(150) NULL,
    `previous_school` VARCHAR(150) NULL,
    `blood_type` VARCHAR(5) NULL,
    `medical_notes` TEXT NULL,
    `status` ENUM('active', 'inactive', 'graduated', 'transferred') NOT NULL DEFAULT 'active',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `students_student_code_key`(`student_code`),
    INDEX `students_status_idx`(`status`),
    PRIMARY KEY (`student_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ethnicities` (
    `ethnicity_id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(30) NOT NULL,
    `name_lo` VARCHAR(100) NOT NULL,
    `name_en` VARCHAR(100) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `ethnicities_code_key`(`code`),
    PRIMARY KEY (`ethnicity_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teacher_documents` (
    `document_id` INTEGER NOT NULL AUTO_INCREMENT,
    `teacher_id` INTEGER NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `stored_name` VARCHAR(100) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `uploaded_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `teacher_documents_stored_name_key`(`stored_name`),
    INDEX `teacher_documents_teacher_id_idx`(`teacher_id`),
    PRIMARY KEY (`document_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provinces` (
    `province_id` INTEGER NOT NULL,
    `name_lo` VARCHAR(100) NOT NULL,
    `name_en` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    PRIMARY KEY (`province_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `districts` (
    `district_id` INTEGER NOT NULL,
    `province_id` INTEGER NOT NULL,
    `name_lo` VARCHAR(100) NOT NULL,
    `name_en` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    INDEX `districts_province_id_idx`(`province_id`),
    PRIMARY KEY (`district_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `class_students` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `class_id` INTEGER NOT NULL,
    `student_id` INTEGER NOT NULL,
    `enrolled_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `left_at` DATETIME(3) NULL,

    UNIQUE INDEX `class_students_class_id_student_id_key`(`class_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parent_student` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `parent_user_id` INTEGER NOT NULL,
    `student_id` INTEGER NOT NULL,
    `relationship` ENUM('father', 'mother', 'guardian', 'grandparent', 'sibling', 'uncle_aunt', 'other') NOT NULL DEFAULT 'guardian',
    `is_primary_contact` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `parent_student_parent_user_id_student_id_key`(`parent_user_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cards` (
    `card_id` INTEGER NOT NULL AUTO_INCREMENT,
    `card_uid` VARCHAR(50) NOT NULL,
    `student_id` INTEGER NOT NULL,
    `issued_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expired_date` DATE NULL,
    `status` ENUM('active', 'lost', 'deactivated') NOT NULL DEFAULT 'active',
    `notes` VARCHAR(255) NULL,
    `issued_by` INTEGER NULL,

    UNIQUE INDEX `cards_card_uid_key`(`card_uid`),
    INDEX `cards_status_idx`(`status`),
    PRIMARY KEY (`card_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_logs` (
    `log_id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `card_id` INTEGER NULL,
    `log_type` ENUM('check_in', 'check_out') NOT NULL,
    `log_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `gate_location_en` VARCHAR(50) NULL,
    `gate_location_lo` VARCHAR(50) NULL,
    `is_manual_entry` BOOLEAN NOT NULL DEFAULT false,
    `manual_entry_by` INTEGER NULL,
    `notified` BOOLEAN NOT NULL DEFAULT false,
    `remark` VARCHAR(255) NULL,

    INDEX `attendance_logs_student_id_log_time_idx`(`student_id`, `log_time`),
    INDEX `attendance_logs_log_type_idx`(`log_type`),
    INDEX `attendance_logs_log_time_idx`(`log_time`),
    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_attendance` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `status` ENUM('present', 'absent', 'late', 'excused') NOT NULL,
    `source` ENUM('card', 'auto', 'teacher', 'leave') NOT NULL,
    `first_check_in` DATETIME(3) NULL,
    `note` VARCHAR(255) NULL,
    `recorded_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `daily_attendance_date_status_idx`(`date`, `status`),
    UNIQUE INDEX `daily_attendance_student_id_date_key`(`student_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subjects` (
    `subject_id` INTEGER NOT NULL AUTO_INCREMENT,
    `subject_name_en` VARCHAR(100) NOT NULL,
    `subject_name_lo` VARCHAR(100) NOT NULL,
    `subject_code` VARCHAR(20) NULL,
    `description_en` TEXT NULL,
    `description_lo` TEXT NULL,
    `credits` DECIMAL(3, 1) NOT NULL DEFAULT 1.0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `subjects_subject_code_key`(`subject_code`),
    PRIMARY KEY (`subject_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `class_subjects` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `class_id` INTEGER NOT NULL,
    `subject_id` INTEGER NOT NULL,
    `teacher_id` INTEGER NULL,
    `term_id` INTEGER NOT NULL,

    INDEX `class_subjects_teacher_id_idx`(`teacher_id`),
    INDEX `class_subjects_term_id_idx`(`term_id`),
    UNIQUE INDEX `class_subjects_class_id_subject_id_term_id_key`(`class_id`, `subject_id`, `term_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grade_types` (
    `type_id` INTEGER NOT NULL AUTO_INCREMENT,
    `type_name_en` VARCHAR(100) NOT NULL,
    `type_name_lo` VARCHAR(100) NOT NULL,
    `weight_percent` DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
    `description_en` TEXT NULL,
    `description_lo` TEXT NULL,

    PRIMARY KEY (`type_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grades` (
    `grade_id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `class_subject_id` INTEGER NOT NULL,
    `teacher_id` INTEGER NOT NULL,
    `grade_type_id` INTEGER NULL,
    `score` DECIMAL(5, 2) NULL,
    `max_score` DECIMAL(5, 2) NOT NULL DEFAULT 100,
    `grade_month` VARCHAR(7) NULL,
    `remarks` TEXT NULL,
    `is_published` BOOLEAN NOT NULL DEFAULT false,
    `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    INDEX `grades_student_id_grade_month_idx`(`student_id`, `grade_month`),
    INDEX `grades_class_subject_id_idx`(`class_subject_id`),
    PRIMARY KEY (`grade_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shops` (
    `shop_id` INTEGER NOT NULL AUTO_INCREMENT,
    `shop_name_en` VARCHAR(100) NOT NULL,
    `shop_name_lo` VARCHAR(100) NOT NULL,
    `location_en` VARCHAR(100) NULL,
    `location_lo` VARCHAR(100) NULL,
    `description_en` TEXT NULL,
    `description_lo` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`shop_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallet_accounts` (
    `wallet_id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `balance` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `status` ENUM('active', 'frozen') NOT NULL DEFAULT 'active',
    `currency_code` VARCHAR(3) NOT NULL DEFAULT 'LAK',
    `notes` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `wallet_accounts_student_id_key`(`student_id`),
    PRIMARY KEY (`wallet_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallet_transactions` (
    `transaction_id` INTEGER NOT NULL AUTO_INCREMENT,
    `wallet_id` INTEGER NOT NULL,
    `shop_id` INTEGER NULL,
    `transaction_type` ENUM('top_up', 'purchase', 'refund') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `balance_before` DECIMAL(10, 2) NOT NULL,
    `balance_after` DECIMAL(10, 2) NOT NULL,
    `description_en` VARCHAR(255) NULL,
    `description_lo` VARCHAR(255) NULL,
    `reference_no` VARCHAR(50) NULL,
    `processed_by` INTEGER NULL,
    `refund_of_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `wallet_transactions_reference_no_key`(`reference_no`),
    UNIQUE INDEX `wallet_transactions_refund_of_id_key`(`refund_of_id`),
    INDEX `wallet_transactions_wallet_id_created_at_idx`(`wallet_id`, `created_at`),
    INDEX `wallet_transactions_transaction_type_idx`(`transaction_type`),
    PRIMARY KEY (`transaction_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `top_up_requests` (
    `request_id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `parent_user_id` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `method` ENUM('cash', 'mobile_banking', 'admin_manual') NOT NULL,
    `method_label_en` VARCHAR(100) NULL,
    `method_label_lo` VARCHAR(100) NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `approved_by` INTEGER NULL,
    `reject_reason` TEXT NULL,
    `slip_url` VARCHAR(255) NULL,
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,
    `transaction_id` INTEGER NULL,

    UNIQUE INDEX `top_up_requests_transaction_id_key`(`transaction_id`),
    INDEX `top_up_requests_status_idx`(`status`),
    INDEX `top_up_requests_student_id_idx`(`student_id`),
    PRIMARY KEY (`request_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `notification_id` INTEGER NOT NULL AUTO_INCREMENT,
    `recipient_user_id` INTEGER NOT NULL,
    `student_id` INTEGER NULL,
    `type` ENUM('check_in', 'check_out', 'absence', 'grade', 'transaction', 'general', 'fee', 'behavior', 'transport', 'library', 'at_risk') NOT NULL,
    `channel` ENUM('whatsapp', 'app_push', 'email') NOT NULL,
    `message_en` TEXT NOT NULL,
    `message_lo` TEXT NOT NULL,
    `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `delivered_at` DATETIME(3) NULL,
    `status` ENUM('sent', 'failed', 'pending') NOT NULL DEFAULT 'pending',
    `error_message` TEXT NULL,

    INDEX `notifications_recipient_user_id_idx`(`recipient_user_id`),
    INDEX `notifications_type_idx`(`type`),
    INDEX `notifications_status_idx`(`status`),
    PRIMARY KEY (`notification_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `spending_limits` (
    `limit_id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `daily_max` DECIMAL(10, 2) NULL,
    `weekly_max` DECIMAL(10, 2) NULL,
    `per_transaction_max` DECIMAL(10, 2) NULL,
    `alert_threshold` DECIMAL(10, 2) NULL,
    `notes` VARCHAR(255) NULL,
    `set_by` INTEGER NOT NULL,
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `spending_limits_student_id_key`(`student_id`),
    PRIMARY KEY (`limit_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blocked_shops` (
    `student_id` INTEGER NOT NULL,
    `shop_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `blocked_shops_shop_id_idx`(`shop_id`),
    PRIMARY KEY (`student_id`, `shop_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `i18n_messages` (
    `message_key` VARCHAR(100) NOT NULL,
    `message_en` TEXT NOT NULL,
    `message_lo` TEXT NOT NULL,
    `description` VARCHAR(255) NULL,
    `updated_at` DATETIME(3) NULL,

    PRIMARY KEY (`message_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `academic_terms` (
    `term_id` INTEGER NOT NULL AUTO_INCREMENT,
    `academic_year` VARCHAR(9) NOT NULL,
    `term_name_en` VARCHAR(50) NOT NULL,
    `term_name_lo` VARCHAR(50) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `status` ENUM('active', 'upcoming', 'completed') NOT NULL DEFAULT 'upcoming',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`term_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedules` (
    `schedule_id` INTEGER NOT NULL AUTO_INCREMENT,
    `class_subject_id` INTEGER NOT NULL,
    `day_of_week` INTEGER NOT NULL,
    `start_time` TIME NOT NULL,
    `end_time` TIME NOT NULL,
    `room_number` VARCHAR(50) NULL,

    INDEX `schedules_class_subject_id_day_of_week_idx`(`class_subject_id`, `day_of_week`),
    PRIMARY KEY (`schedule_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_requests` (
    `leave_id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `parent_user_id` INTEGER NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `reason` TEXT NULL,
    `document_url` VARCHAR(255) NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `approved_by` INTEGER NULL,
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,

    INDEX `leave_requests_student_id_idx`(`student_id`),
    INDEX `leave_requests_status_idx`(`status`),
    PRIMARY KEY (`leave_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `school_events` (
    `event_id` INTEGER NOT NULL AUTO_INCREMENT,
    `title_en` VARCHAR(150) NOT NULL,
    `title_lo` VARCHAR(150) NOT NULL,
    `description_en` TEXT NULL,
    `description_lo` TEXT NULL,
    `type` ENUM('holiday', 'exam', 'activity', 'meeting', 'other') NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `school_closed` BOOLEAN NOT NULL DEFAULT false,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `school_events_start_date_end_date_idx`(`start_date`, `end_date`),
    PRIMARY KEY (`event_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `announcements` (
    `announcement_id` INTEGER NOT NULL AUTO_INCREMENT,
    `title_en` VARCHAR(255) NOT NULL,
    `title_lo` VARCHAR(255) NOT NULL,
    `content_en` TEXT NOT NULL,
    `content_lo` TEXT NOT NULL,
    `target_audience` ENUM('all', 'teachers', 'parents', 'class') NOT NULL DEFAULT 'all',
    `class_id` INTEGER NULL,
    `publish_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiry_date` DATETIME(3) NULL,
    `created_by` INTEGER NOT NULL,

    INDEX `announcements_publish_date_idx`(`publish_date`),
    PRIMARY KEY (`announcement_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `school_settings` (
    `key` VARCHAR(100) NOT NULL,
    `value` JSON NOT NULL,
    `updated_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_types` (
    `fee_type_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name_en` VARCHAR(100) NOT NULL,
    `name_lo` VARCHAR(100) NOT NULL,
    `description_en` TEXT NULL,
    `description_lo` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`fee_type_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_structures` (
    `fee_structure_id` INTEGER NOT NULL AUTO_INCREMENT,
    `fee_type_id` INTEGER NOT NULL,
    `academic_year` VARCHAR(9) NOT NULL,
    `term_id` INTEGER NULL,
    `class_id` INTEGER NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `due_date` DATE NOT NULL,
    `notes` VARCHAR(255) NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `fee_structures_academic_year_idx`(`academic_year`),
    PRIMARY KEY (`fee_structure_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `invoice_id` INTEGER NOT NULL AUTO_INCREMENT,
    `invoice_no` VARCHAR(30) NOT NULL,
    `student_id` INTEGER NOT NULL,
    `fee_structure_id` INTEGER NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `paid_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `due_date` DATE NOT NULL,
    `status` ENUM('unpaid', 'partial', 'paid', 'void') NOT NULL DEFAULT 'unpaid',
    `notes` VARCHAR(255) NULL,
    `void_reason` VARCHAR(255) NULL,
    `issued_by` INTEGER NULL,
    `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reminder_before_at` DATETIME(3) NULL,
    `overdue_reminders` INTEGER NOT NULL DEFAULT 0,
    `last_reminder_at` DATETIME(3) NULL,

    UNIQUE INDEX `invoices_invoice_no_key`(`invoice_no`),
    INDEX `invoices_status_idx`(`status`),
    INDEX `invoices_due_date_idx`(`due_date`),
    UNIQUE INDEX `invoices_student_id_fee_structure_id_key`(`student_id`, `fee_structure_id`),
    PRIMARY KEY (`invoice_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fee_payments` (
    `payment_id` INTEGER NOT NULL AUTO_INCREMENT,
    `receipt_no` VARCHAR(30) NOT NULL,
    `invoice_id` INTEGER NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `method` ENUM('cash', 'bank_transfer') NOT NULL,
    `reference_no` VARCHAR(100) NULL,
    `notes` VARCHAR(255) NULL,
    `received_by` INTEGER NULL,
    `paid_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `fee_payments_receipt_no_key`(`receipt_no`),
    INDEX `fee_payments_invoice_id_idx`(`invoice_id`),
    INDEX `fee_payments_paid_at_idx`(`paid_at`),
    PRIMARY KEY (`payment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assignments` (
    `assignment_id` INTEGER NOT NULL AUTO_INCREMENT,
    `class_id` INTEGER NOT NULL,
    `subject_id` INTEGER NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `due_date` DATE NOT NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `assignments_class_id_due_date_idx`(`class_id`, `due_date`),
    PRIMARY KEY (`assignment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `behavior_categories` (
    `category_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name_en` VARCHAR(100) NOT NULL,
    `name_lo` VARCHAR(100) NOT NULL,
    `type` ENUM('merit', 'demerit') NOT NULL,
    `default_points` INTEGER NOT NULL DEFAULT 5,
    `severity` VARCHAR(20) NOT NULL DEFAULT 'low',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `behavior_records` (
    `record_id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `category_id` INTEGER NULL,
    `type` ENUM('merit', 'demerit') NOT NULL,
    `title_en` VARCHAR(150) NOT NULL,
    `title_lo` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `points` INTEGER NOT NULL DEFAULT 5,
    `incident_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `action_taken` VARCHAR(255) NULL,
    `notify_parent` BOOLEAN NOT NULL DEFAULT true,
    `recorded_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `behavior_records_student_id_incident_date_idx`(`student_id`, `incident_date`),
    PRIMARY KEY (`record_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bus_vehicles` (
    `vehicle_id` INTEGER NOT NULL AUTO_INCREMENT,
    `plate_number` VARCHAR(30) NOT NULL,
    `model` VARCHAR(100) NULL,
    `capacity` INTEGER NOT NULL DEFAULT 15,
    `driver_name` VARCHAR(100) NOT NULL,
    `driver_phone` VARCHAR(50) NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `bus_vehicles_plate_number_key`(`plate_number`),
    PRIMARY KEY (`vehicle_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bus_routes` (
    `route_id` INTEGER NOT NULL AUTO_INCREMENT,
    `route_name_en` VARCHAR(100) NOT NULL,
    `route_name_lo` VARCHAR(100) NOT NULL,
    `vehicle_id` INTEGER NULL,
    `description` TEXT NULL,
    `stops` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    PRIMARY KEY (`route_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bus_students` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `route_id` INTEGER NOT NULL,
    `vehicle_id` INTEGER NULL,
    `pickup_stop` VARCHAR(150) NULL,
    `dropoff_stop` VARCHAR(150) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `bus_students_student_id_key`(`student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bus_logs` (
    `log_id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `card_id` INTEGER NULL,
    `vehicle_id` INTEGER NULL,
    `route_id` INTEGER NULL,
    `log_type` VARCHAR(30) NOT NULL,
    `direction` VARCHAR(30) NOT NULL DEFAULT 'to_school',
    `log_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `location` VARCHAR(150) NULL,
    `scanned_by` INTEGER NULL,

    INDEX `bus_logs_student_id_log_time_idx`(`student_id`, `log_time`),
    INDEX `bus_logs_vehicle_id_log_time_idx`(`vehicle_id`, `log_time`),
    PRIMARY KEY (`log_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `book_categories` (
    `category_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name_en` VARCHAR(100) NOT NULL,
    `name_lo` VARCHAR(100) NOT NULL,

    PRIMARY KEY (`category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `books` (
    `book_id` INTEGER NOT NULL AUTO_INCREMENT,
    `isbn` VARCHAR(50) NULL,
    `title_en` VARCHAR(200) NOT NULL,
    `title_lo` VARCHAR(200) NOT NULL,
    `author` VARCHAR(150) NOT NULL,
    `publisher` VARCHAR(150) NULL,
    `publish_year` INTEGER NULL,
    `category_id` INTEGER NULL,
    `shelf_location` VARCHAR(100) NULL,
    `total_copies` INTEGER NOT NULL DEFAULT 1,
    `available_copies` INTEGER NOT NULL DEFAULT 1,
    `cover_url` VARCHAR(255) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'available',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `books_isbn_key`(`isbn`),
    INDEX `books_title_en_title_lo_idx`(`title_en`, `title_lo`),
    PRIMARY KEY (`book_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `book_loans` (
    `loan_id` INTEGER NOT NULL AUTO_INCREMENT,
    `book_id` INTEGER NOT NULL,
    `student_id` INTEGER NOT NULL,
    `borrowed_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `due_date` DATE NOT NULL,
    `returned_date` DATETIME(3) NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'borrowed',
    `processed_by` INTEGER NULL,
    `notes` VARCHAR(255) NULL,

    INDEX `book_loans_student_id_status_idx`(`student_id`, `status`),
    INDEX `book_loans_book_id_status_idx`(`book_id`, `status`),
    PRIMARY KEY (`loan_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_risk_assessments` (
    `assessment_id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `risk_level` VARCHAR(20) NOT NULL,
    `risk_score` INTEGER NOT NULL,
    `factors` JSON NOT NULL,
    `assessed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `teacher_notified` BOOLEAN NOT NULL DEFAULT false,
    `teacher_notified_at` DATETIME(3) NULL,

    INDEX `student_risk_assessments_student_id_assessed_at_idx`(`student_id`, `assessed_at`),
    INDEX `student_risk_assessments_risk_level_idx`(`risk_level`),
    PRIMARY KEY (`assessment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `risk_interventions` (
    `intervention_id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `assessment_id` INTEGER NULL,
    `title` VARCHAR(150) NOT NULL,
    `description` TEXT NOT NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'pending',
    `action_by` INTEGER NULL,
    `action_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` TEXT NULL,

    INDEX `risk_interventions_student_id_status_idx`(`student_id`, `status`),
    PRIMARY KEY (`intervention_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schools` (
    `school_id` INTEGER NOT NULL AUTO_INCREMENT,
    `school_code` VARCHAR(50) NOT NULL,
    `name_en` VARCHAR(150) NOT NULL,
    `name_lo` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `email` VARCHAR(150) NULL,
    `address_en` TEXT NULL,
    `address_lo` TEXT NULL,
    `logo_url` VARCHAR(255) NULL,
    `plan` VARCHAR(50) NOT NULL DEFAULT 'standard',
    `status` VARCHAR(30) NOT NULL DEFAULT 'active',
    `max_students` INTEGER NOT NULL DEFAULT 500,
    `settings` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `schools_school_code_key`(`school_code`),
    PRIMARY KEY (`school_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`role_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`role_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_codes` ADD CONSTRAINT `password_reset_codes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teachers` ADD CONSTRAINT `teachers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teachers` ADD CONSTRAINT `teachers_province_id_fkey` FOREIGN KEY (`province_id`) REFERENCES `provinces`(`province_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teachers` ADD CONSTRAINT `teachers_district_id_fkey` FOREIGN KEY (`district_id`) REFERENCES `districts`(`district_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parents` ADD CONSTRAINT `parents_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parents` ADD CONSTRAINT `parents_province_id_fkey` FOREIGN KEY (`province_id`) REFERENCES `provinces`(`province_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parents` ADD CONSTRAINT `parents_district_id_fkey` FOREIGN KEY (`district_id`) REFERENCES `districts`(`district_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classes` ADD CONSTRAINT `classes_homeroom_teacher_id_fkey` FOREIGN KEY (`homeroom_teacher_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classes` ADD CONSTRAINT `classes_homeroom_teacher_profile_fkey` FOREIGN KEY (`homeroom_teacher_id`) REFERENCES `teachers`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_ethnicity_id_fkey` FOREIGN KEY (`ethnicity_id`) REFERENCES `ethnicities`(`ethnicity_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_province_id_fkey` FOREIGN KEY (`province_id`) REFERENCES `provinces`(`province_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_district_id_fkey` FOREIGN KEY (`district_id`) REFERENCES `districts`(`district_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_documents` ADD CONSTRAINT `teacher_documents_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`teacher_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `districts` ADD CONSTRAINT `districts_province_id_fkey` FOREIGN KEY (`province_id`) REFERENCES `provinces`(`province_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_students` ADD CONSTRAINT `class_students_class_id_fkey` FOREIGN KEY (`class_id`) REFERENCES `classes`(`class_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_students` ADD CONSTRAINT `class_students_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parent_student` ADD CONSTRAINT `parent_student_parent_user_id_fkey` FOREIGN KEY (`parent_user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parent_student` ADD CONSTRAINT `parent_student_parent_profile_fkey` FOREIGN KEY (`parent_user_id`) REFERENCES `parents`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parent_student` ADD CONSTRAINT `parent_student_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cards` ADD CONSTRAINT `cards_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cards` ADD CONSTRAINT `cards_issued_by_fkey` FOREIGN KEY (`issued_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_logs` ADD CONSTRAINT `attendance_logs_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_logs` ADD CONSTRAINT `attendance_logs_card_id_fkey` FOREIGN KEY (`card_id`) REFERENCES `cards`(`card_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_logs` ADD CONSTRAINT `attendance_logs_manual_entry_by_fkey` FOREIGN KEY (`manual_entry_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_attendance` ADD CONSTRAINT `daily_attendance_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_attendance` ADD CONSTRAINT `daily_attendance_recorded_by_fkey` FOREIGN KEY (`recorded_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_subjects` ADD CONSTRAINT `class_subjects_class_id_fkey` FOREIGN KEY (`class_id`) REFERENCES `classes`(`class_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_subjects` ADD CONSTRAINT `class_subjects_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`subject_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_subjects` ADD CONSTRAINT `class_subjects_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_subjects` ADD CONSTRAINT `class_subjects_teacher_profile_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `class_subjects` ADD CONSTRAINT `class_subjects_term_id_fkey` FOREIGN KEY (`term_id`) REFERENCES `academic_terms`(`term_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grades` ADD CONSTRAINT `grades_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grades` ADD CONSTRAINT `grades_class_subject_id_fkey` FOREIGN KEY (`class_subject_id`) REFERENCES `class_subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grades` ADD CONSTRAINT `grades_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grades` ADD CONSTRAINT `grades_teacher_profile_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grades` ADD CONSTRAINT `grades_grade_type_id_fkey` FOREIGN KEY (`grade_type_id`) REFERENCES `grade_types`(`type_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_accounts` ADD CONSTRAINT `wallet_accounts_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_transactions` ADD CONSTRAINT `wallet_transactions_wallet_id_fkey` FOREIGN KEY (`wallet_id`) REFERENCES `wallet_accounts`(`wallet_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_transactions` ADD CONSTRAINT `wallet_transactions_shop_id_fkey` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`shop_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_transactions` ADD CONSTRAINT `wallet_transactions_processed_by_fkey` FOREIGN KEY (`processed_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_transactions` ADD CONSTRAINT `wallet_transactions_refund_of_id_fkey` FOREIGN KEY (`refund_of_id`) REFERENCES `wallet_transactions`(`transaction_id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `top_up_requests` ADD CONSTRAINT `top_up_requests_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `top_up_requests` ADD CONSTRAINT `top_up_requests_parent_user_id_fkey` FOREIGN KEY (`parent_user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `top_up_requests` ADD CONSTRAINT `top_up_requests_parent_profile_fkey` FOREIGN KEY (`parent_user_id`) REFERENCES `parents`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `top_up_requests` ADD CONSTRAINT `top_up_requests_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `top_up_requests` ADD CONSTRAINT `top_up_requests_transaction_id_fkey` FOREIGN KEY (`transaction_id`) REFERENCES `wallet_transactions`(`transaction_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_recipient_user_id_fkey` FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `spending_limits` ADD CONSTRAINT `spending_limits_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `spending_limits` ADD CONSTRAINT `spending_limits_set_by_fkey` FOREIGN KEY (`set_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `blocked_shops` ADD CONSTRAINT `blocked_shops_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `blocked_shops` ADD CONSTRAINT `blocked_shops_shop_id_fkey` FOREIGN KEY (`shop_id`) REFERENCES `shops`(`shop_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_class_subject_id_fkey` FOREIGN KEY (`class_subject_id`) REFERENCES `class_subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_parent_user_id_fkey` FOREIGN KEY (`parent_user_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_parent_profile_fkey` FOREIGN KEY (`parent_user_id`) REFERENCES `parents`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `school_events` ADD CONSTRAINT `school_events_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_class_id_fkey` FOREIGN KEY (`class_id`) REFERENCES `classes`(`class_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_structures` ADD CONSTRAINT `fee_structures_fee_type_id_fkey` FOREIGN KEY (`fee_type_id`) REFERENCES `fee_types`(`fee_type_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_structures` ADD CONSTRAINT `fee_structures_term_id_fkey` FOREIGN KEY (`term_id`) REFERENCES `academic_terms`(`term_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_structures` ADD CONSTRAINT `fee_structures_class_id_fkey` FOREIGN KEY (`class_id`) REFERENCES `classes`(`class_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_structures` ADD CONSTRAINT `fee_structures_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_fee_structure_id_fkey` FOREIGN KEY (`fee_structure_id`) REFERENCES `fee_structures`(`fee_structure_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_issued_by_fkey` FOREIGN KEY (`issued_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_payments` ADD CONSTRAINT `fee_payments_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`invoice_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fee_payments` ADD CONSTRAINT `fee_payments_received_by_fkey` FOREIGN KEY (`received_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_class_id_fkey` FOREIGN KEY (`class_id`) REFERENCES `classes`(`class_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`subject_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `behavior_records` ADD CONSTRAINT `behavior_records_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `behavior_records` ADD CONSTRAINT `behavior_records_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `behavior_categories`(`category_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `behavior_records` ADD CONSTRAINT `behavior_records_recorded_by_fkey` FOREIGN KEY (`recorded_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bus_routes` ADD CONSTRAINT `bus_routes_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `bus_vehicles`(`vehicle_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bus_students` ADD CONSTRAINT `bus_students_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bus_students` ADD CONSTRAINT `bus_students_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `bus_routes`(`route_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bus_students` ADD CONSTRAINT `bus_students_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `bus_vehicles`(`vehicle_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bus_logs` ADD CONSTRAINT `bus_logs_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bus_logs` ADD CONSTRAINT `bus_logs_card_id_fkey` FOREIGN KEY (`card_id`) REFERENCES `cards`(`card_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bus_logs` ADD CONSTRAINT `bus_logs_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `bus_vehicles`(`vehicle_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bus_logs` ADD CONSTRAINT `bus_logs_route_id_fkey` FOREIGN KEY (`route_id`) REFERENCES `bus_routes`(`route_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `books` ADD CONSTRAINT `books_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `book_categories`(`category_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `book_loans` ADD CONSTRAINT `book_loans_book_id_fkey` FOREIGN KEY (`book_id`) REFERENCES `books`(`book_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `book_loans` ADD CONSTRAINT `book_loans_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `book_loans` ADD CONSTRAINT `book_loans_processed_by_fkey` FOREIGN KEY (`processed_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_risk_assessments` ADD CONSTRAINT `student_risk_assessments_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_interventions` ADD CONSTRAINT `risk_interventions_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_interventions` ADD CONSTRAINT `risk_interventions_assessment_id_fkey` FOREIGN KEY (`assessment_id`) REFERENCES `student_risk_assessments`(`assessment_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_interventions` ADD CONSTRAINT `risk_interventions_action_by_fkey` FOREIGN KEY (`action_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

