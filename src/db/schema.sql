CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  username      VARCHAR(64)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL DEFAULT '',
  name          VARCHAR(255) NOT NULL DEFAULT '',
  email         VARCHAR(255) NOT NULL DEFAULT '',
  phone         VARCHAR(64)  NOT NULL DEFAULT '',
  level         VARCHAR(32)  NOT NULL DEFAULT 'teknisi',
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    VARCHAR(64)  NOT NULL DEFAULT '',
  photo_name    VARCHAR(255) NOT NULL DEFAULT '',
  UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS handover_sheets (
  id          VARCHAR(64) NOT NULL PRIMARY KEY,
  sheet_date  VARCHAR(10) NOT NULL,
  shift       VARCHAR(8)  NOT NULL,
  created_by  VARCHAR(64) NOT NULL DEFAULT '',
  created_at  VARCHAR(64) NOT NULL DEFAULT '',
  UNIQUE KEY uk_sheet_date_shift (sheet_date, shift)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS handover_rows (
  id                 VARCHAR(64)  NOT NULL PRIMARY KEY,
  sheet_id           VARCHAR(64)  NOT NULL,
  sort_order         INT          NOT NULL DEFAULT 0,
  crew               VARCHAR(64)  NOT NULL DEFAULT '',
  unit               VARCHAR(128) NOT NULL DEFAULT '',
  location           VARCHAR(255) NOT NULL DEFAULT '',
  technician         VARCHAR(255) NOT NULL DEFAULT '',
  status             VARCHAR(32)  NOT NULL DEFAULT '',
  waiting_labour_at  VARCHAR(64)  NOT NULL DEFAULT '',
  repair_started_at  VARCHAR(64)  NOT NULL DEFAULT '',
  rd30_at            VARCHAR(64)  NOT NULL DEFAULT '',
  hm_awal            VARCHAR(64)  NOT NULL DEFAULT '',
  hm_akhir           VARCHAR(64)  NOT NULL DEFAULT '',
  breakdown_problem  TEXT,
  done_action        TEXT,
  continue_handover  TEXT,
  so                 TEXT,
  updated_at         VARCHAR(64)  NOT NULL DEFAULT '',
  updated_by         VARCHAR(64)  NOT NULL DEFAULT '',
  KEY idx_rows_sheet (sheet_id, sort_order),
  CONSTRAINT fk_handover_rows_sheet
    FOREIGN KEY (sheet_id) REFERENCES handover_sheets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE handover_rows ADD COLUMN IF NOT EXISTS so TEXT NULL;

CREATE TABLE IF NOT EXISTS units (
  id         VARCHAR(64)   NOT NULL PRIMARY KEY,
  model      VARCHAR(64)   NOT NULL,
  quota_hrs  DECIMAL(10,2) NOT NULL,
  unit_code  VARCHAR(128)  NOT NULL,
  group_name VARCHAR(128)  NOT NULL DEFAULT '',
  created_at VARCHAR(64)   NOT NULL DEFAULT '',
  updated_at VARCHAR(64)   NOT NULL DEFAULT '',
  UNIQUE KEY uk_units_code (unit_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE units ADD COLUMN IF NOT EXISTS group_name VARCHAR(128) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS unit_groups (
  id         VARCHAR(64)   NOT NULL PRIMARY KEY,
  group_name VARCHAR(128)  NOT NULL,
  quota_hrs  DECIMAL(10,2) NOT NULL,
  created_at VARCHAR(64)   NOT NULL DEFAULT '',
  updated_at VARCHAR(64)   NOT NULL DEFAULT '',
  UNIQUE KEY uk_unit_groups_name (group_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS data_backups (
  id            VARCHAR(64)  NOT NULL PRIMARY KEY,
  action        VARCHAR(16)  NOT NULL,
  entity        VARCHAR(32)  NOT NULL,
  record_id     VARCHAR(64)  NOT NULL,
  record_label  VARCHAR(255) NOT NULL DEFAULT '',
  snapshot      LONGTEXT     NOT NULL,
  user_id       VARCHAR(64)  NOT NULL DEFAULT '',
  user_name     VARCHAR(255) NOT NULL DEFAULT '',
  username      VARCHAR(64)  NOT NULL DEFAULT '',
  acted_at      DATETIME(3)  NOT NULL,
  KEY idx_backups_record (entity, record_id, acted_at),
  KEY idx_backups_user (user_id, acted_at),
  KEY idx_backups_acted (acted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
