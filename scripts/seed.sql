-- Seed data for local development and demos (spec §11.4).
-- Idempotent: clears the content tables first, then inserts a fixed dataset with
-- explicit ids so listing_images FKs are deterministic.
-- Apply: npm run db:seed:local   (or :remote for the deployed DB)
--
-- Timestamps use unixepoch() (seconds). created_at is staggered so lower ids are
-- "newer" — this drives the home recent-arrivals ordering (created_at DESC).
-- Image r2_key values are placeholders; run scripts/seed-images.ps1 to upload
-- matching placeholder objects to local R2 if you want cards to render images.

DELETE FROM listing_images;
DELETE FROM inquiries;
DELETE FROM listings;
DELETE FROM spare_parts;
DELETE FROM announcements;

-- ── listings: 5 used_car, 5 used_truck, 4 used_heavy_equipment ───────────────
INSERT INTO listings
  (id, slug, category, title, reference_number, maker, model, body, year_of_manufacture, mileage, color, location, condition, transmission_type, fuel_type, status, price, price_on_application, description, specs, is_featured, is_published, created_at, updated_at)
VALUES
  (1, 'toyota-fortuner-2018', 'used_car', 'Toyota Fortuner 2.4 G 2018', 'TGM-C001', 'Toyota', 'Fortuner', 'SUV', 2018, 78000, 'Pearl White', 'Quezon City', 'used', 'automatic', 'diesel', 'available', 1250000, 0,
    'Well-maintained 2.4 G diesel automatic. Complete casa records, no accident history. Newly serviced with fresh tires.',
    '{"engine":"2.4L 2GD-FTV Turbo Diesel","top_speed":"180 km/h","acceleration_0_62":"12.7 s","drive_type":"4x2","gearbox":"6-speed automatic","dimensions":{"length":"4795 mm","width":"1855 mm","height":"1835 mm"},"weight":"1855 kg"}',
    1, 1, unixepoch() - 0*86400, unixepoch() - 0*86400),

  (2, 'honda-civic-2020', 'used_car', 'Honda Civic 1.8 E CVT 2020', 'TGM-C002', 'Honda', 'Civic', 'Sedan', 2020, 41000, 'Modern Steel', 'Makati', 'used', 'automatic', 'gasoline', 'available', 950000, 0,
    'Low-mileage Civic E variant, first owner. Smooth CVT, all power features functional.',
    '{"engine":"1.8L SOHC i-VTEC","top_speed":"200 km/h","acceleration_0_62":"10.8 s","drive_type":"FWD","gearbox":"CVT","dimensions":{"length":"4630 mm","width":"1799 mm","height":"1416 mm"},"weight":"1270 kg"}',
    0, 1, unixepoch() - 1*86400, unixepoch() - 1*86400),

  (3, 'mitsubishi-montero-sport-2019', 'used_car', 'Mitsubishi Montero Sport GLS 2019', 'TGM-C003', 'Mitsubishi', 'Montero Sport', 'SUV', 2019, 62000, 'Graphite Gray', 'Pasig', 'used', 'automatic', 'diesel', 'available', 1480000, 0,
    'GLS 4x2 automatic, well kept. Leather seats, paddle shifters, 360-degree camera.',
    '{"engine":"2.4L 4N15 MIVEC Turbo Diesel","drive_type":"4x2","gearbox":"8-speed automatic","dimensions":{"length":"4825 mm","width":"1815 mm","height":"1805 mm"},"weight":"1965 kg"}',
    1, 1, unixepoch() - 2*86400, unixepoch() - 2*86400),

  (4, 'toyota-vios-2021', 'used_car', 'Toyota Vios 1.3 XE CVT 2021', 'TGM-C004', 'Toyota', 'Vios', 'Sedan', 2021, 33000, 'Red Mica', 'Quezon City', 'used', 'automatic', 'gasoline', 'available', 680000, 0,
    'DRAFT listing for testing the publish filter. Fuel-efficient daily driver.',
    '{"engine":"1.3L Dual VVT-i","drive_type":"FWD","gearbox":"CVT","dimensions":{"length":"4425 mm","width":"1730 mm","height":"1475 mm"}}',
    0, 0, unixepoch() - 3*86400, unixepoch() - 3*86400),

  (5, 'ford-everest-2017', 'used_car', 'Ford Everest Titanium 3.2 4x4 2017', 'TGM-C005', 'Ford', 'Everest', 'SUV', 2017, 95000, 'Aluminium', 'Cavite', 'used', 'automatic', 'diesel', 'reserved', 1150000, 0,
    'Top-of-the-line Titanium 4x4. Sunroof, semi-autonomous parking, power tailgate.',
    '{"engine":"3.2L Duratorq TDCi","drive_type":"4x4","gearbox":"6-speed automatic","dimensions":{"length":"4892 mm","width":"1862 mm","height":"1837 mm"},"weight":"2497 kg"}',
    0, 1, unixepoch() - 4*86400, unixepoch() - 4*86400),

  (6, 'hino-500-dump-2016', 'used_truck', 'Hino 500 Series FM 10-Wheeler Dump Truck 2016', 'TGM-T001', 'Hino', '500 Series FM', 'Dump truck', 2016, 180000, 'Yellow', 'Subic', 'used', 'manual', 'diesel', 'available', 2350000, 0,
    'Japan surplus 10-wheeler dump truck. Strong engine, ready for hauling. Hydraulics tested and working.',
    '{"engine":"J08E-UF 7.7L Diesel","gross_weight":"24,000 kg","payload":"15,000 kg","gearbox":"6-speed manual","dimensions":"8,500 x 2,490 x 2,900 mm"}',
    1, 1, unixepoch() - 5*86400, unixepoch() - 5*86400),

  (7, 'isuzu-elf-nhr-2018', 'used_truck', 'Isuzu ELF NHR Dropside 2018', 'TGM-T002', 'Isuzu', 'ELF NHR', 'Dropside', 2018, 120000, 'White', 'Valenzuela', 'used', 'manual', 'diesel', 'available', 980000, 0,
    'Reliable light-duty dropside, ideal for deliveries. Fresh paint, new battery.',
    '{"engine":"4JH1 3.0L Diesel","gross_weight":"4,500 kg","payload":"2,500 kg","gearbox":"5-speed manual","dimensions":"5,980 x 1,890 x 2,135 mm"}',
    0, 1, unixepoch() - 6*86400, unixepoch() - 6*86400),

  (8, 'fuso-canter-wingvan-2015', 'used_truck', 'Mitsubishi Fuso Canter Wing Van 2015', 'TGM-T003', 'Mitsubishi Fuso', 'Canter', 'Wing van', 2015, 210000, 'White', 'Subic', 'used', 'manual', 'diesel', 'available', 1250000, 0,
    'Japan surplus aluminum wing van. Excellent for logistics and cargo. Body in great condition.',
    '{"engine":"4M50 4.9L Diesel","gross_weight":"8,000 kg","payload":"4,000 kg","gearbox":"6-speed manual","dimensions":"7,200 x 2,200 x 3,000 mm"}',
    0, 1, unixepoch() - 7*86400, unixepoch() - 7*86400),

  (9, 'hino-700-tractor-head-2014', 'used_truck', 'Hino 700 Series Tractor Head 2014', 'TGM-T004', 'Hino', '700 Series', 'Tractor head', 2014, 320000, 'White', 'Subic', 'used', 'manual', 'diesel', 'available', NULL, 1,
    'Heavy-duty prime mover for trailer operations. Price on application — inquire for current pricing and availability.',
    '{"engine":"E13C 12.9L Diesel","gross_weight":"24,000 kg","gearbox":"16-speed manual","dimensions":"6,900 x 2,490 x 3,100 mm"}',
    0, 1, unixepoch() - 8*86400, unixepoch() - 8*86400),

  (10, 'isuzu-forward-boom-2017', 'used_truck', 'Isuzu Forward Boom Truck 2017', 'TGM-T005', 'Isuzu', 'Forward', 'Boom truck', 2017, 150000, 'Orange', 'Subic', 'used', 'manual', 'diesel', 'incoming', 1850000, 0,
    'Incoming unit — 3-ton crane boom truck. Reserve early. Arriving from Japan auction.',
    '{"engine":"6HK1 7.8L Diesel","gross_weight":"14,000 kg","payload":"8,000 kg","gearbox":"6-speed manual","dimensions":"8,400 x 2,490 x 2,880 mm"}',
    1, 1, unixepoch() - 9*86400, unixepoch() - 9*86400),

  (11, 'komatsu-pc200-8-2013', 'used_heavy_equipment', 'Komatsu PC200-8 Hydraulic Excavator 2013', 'TGM-H001', 'Komatsu', 'PC200-8', 'Excavator', 2013, 9800, 'Komatsu Yellow', 'Subic', 'used', 'other', 'diesel', 'available', 3200000, 0,
    'Japan surplus 20-ton class excavator. Undercarriage approx 70%. Idler, track rollers, and bucket in good condition. Hour meter reads ~9,800 hrs. Ideal for general excavation and demolition support.',
    '{"engine":"Komatsu SAA6D107E-1","net_weight":"19,800 kg","payload":"0.8 m3 bucket","dimensions":"9,425 x 2,800 x 3,040 mm"}',
    1, 1, unixepoch() - 10*86400, unixepoch() - 10*86400),

  (12, 'caterpillar-320d-2012', 'used_heavy_equipment', 'Caterpillar 320D Hydraulic Excavator 2012', 'TGM-H002', 'Caterpillar', '320D', 'Excavator', 2012, 11200, 'Cat Yellow', 'Subic', 'used', 'other', 'diesel', 'available', NULL, 1,
    'Proven 20-ton CAT excavator. Strong hydraulics, no leaks observed on inspection. Recently replaced final drive. Price on application — call for a unit walkthrough and current pricing.',
    '{"engine":"Cat C6.4 ACERT","net_weight":"20,700 kg","payload":"1.0 m3 bucket","dimensions":"9,530 x 2,800 x 3,150 mm"}',
    0, 1, unixepoch() - 11*86400, unixepoch() - 11*86400),

  (13, 'komatsu-gd511a-grader-2011', 'used_heavy_equipment', 'Komatsu GD511A Motor Grader 2011', 'TGM-H003', 'Komatsu', 'GD511A-1', 'Motor grader', 2011, 13500, 'Komatsu Yellow', 'Subic', 'used', 'other', 'diesel', 'available', 2800000, 0,
    'Motor grader suitable for road maintenance and site leveling. Blade and circle in serviceable condition. Cab intact with functional controls.',
    '{"engine":"Komatsu SA6D102E","net_weight":"13,800 kg","dimensions":"8,330 x 2,500 x 3,300 mm","gearbox":"Powershift, 8F/4R"}',
    0, 1, unixepoch() - 12*86400, unixepoch() - 12*86400),

  (14, 'kobelco-sk200-2014', 'used_heavy_equipment', 'Kobelco SK200 Hydraulic Excavator 2014', 'TGM-H004', 'Kobelco', 'SK200-8', 'Excavator', 2014, 8600, 'Kobelco Blue', 'Subic', 'used', 'other', 'diesel', 'sold', 3050000, 0,
    'SOLD reference unit (kept to demonstrate the sold status badge). Low-hour 20-ton excavator, fuel-efficient iNDr cooling system.',
    '{"engine":"Hino J05E","net_weight":"19,900 kg","payload":"0.8 m3 bucket","dimensions":"9,450 x 2,800 x 2,950 mm"}',
    0, 1, unixepoch() - 13*86400, unixepoch() - 13*86400);

-- ── listing_images: primary + one secondary per listing (placeholder r2_keys) ─
INSERT INTO listing_images (listing_id, r2_key, alt, sort_order, is_primary) VALUES
  (1,  'seed/toyota-fortuner-2018/01.jpg',          'Toyota Fortuner 2018 front',        0, 1),
  (1,  'seed/toyota-fortuner-2018/02.jpg',          'Toyota Fortuner 2018 interior',     1, 0),
  (2,  'seed/honda-civic-2020/01.jpg',              'Honda Civic 2020 front',            0, 1),
  (2,  'seed/honda-civic-2020/02.jpg',              'Honda Civic 2020 side',             1, 0),
  (3,  'seed/mitsubishi-montero-sport-2019/01.jpg', 'Montero Sport 2019 front',          0, 1),
  (3,  'seed/mitsubishi-montero-sport-2019/02.jpg', 'Montero Sport 2019 rear',           1, 0),
  (4,  'seed/toyota-vios-2021/01.jpg',              'Toyota Vios 2021 front',            0, 1),
  (5,  'seed/ford-everest-2017/01.jpg',             'Ford Everest 2017 front',           0, 1),
  (5,  'seed/ford-everest-2017/02.jpg',             'Ford Everest 2017 interior',        1, 0),
  (6,  'seed/hino-500-dump-2016/01.jpg',            'Hino 500 dump truck',               0, 1),
  (6,  'seed/hino-500-dump-2016/02.jpg',            'Hino 500 dump bed raised',          1, 0),
  (7,  'seed/isuzu-elf-nhr-2018/01.jpg',            'Isuzu ELF NHR dropside',            0, 1),
  (8,  'seed/fuso-canter-wingvan-2015/01.jpg',      'Fuso Canter wing van',              0, 1),
  (9,  'seed/hino-700-tractor-head-2014/01.jpg',    'Hino 700 tractor head',             0, 1),
  (10, 'seed/isuzu-forward-boom-2017/01.jpg',       'Isuzu Forward boom truck',          0, 1),
  (11, 'seed/komatsu-pc200-8-2013/01.jpg',          'Komatsu PC200-8 excavator',         0, 1),
  (11, 'seed/komatsu-pc200-8-2013/02.jpg',          'Komatsu PC200-8 boom detail',       1, 0),
  (12, 'seed/caterpillar-320d-2012/01.jpg',         'Caterpillar 320D excavator',        0, 1),
  (13, 'seed/komatsu-gd511a-grader-2011/01.jpg',    'Komatsu GD511A motor grader',       0, 1),
  (14, 'seed/kobelco-sk200-2014/01.jpg',            'Kobelco SK200 excavator',           0, 1);

-- ── spare_parts (spec §4.5) ─────────────────────────────────────────────────
INSERT INTO spare_parts (name, category, description, price, image_r2_key, is_published, sort_order)
VALUES
  ('Diesel Fuel Filter (Hino J08E)', 'engine', 'Genuine-fit fuel filter for Hino 500 Series J08E engines.', 850, 'seed/spare-parts/fuel-filter.jpg', 1, 0),
  ('Brake Pad Set (Isuzu ELF NHR)', 'brakes', 'Front brake pad set for Isuzu ELF NHR light trucks.', 2400, 'seed/spare-parts/brake-pads.jpg', 1, 1),
  ('Hydraulic Main Pump (Komatsu PC200)', 'hydraulics', 'Reconditioned hydraulic main pump for PC200-class excavators. Inquire for availability.', NULL, 'seed/spare-parts/hydraulic-pump.jpg', 1, 2),
  ('Alternator 24V 50A', 'electrical', 'Heavy-duty 24V alternator suitable for most Japanese trucks.', 6500, 'seed/spare-parts/alternator.jpg', 1, 3),
  ('Excavator Bucket Teeth (set of 5)', 'attachments', 'Replacement bucket teeth set for 20-ton class excavators.', 3200, 'seed/spare-parts/bucket-teeth.jpg', 1, 4);

-- ── announcements (spec §4.4) — 2 published, 1 draft ────────────────────────
INSERT INTO announcements (slug, title, excerpt, body, cover_image_r2_key, author, is_published, published_at, created_at, updated_at)
VALUES
  ('now-open-togomoto-trucks', 'Now Open: Togomoto Trucks & Equipment',
    'Togomoto Trucks & Equipment is now serving used cars, trucks, and heavy equipment.',
    '# Now Open

Togomoto Trucks & Equipment is now open for business. We bring you a quality selection of used cars, trucks, and heavy equipment, imported from Japan and inspected before listing.

Visit us or [send an inquiry](/contact) — our team is ready to help you find the right unit.',
    'seed/announcements/now-open.jpg', 'Togomoto Team', 1, unixepoch() - 2*86400, unixepoch() - 2*86400, unixepoch() - 2*86400),

  ('new-arrivals-japan-surplus-excavators', 'New Arrivals: Japan-Surplus Excavators',
    'Fresh batch of low-hour excavators from Japan auctions, now available for viewing.',
    '## New Arrivals

We have just received a fresh batch of **Japan-surplus excavators**, including Komatsu and Kobelco units with low operating hours.

- Inspected undercarriages
- Tested hydraulics
- Ready for immediate deployment

Browse the [heavy equipment listings](/products/used-heavy-equipment) or inquire about a unit walkthrough.',
    'seed/announcements/new-excavators.jpg', 'Togomoto Team', 1, unixepoch() - 1*86400, unixepoch() - 1*86400, unixepoch() - 1*86400),

  ('holiday-schedule-2026', 'Holiday Schedule 2026 (Draft)',
    'Our adjusted hours for the upcoming holidays.',
    '# Holiday Schedule

This is a **draft** announcement kept to test the publish toggle. Final holiday hours will be posted soon.',
    NULL, 'Togomoto Team', 0, NULL, unixepoch() - 0*86400, unixepoch() - 0*86400);
