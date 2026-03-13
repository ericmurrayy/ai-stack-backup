-- Murray's FSM - Demo Data Seed Script
-- ======================================
-- Run this against your Supabase database to populate realistic demo data
-- for all dashboard pages. This will make all pages come alive.

-- NOTE: Replace 'YOUR_OWNER_ID' with your actual auth.users UUID
-- You can find it in Supabase Dashboard -> Authentication -> Users

DO $$
DECLARE
  v_owner_id UUID;
  v_tech1_id UUID := gen_random_uuid();
  v_tech2_id UUID := gen_random_uuid();
  v_tech3_id UUID := gen_random_uuid();
  v_tech4_id UUID := gen_random_uuid();
  v_cust1_id UUID := gen_random_uuid();
  v_cust2_id UUID := gen_random_uuid();
  v_cust3_id UUID := gen_random_uuid();
  v_cust4_id UUID := gen_random_uuid();
  v_cust5_id UUID := gen_random_uuid();
  v_cust6_id UUID := gen_random_uuid();
  v_cust7_id UUID := gen_random_uuid();
  v_cust8_id UUID := gen_random_uuid();
  v_loc1_id UUID := gen_random_uuid();
  v_loc2_id UUID := gen_random_uuid();
  v_loc3_id UUID := gen_random_uuid();
  v_loc4_id UUID := gen_random_uuid();
  v_loc5_id UUID := gen_random_uuid();
  v_job1_id UUID := gen_random_uuid();
  v_job2_id UUID := gen_random_uuid();
  v_job3_id UUID := gen_random_uuid();
  v_job4_id UUID := gen_random_uuid();
  v_job5_id UUID := gen_random_uuid();
  v_job6_id UUID := gen_random_uuid();
  v_job7_id UUID := gen_random_uuid();
  v_job8_id UUID := gen_random_uuid();
  v_job9_id UUID := gen_random_uuid();
  v_job10_id UUID := gen_random_uuid();
  v_est1_id UUID := gen_random_uuid();
  v_est2_id UUID := gen_random_uuid();
  v_est3_id UUID := gen_random_uuid();
  v_est4_id UUID := gen_random_uuid();
  v_stage1_id UUID := gen_random_uuid();
  v_stage2_id UUID := gen_random_uuid();
  v_stage3_id UUID := gen_random_uuid();
  v_stage4_id UUID := gen_random_uuid();
  v_stage5_id UUID := gen_random_uuid();
BEGIN

-- Get the first user as owner (or set manually)
SELECT id INTO v_owner_id FROM auth.users LIMIT 1;
IF v_owner_id IS NULL THEN
  RAISE EXCEPTION 'No auth user found. Please sign up first, then run this seed.';
END IF;

RAISE NOTICE 'Seeding demo data for owner: %', v_owner_id;

-- ================================================================
-- 1. TECHNICIANS
-- ================================================================
INSERT INTO technicians (id, owner_id, name, email, phone, role, color, skills, specialties, is_active, hourly_rate_cents, deleted) VALUES
  (v_tech1_id, v_owner_id, 'Marcus Williams', 'marcus@murraysfsm.com', '(555) 101-0001', 'lead', '#3B82F6', ARRAY['plumbing', 'hvac'], ARRAY['water_heater', 'drain_cleaning', 'ac_repair'], true, 4500, false),
  (v_tech2_id, v_owner_id, 'James Rodriguez', 'james@murraysfsm.com', '(555) 101-0002', 'senior', '#10B981', ARRAY['electrical', 'plumbing'], ARRAY['panel_upgrade', 'rewiring', 'leak_repair'], true, 4000, false),
  (v_tech3_id, v_owner_id, 'Sarah Chen', 'sarah@murraysfsm.com', '(555) 101-0003', 'technician', '#8B5CF6', ARRAY['hvac', 'general'], ARRAY['furnace_repair', 'ac_install', 'duct_work'], true, 3500, false),
  (v_tech4_id, v_owner_id, 'David Thompson', 'david@murraysfsm.com', '(555) 101-0004', 'apprentice', '#F59E0B', ARRAY['plumbing', 'general'], ARRAY['faucet_repair', 'toilet_install'], true, 2500, false)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 2. CUSTOMERS
-- ================================================================
INSERT INTO customers (id, owner_id, name, email, phone, source, tags, notes, deleted) VALUES
  (v_cust1_id, v_owner_id, 'Jennifer Martinez', 'jennifer.m@email.com', '(555) 200-0001', 'google', ARRAY['residential', 'vip'], 'Long-time customer, always pays on time', false),
  (v_cust2_id, v_owner_id, 'Robert Johnson', 'robert.j@email.com', '(555) 200-0002', 'referral', ARRAY['residential'], 'Referred by Jennifer Martinez', false),
  (v_cust3_id, v_owner_id, 'ABC Property Management', 'admin@abcproperty.com', '(555) 200-0003', 'website', ARRAY['commercial', 'vip'], 'Manages 12 apartment complexes', false),
  (v_cust4_id, v_owner_id, 'Thomas Wilson', 'tom.w@email.com', '(555) 200-0004', 'google', ARRAY['residential'], NULL, false),
  (v_cust5_id, v_owner_id, 'Maria Gonzalez', 'maria.g@email.com', '(555) 200-0005', 'facebook', ARRAY['residential'], 'Prefers text messages', false),
  (v_cust6_id, v_owner_id, 'Sunrise Restaurant', 'manager@sunrise.com', '(555) 200-0006', 'website', ARRAY['commercial'], 'Commercial kitchen — requires special permits', false),
  (v_cust7_id, v_owner_id, 'Karen Smith', 'karen.s@email.com', '(555) 200-0007', 'nextdoor', ARRAY['residential'], NULL, false),
  (v_cust8_id, v_owner_id, 'Mike Davis', 'mike.d@email.com', '(555) 200-0008', 'referral', ARRAY['residential', 'new'], 'New customer from referral program', false)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 3. LOCATIONS
-- ================================================================
INSERT INTO locations (id, owner_id, customer_id, address_line1, city, state, zip_code, is_primary, deleted) VALUES
  (v_loc1_id, v_owner_id, v_cust1_id, '123 Oak Street', 'Austin', 'TX', '78701', true, false),
  (v_loc2_id, v_owner_id, v_cust2_id, '456 Elm Avenue', 'Austin', 'TX', '78702', true, false),
  (v_loc3_id, v_owner_id, v_cust3_id, '789 Commerce Blvd, Suite 100', 'Austin', 'TX', '78703', true, false),
  (v_loc4_id, v_owner_id, v_cust4_id, '321 Pine Lane', 'Round Rock', 'TX', '78664', true, false),
  (v_loc5_id, v_owner_id, v_cust5_id, '654 Maple Drive', 'Cedar Park', 'TX', '78613', true, false)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 4. JOBS (mix of statuses for realistic dashboard)
-- ================================================================
INSERT INTO jobs (id, owner_id, customer_id, location_id, title, description, status, service_category, urgency, assigned_technician_id, scheduled_at, scheduled_start, scheduled_end, is_spam, created_at) VALUES
  -- Today's jobs
  (v_job1_id, v_owner_id, v_cust1_id, v_loc1_id, 'Water Heater Replacement', 'Customer reports no hot water. 40-gallon gas unit needs replacement.', 'in_progress', 'plumbing', 'high', v_tech1_id, NOW(), NOW() + interval '1 hour', NOW() + interval '4 hours', false, NOW() - interval '2 days'),
  (v_job2_id, v_owner_id, v_cust2_id, v_loc2_id, 'Electrical Panel Inspection', 'Annual electrical panel inspection and safety check.', 'scheduled', 'electrical', 'medium', v_tech2_id, NOW() + interval '2 hours', NOW() + interval '3 hours', NOW() + interval '5 hours', false, NOW() - interval '1 day'),
  (v_job3_id, v_owner_id, v_cust3_id, v_loc3_id, 'HVAC Filter Change - All Units', 'Quarterly filter change for 24 units in Building A.', 'scheduled', 'hvac', 'low', v_tech3_id, NOW() + interval '4 hours', NOW() + interval '5 hours', NOW() + interval '8 hours', false, NOW() - interval '3 days'),
  (v_job4_id, v_owner_id, v_cust4_id, v_loc4_id, 'Emergency Leak - Kitchen Ceiling', 'Active leak from upstairs bathroom into kitchen. Water damage spreading.', 'new', 'plumbing', 'emergency', NULL, NULL, NULL, NULL, false, NOW() - interval '30 minutes'),
  -- This week
  (v_job5_id, v_owner_id, v_cust5_id, v_loc5_id, 'AC Not Cooling', 'AC runs but blows warm air. Compressor may need recharge.', 'contacted', 'hvac', 'medium', v_tech3_id, NOW() + interval '1 day', NOW() + interval '1 day 9 hours', NOW() + interval '1 day 12 hours', false, NOW() - interval '4 hours'),
  (v_job6_id, v_owner_id, v_cust6_id, NULL, 'Grease Trap Cleaning', 'Monthly grease trap service for commercial kitchen.', 'scheduled', 'plumbing', 'low', v_tech4_id, NOW() + interval '2 days', NOW() + interval '2 days 8 hours', NOW() + interval '2 days 10 hours', false, NOW() - interval '5 days'),
  -- Completed
  (v_job7_id, v_owner_id, v_cust7_id, NULL, 'Toilet Replacement', 'Replace old toilet with new water-efficient model.', 'completed', 'plumbing', 'medium', v_tech1_id, NOW() - interval '3 days', NOW() - interval '3 days', NOW() - interval '3 days' + interval '2 hours', false, NOW() - interval '7 days'),
  (v_job8_id, v_owner_id, v_cust1_id, v_loc1_id, 'Garbage Disposal Install', 'Install new InSinkErator garbage disposal unit.', 'completed', 'plumbing', 'low', v_tech4_id, NOW() - interval '5 days', NOW() - interval '5 days', NOW() - interval '5 days' + interval '1 hour', false, NOW() - interval '10 days'),
  (v_job9_id, v_owner_id, v_cust2_id, v_loc2_id, 'Smoke Detector Replacement', 'Replace all smoke detectors in the home (6 units).', 'completed', 'electrical', 'medium', v_tech2_id, NOW() - interval '6 days', NOW() - interval '6 days', NOW() - interval '6 days' + interval '3 hours', false, NOW() - interval '12 days'),
  (v_job10_id, v_owner_id, v_cust3_id, v_loc3_id, 'Thermostat Upgrade', 'Upgrade to Nest thermostat for all office suites.', 'completed', 'hvac', 'low', v_tech3_id, NOW() - interval '8 days', NOW() - interval '8 days', NOW() - interval '8 days' + interval '4 hours', false, NOW() - interval '15 days')
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 5. ESTIMATES (including GBB grouping)
-- ================================================================
INSERT INTO estimates (id, owner_id, customer_id, location_id, title, status, total_cents, notes, valid_until, sent_at, approved_at, converted_job_id, deleted) VALUES
  (v_est1_id, v_owner_id, v_cust1_id, v_loc1_id, 'Water Heater Replacement — Good', 'approved', 285000, 'Basic 40-gallon gas water heater replacement', NOW() + interval '30 days', NOW() - interval '3 days', NOW() - interval '2 days', v_job1_id, false),
  (v_est2_id, v_owner_id, v_cust1_id, v_loc1_id, 'Water Heater Replacement — Better', 'sent', 435000, 'Standard 50-gallon gas water heater with 10-year warranty. ★ RECOMMENDED', NOW() + interval '30 days', NOW() - interval '3 days', NULL, NULL, false),
  (v_est3_id, v_owner_id, v_cust1_id, v_loc1_id, 'Water Heater Replacement — Best', 'sent', 685000, 'Tankless Rinnai water heater with lifetime warranty and smart home integration', NOW() + interval '30 days', NOW() - interval '3 days', NULL, NULL, false),
  (v_est4_id, v_owner_id, v_cust4_id, v_loc4_id, 'Emergency Leak Repair', 'draft', 150000, 'Estimated cost for ceiling leak repair and drywall patching', NOW() + interval '14 days', NULL, NULL, NULL, false)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 6. PIPELINE STAGES
-- ================================================================
INSERT INTO pipeline_stages (id, owner_id, name, color, sort_order, is_won, is_lost, deleted) VALUES
  (v_stage1_id, v_owner_id, 'New Lead', '#8B5CF6', 0, false, false, false),
  (v_stage2_id, v_owner_id, 'Qualified', '#3B82F6', 1, false, false, false),
  (v_stage3_id, v_owner_id, 'Proposal Sent', '#F59E0B', 2, false, false, false),
  (v_stage4_id, v_owner_id, 'Won', '#10B981', 3, true, false, false),
  (v_stage5_id, v_owner_id, 'Lost', '#EF4444', 4, false, true, false)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 7. LEADS
-- ================================================================
INSERT INTO leads (id, owner_id, customer_id, name, email, phone, source, stage_id, estimated_value_cents, probability, notes, deleted) VALUES
  (gen_random_uuid(), v_owner_id, v_cust4_id, 'Thomas Wilson', 'tom.w@email.com', '(555) 200-0004', 'google', v_stage1_id, 350000, 30, 'Looking for emergency plumber', false),
  (gen_random_uuid(), v_owner_id, NULL, 'Patricia Brown', 'pat.b@email.com', '(555) 300-0001', 'facebook', v_stage2_id, 500000, 50, 'Wants whole-home repipe quote', false),
  (gen_random_uuid(), v_owner_id, NULL, 'Anderson HVAC Corp', 'sales@andersonhvac.com', '(555) 300-0002', 'website', v_stage3_id, 1200000, 70, 'Commercial HVAC contract for 3 buildings', false),
  (gen_random_uuid(), v_owner_id, v_cust1_id, 'Jennifer Martinez', 'jennifer.m@email.com', '(555) 200-0001', 'referral', v_stage4_id, 285000, 100, 'Water heater replacement — won', false),
  (gen_random_uuid(), v_owner_id, NULL, 'Quick Fix LLC', 'info@quickfix.com', '(555) 300-0003', 'google', v_stage5_id, 180000, 0, 'Went with competitor', false),
  (gen_random_uuid(), v_owner_id, NULL, 'Sandra Lee', 'sandra.l@email.com', '(555) 300-0004', 'nextdoor', v_stage2_id, 450000, 60, 'Tankless water heater upgrade', false)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 8. REVIEWS
-- ================================================================
INSERT INTO reviews (id, owner_id, customer_id, job_id, source, rating, review_text, response_text, reviewer_name, reviewed_at, deleted) VALUES
  (gen_random_uuid(), v_owner_id, v_cust1_id, v_job7_id, 'google', 5.0, 'Marcus did an amazing job replacing our toilet. Very professional and clean work!', 'Thank you Jennifer! We appreciate your kind words. — Murray''s FSM Team', 'Jennifer M.', NOW() - interval '2 days', false),
  (gen_random_uuid(), v_owner_id, v_cust2_id, v_job9_id, 'google', 4.5, 'James was very knowledgeable about electrical work. Replaced all our smoke detectors quickly.', 'Thanks Robert! Safety is our top priority. Glad we could help!', 'Robert J.', NOW() - interval '5 days', false),
  (gen_random_uuid(), v_owner_id, v_cust7_id, v_job8_id, 'yelp', 5.0, 'Garbage disposal installed in under an hour. Great price too!', NULL, 'Karen S.', NOW() - interval '4 days', false),
  (gen_random_uuid(), v_owner_id, v_cust3_id, v_job10_id, 'google', 4.0, 'Good work on the thermostat upgrades. One unit needed a follow-up adjustment but they came back same day.', 'We always stand behind our work. Thanks for the feedback!', 'ABC Property Mgmt', NOW() - interval '7 days', false),
  (gen_random_uuid(), v_owner_id, v_cust5_id, NULL, 'google', 5.0, 'Called about AC issue and they scheduled me for the next day. Very responsive!', NULL, 'Maria G.', NOW() - interval '1 day', false),
  (gen_random_uuid(), v_owner_id, NULL, NULL, 'yelp', 3.5, 'Work was fine but had to wait a week for the appointment.', 'We apologize for the wait time. We''re expanding our team to serve you faster!', 'Anonymous', NOW() - interval '14 days', false)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 9. SERVICE AGREEMENTS
-- ================================================================
INSERT INTO service_agreements (id, owner_id, customer_id, location_id, name, description, type, status, start_date, end_date, price_cents, billing_cycle, terms, deleted) VALUES
  (gen_random_uuid(), v_owner_id, v_cust1_id, v_loc1_id, 'Premium Home Maintenance Plan', 'Annual plumbing and HVAC maintenance with priority scheduling', 'maintenance', 'active', NOW() - interval '6 months', NOW() + interval '6 months', 19900, 'monthly', 'Includes 2 annual inspections, 10% off repairs, priority scheduling', false),
  (gen_random_uuid(), v_owner_id, v_cust3_id, v_loc3_id, 'Commercial HVAC Service Agreement', 'Quarterly HVAC maintenance for all building units', 'maintenance', 'active', NOW() - interval '3 months', NOW() + interval '9 months', 49900, 'quarterly', 'Quarterly filter changes, annual deep cleaning, emergency service within 4 hours', false),
  (gen_random_uuid(), v_owner_id, v_cust2_id, v_loc2_id, 'Electrical Safety Warranty', '2-year warranty on all electrical work performed', 'warranty', 'active', NOW() - interval '1 month', NOW() + interval '23 months', 9900, 'annual', 'Covers all electrical work for 2 years, includes annual inspection', false),
  (gen_random_uuid(), v_owner_id, v_cust5_id, v_loc5_id, 'Gold Membership', 'Priority service, annual tune-up, and discounts', 'membership', 'active', NOW() - interval '2 months', NOW() + interval '10 months', 14900, 'monthly', '15% off all services, same-day scheduling, annual HVAC and plumbing check', false)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 10. RECURRING JOBS
-- ================================================================
INSERT INTO recurring_jobs (id, owner_id, customer_id, location_id, title, service_type, description, rrule, duration_minutes, assigned_technician_id, is_active, next_occurrence_at, deleted) VALUES
  (gen_random_uuid(), v_owner_id, v_cust3_id, v_loc3_id, 'Quarterly HVAC Filter Change', 'hvac', 'Replace all HVAC filters in Building A (24 units)', 'RRULE:FREQ=MONTHLY;INTERVAL=3', 240, v_tech3_id, true, NOW() + interval '2 months', false),
  (gen_random_uuid(), v_owner_id, v_cust6_id, NULL, 'Monthly Grease Trap Service', 'plumbing', 'Clean and inspect grease trap per health code requirements', 'RRULE:FREQ=MONTHLY;INTERVAL=1', 120, v_tech4_id, true, NOW() + interval '25 days', false),
  (gen_random_uuid(), v_owner_id, v_cust1_id, v_loc1_id, 'Annual Plumbing Inspection', 'plumbing', 'Full home plumbing inspection as part of maintenance plan', 'RRULE:FREQ=YEARLY;INTERVAL=1', 180, v_tech1_id, true, NOW() + interval '5 months', false)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 11. CAMPAIGNS
-- ================================================================
INSERT INTO campaigns (id, owner_id, name, description, type, status, template_subject, template_body, stats, deleted) VALUES
  (gen_random_uuid(), v_owner_id, 'Spring AC Tune-Up Special', 'Get your AC ready for summer! $99 tune-up special.', 'email', 'completed', 'Is Your AC Ready for Summer? ☀️', E'Hi {{customer_name}},\n\nSpring is here! Book your AC tune-up for just $99 (regularly $149).\n\nCall us at (555) 100-0000 or book online.\n\nBest,\nMurray''s FSM', '{"sent": 245, "delivered": 238, "opened": 156, "clicked": 42, "converted": 12}', false),
  (gen_random_uuid(), v_owner_id, 'Referral Reward Program', 'Refer a friend, get $50 credit!', 'email', 'active', 'Give $25, Get $50 🎁', E'Hi {{customer_name}},\n\nLove our service? Refer a friend!\n\nThey get $25 off their first service, and YOU get $50 credit.\n\nShare your referral link: {{referral_link}}', '{"sent": 180, "delivered": 175, "opened": 98, "clicked": 34, "converted": 8}', false),
  (gen_random_uuid(), v_owner_id, 'Winter Pipe Protection', 'Don''t let pipes freeze this winter!', 'sms', 'draft', NULL, 'Murray''s FSM: Protect your pipes this winter! Book a pipe insulation service before Dec 1 and save 20%. Call (555) 100-0000.', '{"sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "converted": 0}', false)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 12. REFERRALS
-- ================================================================
INSERT INTO referrals (id, owner_id, referrer_customer_id, referred_customer_id, referred_name, referred_phone, referred_email, status, referrer_reward_cents, referred_reward_cents, notes, deleted) VALUES
  (gen_random_uuid(), v_owner_id, v_cust1_id, v_cust2_id, 'Robert Johnson', '(555) 200-0002', 'robert.j@email.com', 'converted', 5000, 2500, 'Robert booked electrical inspection', false),
  (gen_random_uuid(), v_owner_id, v_cust1_id, v_cust8_id, 'Mike Davis', '(555) 200-0008', 'mike.d@email.com', 'pending', 5000, 2500, NULL, false),
  (gen_random_uuid(), v_owner_id, v_cust7_id, NULL, 'Lisa Anderson', '(555) 400-0001', 'lisa.a@email.com', 'contacted', 5000, 2500, 'Called, scheduling first visit', false)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 13. INVENTORY ITEMS
-- ================================================================
INSERT INTO inventory_items (id, owner_id, name, sku, category, unit, quantity_on_hand, reorder_point, unit_cost_cents, unit_price_cents, deleted) VALUES
  (gen_random_uuid(), v_owner_id, '40-Gallon Gas Water Heater', 'WH-GAS-40', 'water_heaters', 'each', 3, 2, 45000, 85000, false),
  (gen_random_uuid(), v_owner_id, '50-Gallon Gas Water Heater', 'WH-GAS-50', 'water_heaters', 'each', 2, 1, 55000, 105000, false),
  (gen_random_uuid(), v_owner_id, 'Rinnai Tankless Water Heater', 'WH-TL-RINNAI', 'water_heaters', 'each', 1, 1, 120000, 225000, false),
  (gen_random_uuid(), v_owner_id, '1/2" Copper Pipe (10ft)', 'PIPE-CU-050', 'pipes', 'each', 25, 10, 1200, 2400, false),
  (gen_random_uuid(), v_owner_id, '3/4" PEX Pipe (100ft)', 'PIPE-PEX-075', 'pipes', 'roll', 8, 3, 4500, 8900, false),
  (gen_random_uuid(), v_owner_id, 'HVAC Air Filter 20x25x1', 'FILT-20251', 'filters', 'each', 48, 24, 500, 1500, false),
  (gen_random_uuid(), v_owner_id, 'InSinkErator Garbage Disposal', 'GD-ISE-EVOL', 'appliances', 'each', 4, 2, 15000, 32000, false),
  (gen_random_uuid(), v_owner_id, 'Nest Thermostat', 'THERM-NEST-3', 'controls', 'each', 6, 3, 18000, 35000, false),
  (gen_random_uuid(), v_owner_id, 'Smoke Detector (Kidde)', 'SD-KIDDE-10Y', 'safety', 'each', 15, 10, 2500, 5000, false),
  (gen_random_uuid(), v_owner_id, 'R-410A Refrigerant (25lb)', 'REF-410A-25', 'refrigerants', 'cylinder', 3, 2, 15000, 28000, false)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 14. NOTIFICATIONS
-- ================================================================
INSERT INTO notifications (id, owner_id, title, body, type, entity_type, entity_id, is_read, created_at) VALUES
  (gen_random_uuid(), v_owner_id, 'Emergency Job: Kitchen Ceiling Leak', 'Thomas Wilson reported an active leak. Needs immediate dispatch.', 'job_assigned', 'job', v_job4_id::text, false, NOW() - interval '30 minutes'),
  (gen_random_uuid(), v_owner_id, 'Estimate Approved: Water Heater Replacement', 'Jennifer Martinez approved the Good tier estimate for $2,850.', 'estimate_approved', 'estimate', v_est1_id::text, false, NOW() - interval '2 days'),
  (gen_random_uuid(), v_owner_id, 'New 5-Star Review', 'Maria G. left a 5-star review on Google: "Very responsive!"', 'review_received', 'review', NULL, false, NOW() - interval '1 day'),
  (gen_random_uuid(), v_owner_id, 'Job Completed: Toilet Replacement', 'Marcus Williams completed the toilet replacement at Karen Smith''s home.', 'job_completed', 'job', v_job7_id::text, true, NOW() - interval '3 days'),
  (gen_random_uuid(), v_owner_id, 'Low Stock Alert: Rinnai Tankless Water Heater', 'Only 1 unit remaining. Reorder point is 1.', 'low_stock', 'inventory', NULL, false, NOW() - interval '4 hours'),
  (gen_random_uuid(), v_owner_id, 'Payment Received: $450.00', 'Payment received from Robert Johnson for electrical panel inspection.', 'payment_received', 'payment', NULL, true, NOW() - interval '5 days')
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 15. CALL & MESSAGE LOGS
-- ================================================================
INSERT INTO call_logs (id, owner_id, customer_id, direction, duration_seconds, recording_url, notes, created_at) VALUES
  (gen_random_uuid(), v_owner_id, v_cust4_id, 'inbound', 180, NULL, 'Thomas called about kitchen ceiling leak — emergency', NOW() - interval '30 minutes'),
  (gen_random_uuid(), v_owner_id, v_cust1_id, 'outbound', 120, NULL, 'Called Jennifer to confirm water heater installation time', NOW() - interval '2 days'),
  (gen_random_uuid(), v_owner_id, v_cust5_id, 'inbound', 90, NULL, 'Maria called about AC not cooling, scheduled for tomorrow', NOW() - interval '4 hours'),
  (gen_random_uuid(), v_owner_id, v_cust3_id, 'outbound', 300, NULL, 'Discussed quarterly HVAC contract renewal with ABC Property', NOW() - interval '3 days'),
  (gen_random_uuid(), v_owner_id, v_cust6_id, 'inbound', 60, NULL, 'Sunrise Restaurant confirming grease trap appointment', NOW() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO message_logs (id, owner_id, customer_id, direction, body, channel, created_at) VALUES
  (gen_random_uuid(), v_owner_id, v_cust1_id, 'outbound', 'Hi Jennifer! Your water heater installation is confirmed for today at 9 AM. Marcus will be your technician. - Murray''s FSM', 'sms', NOW() - interval '6 hours'),
  (gen_random_uuid(), v_owner_id, v_cust5_id, 'inbound', 'Hi, my AC stopped cooling. Can someone come look at it?', 'sms', NOW() - interval '5 hours'),
  (gen_random_uuid(), v_owner_id, v_cust5_id, 'outbound', 'Hi Maria! We have Sarah available tomorrow at 9 AM. Does that work for you?', 'sms', NOW() - interval '4 hours'),
  (gen_random_uuid(), v_owner_id, v_cust5_id, 'inbound', 'Yes that works! Thank you', 'sms', NOW() - interval '4 hours'),
  (gen_random_uuid(), v_owner_id, v_cust4_id, 'outbound', 'Thomas, we received your emergency request. A technician is being dispatched ASAP. - Murray''s FSM', 'sms', NOW() - interval '25 minutes'),
  (gen_random_uuid(), v_owner_id, v_cust7_id, 'outbound', 'Hi Karen! Would you mind leaving us a review? Here''s the link: https://g.page/murraysfsm/review', 'sms', NOW() - interval '3 days')
ON CONFLICT (id) DO NOTHING;

RAISE NOTICE '✅ Demo data seeded successfully!';
RAISE NOTICE 'Technicians: 4, Customers: 8, Jobs: 10, Estimates: 4, Leads: 6';
RAISE NOTICE 'Reviews: 6, Agreements: 4, Recurring: 3, Campaigns: 3, Referrals: 3';
RAISE NOTICE 'Notifications: 6, Calls: 5, Messages: 6, Inventory: 10';

END $$;
