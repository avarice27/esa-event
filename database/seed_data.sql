-- Seed data for EsaEvent application
-- This script creates default users and sample data

-- Insert default admin user
-- Password: admin123 (hashed with bcrypt)
INSERT INTO users (username, email, password_hash, full_name, role) VALUES 
('admin', 'admin@esaevent.com', '$2a$12$LQv3c1yqBwEHFqHX5ZVHa.4X8KmVldxyAoO0mKiYU.5UiYzxiXqLu', 'System Administrator', 'admin'),
('manager', 'manager@esaevent.com', '$2a$12$LQv3c1yqBwEHFqHX5ZVHa.4X8KmVldxyAoO0mKiYU.5UiYzxiXqLu', 'Event Manager', 'manager'),
('user', 'user@esaevent.com', '$2a$12$LQv3c1yqBwEHFqHX5ZVHa.4X8KmVldxyAoO0mKiYU.5UiYzxiXqLu', 'Regular User', 'user');

-- Insert sample clients
INSERT INTO clients (name, email, phone, address, company, contact_person, credit_limit, credit_terms) VALUES
('PT. Teknologi Maju', 'contact@teknologimaju.com', '+62-21-1234567', 'Jl. Sudirman No. 123, Jakarta', 'PT. Teknologi Maju', 'Budi Santoso', 50000000, 30),
('CV. Kreatif Solusi', 'info@kreatifsol.com', '+62-21-2345678', 'Jl. Thamrin No. 456, Jakarta', 'CV. Kreatif Solusi', 'Sari Dewi', 25000000, 14),
('Yayasan Pendidikan Nusantara', 'admin@ypn.org', '+62-21-3456789', 'Jl. Gatot Subroto No. 789, Jakarta', 'Yayasan Pendidikan Nusantara', 'Dr. Ahmad Rahman', 75000000, 45);

-- Insert sample vendors
INSERT INTO vendors (name, email, phone, address, company, contact_person, service_category, rating, payment_terms) VALUES
('Catering Nusantara', 'order@cateringnusantara.com', '+62-21-4567890', 'Jl. Kemang No. 123, Jakarta', 'CV. Catering Nusantara', 'Ibu Siti', 'Catering', 4.5, 7),
('Sound System Pro', 'rental@soundpro.com', '+62-21-5678901', 'Jl. Radio Dalam No. 456, Jakarta', 'PT. Sound System Pro', 'Pak Joko', 'Audio Visual', 4.8, 14),
('Dekorasi Indah', 'info@dekorasiindah.com', '+62-21-6789012', 'Jl. Fatmawati No. 789, Jakarta', 'CV. Dekorasi Indah', 'Ibu Maya', 'Decoration', 4.2, 10),
('Security Plus', 'contact@securityplus.com', '+62-21-7890123', 'Jl. Kuningan No. 321, Jakarta', 'PT. Security Plus', 'Pak Andi', 'Security', 4.6, 30);

-- Insert sample events
INSERT INTO events (name, description, client_id, event_date, venue, expected_attendees, status, budget, created_by) VALUES
('Annual Company Meeting 2024', 'Rapat tahunan perusahaan dengan presentasi kinerja dan strategi masa depan', 1, '2024-03-15', 'Hotel Grand Indonesia, Jakarta', 200, 'confirmed', 150000000, 1),
('Product Launch Event', 'Peluncuran produk baru dengan demo dan networking session', 2, '2024-04-20', 'JCC Senayan, Jakarta', 500, 'planning', 300000000, 1),
('Educational Seminar', 'Seminar pendidikan untuk guru dan siswa se-Jakarta', 3, '2024-05-10', 'Universitas Indonesia, Depok', 1000, 'confirmed', 200000000, 2);

-- Insert sample transactions
INSERT INTO transactions (event_id, type, category, description, amount, transaction_date, vendor_id, status, created_by) VALUES
(1, 'expense', 'Venue Rental', 'Sewa ballroom Hotel Grand Indonesia', 50000000, '2024-02-01', NULL, 'completed', 1),
(1, 'expense', 'Catering', 'Paket makan siang untuk 200 orang', 30000000, '2024-02-05', 1, 'completed', 1),
(1, 'expense', 'Equipment Rental', 'Sewa sound system dan proyektor', 15000000, '2024-02-10', 2, 'completed', 1),
(1, 'income', 'Event Fee', 'Pembayaran dari klien untuk event', 150000000, '2024-02-15', NULL, 'completed', 1),
(2, 'expense', 'Venue Rental', 'Sewa hall JCC Senayan', 100000000, '2024-03-01', NULL, 'pending', 1),
(2, 'expense', 'Decoration', 'Dekorasi panggung dan booth', 50000000, '2024-03-05', 3, 'pending', 1),
(3, 'expense', 'Security', 'Jasa keamanan untuk 1000 peserta', 25000000, '2024-04-01', 4, 'pending', 2);

-- Insert sample invoices
INSERT INTO invoices (invoice_number, event_id, client_id, issue_date, due_date, subtotal, tax_rate, tax_amount, total_amount, status, created_by) VALUES
('INV-2024-001', 1, 1, '2024-01-15', '2024-02-14', 150000000, 11, 16500000, 166500000, 'paid', 1),
('INV-2024-002', 2, 2, '2024-02-01', '2024-03-02', 300000000, 11, 33000000, 333000000, 'sent', 1),
('INV-2024-003', 3, 3, '2024-03-01', '2024-04-15', 200000000, 11, 22000000, 222000000, 'draft', 2);

-- Insert invoice items
INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price) VALUES
(1, 'Annual Company Meeting Organization', 1, 150000000, 150000000),
(2, 'Product Launch Event Management', 1, 300000000, 300000000),
(3, 'Educational Seminar Organization', 1, 200000000, 200000000);

-- Update events with actual revenue and costs
UPDATE events SET 
    actual_cost = (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE event_id = events.id AND type = 'expense'),
    revenue = (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE event_id = events.id AND type = 'income')
WHERE id IN (1, 2, 3);

-- Calculate profit margins
UPDATE events SET 
    profit_margin = CASE 
        WHEN revenue > 0 THEN ROUND(((revenue - actual_cost) / revenue * 100)::numeric, 2)
        ELSE 0 
    END
WHERE id IN (1, 2, 3);