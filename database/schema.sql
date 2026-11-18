-- MediBook schema. Requires MySQL 8.0.16 or newer (enforced CHECK constraints, generated columns).
CREATE DATABASE IF NOT EXISTS medibook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medibook;

-- Safe to re-run: children are dropped before parents.
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS patients;

CREATE TABLE patients (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name  VARCHAR(100) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  phone      VARCHAR(20)  NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_patients PRIMARY KEY (id),
  CONSTRAINT uq_patients_email UNIQUE (email),
  CONSTRAINT chk_patients_name CHECK (CHAR_LENGTH(TRIM(full_name)) > 0),
  CONSTRAINT chk_patients_email CHECK (email LIKE '%_@_%._%')
) ENGINE = InnoDB;

CREATE TABLE doctors (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  full_name        VARCHAR(100)  NOT NULL,
  specialty        VARCHAR(80)   NOT NULL,
  consultation_fee DECIMAL(10,2) NOT NULL,
  room             VARCHAR(10)   NOT NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_doctors PRIMARY KEY (id),
  CONSTRAINT chk_doctors_name CHECK (CHAR_LENGTH(TRIM(full_name)) > 0),
  CONSTRAINT chk_doctors_fee CHECK (consultation_fee >= 0)
) ENGINE = InnoDB;

CREATE TABLE appointments (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  patient_id    INT UNSIGNED  NOT NULL,
  doctor_id     INT UNSIGNED  NOT NULL,
  appt_datetime DATETIME      NOT NULL,
  status        ENUM('booked','cancelled') NOT NULL DEFAULT 'booked',
  amount_paid   DECIMAL(10,2) NOT NULL,
  booked_on     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at  DATETIME      NULL,
  refund_amount DECIMAL(10,2) NULL,
  -- Equals appt_datetime while the appointment is booked, NULL once cancelled.
  -- UNIQUE indexes allow many NULLs, so cancelled rows never block the slot.
  active_slot   DATETIME GENERATED ALWAYS AS (IF(status = 'booked', appt_datetime, NULL)) VIRTUAL,

  CONSTRAINT pk_appointments PRIMARY KEY (id),

  -- Business rule: a doctor cannot have two appointments at the same date/time.
  CONSTRAINT uq_doctor_active_slot UNIQUE (doctor_id, active_slot),

  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id) REFERENCES patients (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_appt_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT chk_slot_boundary CHECK (MINUTE(appt_datetime) IN (0, 30) AND SECOND(appt_datetime) = 0),
  CONSTRAINT chk_working_hours CHECK (TIME(appt_datetime) BETWEEN '09:00:00' AND '16:30:00'),
  CONSTRAINT chk_amount_paid CHECK (amount_paid >= 0),
  CONSTRAINT chk_refund_range CHECK (refund_amount IS NULL OR refund_amount BETWEEN 0 AND amount_paid),
  CONSTRAINT chk_cancel_state CHECK (
    (status = 'booked' AND cancelled_at IS NULL AND refund_amount IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL AND refund_amount IS NOT NULL)
  ),

  INDEX idx_appt_patient (patient_id),
  INDEX idx_appt_doctor_dt (doctor_id, appt_datetime)
) ENGINE = InnoDB;
