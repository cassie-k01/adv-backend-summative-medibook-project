USE medibook;

INSERT INTO patients (id, full_name, email, phone) VALUES
  (1, 'Ama Mensah',      'ama@mail.com',    '0244-111-222'),
  (2, 'Kojo Owusu',      'kojo@mail.com',   '0555-333-444'),
  (3, 'Efua Darko',      'efua@mail.com',   '0200-555-666'),
  (4, 'Yaw Asante',      'yaw@mail.com',    '0277-888-999'),
  (5, 'Akosua Frimpong', 'akosua@mail.com', '0501-234-567');

-- Dr. Sarpong (id 4) deliberately has no appointments.
INSERT INTO doctors (id, full_name, specialty, consultation_fee, room) VALUES
  (1, 'Dr. Boateng', 'Dermatology',      150.00, 'R-12'),
  (2, 'Dr. Adjei',   'Paediatrics',      100.00, 'R-03'),
  (3, 'Dr. Quaye',   'General Practice',  80.00, 'R-07'),
  (4, 'Dr. Sarpong', 'Cardiology',       200.00, 'R-09');

-- Dr. Boateng on 2026-12-07: exactly 12 booked slots (09:00 to 14:30), the daily cap.
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, status, amount_paid, booked_on) VALUES
  (1, 1, '2026-12-07 09:00:00', 'booked', 150.00, '2026-11-01 08:00:00'),
  (2, 1, '2026-12-07 09:30:00', 'booked', 120.00, '2026-11-02 09:15:00'),
  (3, 1, '2026-12-07 10:00:00', 'booked', 150.00, '2026-11-02 10:00:00'),
  (4, 1, '2026-12-07 10:30:00', 'booked', 150.00, '2026-11-03 11:30:00'),
  (5, 1, '2026-12-07 11:00:00', 'booked', 150.00, '2026-11-03 12:45:00'),
  (1, 1, '2026-12-07 11:30:00', 'booked', 150.00, '2026-11-04 08:20:00'),
  (2, 1, '2026-12-07 12:00:00', 'booked', 150.00, '2026-11-04 14:00:00'),
  (3, 1, '2026-12-07 12:30:00', 'booked', 150.00, '2026-11-05 09:00:00'),
  (4, 1, '2026-12-07 13:00:00', 'booked', 150.00, '2026-11-05 10:10:00'),
  (5, 1, '2026-12-07 13:30:00', 'booked', 150.00, '2026-11-06 16:00:00'),
  (1, 1, '2026-12-07 14:00:00', 'booked', 150.00, '2026-11-06 16:30:00'),
  (2, 1, '2026-12-07 14:30:00', 'booked', 150.00, '2026-11-07 09:45:00');

-- Dr. Adjei 2026-12-10 10:00: first booking was cancelled (full refund, kept as history)
-- and the same slot was then rebooked by another patient.
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, status, amount_paid, booked_on, cancelled_at, refund_amount) VALUES
  (1, 2, '2026-12-10 10:00:00', 'cancelled', 100.00, '2026-11-02 10:00:00', '2026-11-10 14:00:00', 100.00);
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, status, amount_paid, booked_on) VALUES
  (3, 2, '2026-12-10 10:00:00', 'booked', 100.00, '2026-11-11 09:00:00'),
  (2, 2, '2026-12-10 10:30:00', 'booked', 100.00, '2026-11-12 09:30:00'),
  (4, 3, '2026-12-11 09:00:00', 'booked',  80.00, '2026-11-12 11:00:00'),
  (5, 3, '2026-12-11 09:30:00', 'booked',  60.00, '2026-11-13 10:00:00');
