const { pool } = require('./db');
const bcrypt = require('bcryptjs');

async function initDb() {
  const client = await pool.connect();
  try {
    console.log('--- Initializing Database Schema (Raw SQL) ---');

    await client.query('BEGIN');

    // 0. Users Table (Authentication)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'distributor_owner',
        phone VARCHAR(20),
        status VARCHAR(20) DEFAULT 'active',
        permissions JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]';
    `);

    // 1. Companies Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Beats Table (Routes)
    await client.query(`
      CREATE TABLE IF NOT EXISTS beats (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        route_code VARCHAR(50) NOT NULL,
        day_of_week VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Outlets Table (Retailers)
    await client.query(`
      CREATE TABLE IF NOT EXISTS outlets (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_name VARCHAR(255) NOT NULL,
        route VARCHAR(100) NOT NULL,
        beat_id VARCHAR(50) REFERENCES beats(id) ON DELETE SET NULL,
        channel VARCHAR(50) NOT NULL DEFAULT 'General Trade',
        gstin VARCHAR(50),
        phone VARCHAR(20) NOT NULL,
        credit_limit NUMERIC(12, 2) DEFAULT 0,
        credit_days INTEGER DEFAULT 0,
        current_balance NUMERIC(12, 2) DEFAULT 0,
        overdue_days INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. SKUs Table (Products & Master Inventory)
    await client.query(`
      CREATE TABLE IF NOT EXISTS skus (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        barcode VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE SET NULL,
        company_name VARCHAR(100) NOT NULL,
        brand VARCHAR(100) NOT NULL,
        mrp NUMERIC(10, 2) NOT NULL,
        rate NUMERIC(10, 2) NOT NULL,
        uom VARCHAR(50) NOT NULL,
        units_per_case INTEGER NOT NULL DEFAULT 1,
        gst_percent NUMERIC(5, 2) NOT NULL DEFAULT 18,
        stock_cases INTEGER NOT NULL DEFAULT 0,
        stock_pcs INTEGER NOT NULL DEFAULT 0,
        must_sell BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Purchase Orders Table (Primary Inward from FMCG Companies)
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id VARCHAR(50) PRIMARY KEY,
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE SET NULL,
        company_name VARCHAR(255) NOT NULL,
        po_date VARCHAR(50) NOT NULL,
        total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'In Transit',
        grn_status VARCHAR(100) NOT NULL DEFAULT 'Pending GRN Scan',
        items_count INTEGER DEFAULT 0,
        dispatch_ref VARCHAR(100),
        invoice_number VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Purchase Order Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        po_id VARCHAR(50) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        sku_id VARCHAR(50) REFERENCES skus(id) ON DELETE RESTRICT,
        sku_name VARCHAR(255) NOT NULL,
        cases_ordered INTEGER NOT NULL DEFAULT 0,
        pcs_ordered INTEGER NOT NULL DEFAULT 0,
        cases_received INTEGER NOT NULL DEFAULT 0,
        pcs_received INTEGER NOT NULL DEFAULT 0,
        rate NUMERIC(10, 2) NOT NULL,
        amount NUMERIC(14, 2) NOT NULL,
        batch_number VARCHAR(50),
        expiry_date VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 7. Stock Batches Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_batches (
        id SERIAL PRIMARY KEY,
        sku_id VARCHAR(50) REFERENCES skus(id) ON DELETE CASCADE,
        batch_number VARCHAR(100) NOT NULL,
        mfg_date VARCHAR(50),
        expiry_date VARCHAR(50) NOT NULL,
        days_to_expiry INTEGER DEFAULT 180,
        cases_available INTEGER NOT NULL DEFAULT 0,
        pcs_available INTEGER NOT NULL DEFAULT 0,
        location VARCHAR(100) DEFAULT 'Main Godown (Bay A)',
        status VARCHAR(50) DEFAULT 'Healthy',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. Schemes Table (Trade Schemes & Offers)
    await client.query(`
      CREATE TABLE IF NOT EXISTS schemes (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE SET NULL,
        company_name VARCHAR(100) NOT NULL,
        category VARCHAR(100) NOT NULL,
        condition_desc VARCHAR(255) NOT NULL,
        benefit_desc VARCHAR(255) NOT NULL,
        funded_by VARCHAR(50) NOT NULL DEFAULT 'Company-funded',
        budget_used NUMERIC(12, 2) DEFAULT 0,
        budget_total NUMERIC(12, 2) DEFAULT 50000,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 9. Claims Table (Reimbursement Claims from Principal FMCG Companies)
    await client.query(`
      CREATE TABLE IF NOT EXISTS claims (
        id VARCHAR(50) PRIMARY KEY,
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE SET NULL,
        company VARCHAR(100) NOT NULL,
        claim_type VARCHAR(100) NOT NULL,
        period VARCHAR(50) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        age_days INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Submitted',
        query_note TEXT,
        free_goods_list BOOLEAN DEFAULT TRUE,
        outlet_list_gst BOOLEAN DEFAULT TRUE,
        circular_linked BOOLEAN DEFAULT TRUE,
        format_generated BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 10. Sales Orders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales_orders (
        id VARCHAR(50) PRIMARY KEY,
        outlet_id VARCHAR(50) REFERENCES outlets(id) ON DELETE RESTRICT,
        outlet_name VARCHAR(255) NOT NULL,
        route VARCHAR(100) NOT NULL,
        source VARCHAR(50) DEFAULT 'Salesman',
        salesman_name VARCHAR(100),
        order_date VARCHAR(50) NOT NULL,
        delivery_date VARCHAR(50) NOT NULL,
        lines_count INTEGER DEFAULT 0,
        total_value NUMERIC(12, 2) DEFAULT 0,
        scheme_total NUMERIC(12, 2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Pending',
        check_status VARCHAR(50) DEFAULT 'OK',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 11. Sales Order Lines Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales_order_lines (
        id SERIAL PRIMARY KEY,
        order_id VARCHAR(50) REFERENCES sales_orders(id) ON DELETE CASCADE,
        sku_id VARCHAR(50) REFERENCES skus(id) ON DELETE RESTRICT,
        sku_name VARCHAR(255) NOT NULL,
        qty_cases INTEGER NOT NULL DEFAULT 0,
        qty_pcs INTEGER NOT NULL DEFAULT 0,
        rate NUMERIC(10, 2) NOT NULL,
        scheme_desc VARCHAR(255),
        scheme_discount NUMERIC(10, 2) DEFAULT 0,
        amount NUMERIC(12, 2) NOT NULL,
        free_goods_desc VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 12. Collections & Payment Receipts Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS collections (
        id VARCHAR(50) PRIMARY KEY,
        outlet_id VARCHAR(50) REFERENCES outlets(id) ON DELETE RESTRICT,
        outlet_name VARCHAR(255) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        payment_mode VARCHAR(50) NOT NULL DEFAULT 'Cash',
        reference_no VARCHAR(100),
        collection_date VARCHAR(50) NOT NULL,
        salesman_name VARCHAR(100) DEFAULT 'Counter / Direct',
        notes TEXT,
        status VARCHAR(50) DEFAULT 'Cleared',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- SEED INITIAL DATA IF EMPTY ---

    // 1. Seed Users (if empty or only 1 owner)
    const usersCheck = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(usersCheck.rows[0].count, 10) <= 1) {
      console.log('Seeding initial Enterprise Staff Users...');
      const defaultPasswordHash = await bcrypt.hash('admin123', 10);
      await client.query(`
        INSERT INTO users (id, name, email, password_hash, role, phone, permissions, status) VALUES
        ('usr-owner', 'Mr. Agarwal (Distributor)', 'admin@distributor.com', '${defaultPasswordHash}', 'distributor_owner', '9810012345', '["/","/orders-billing","/van-sales","/outlets-beats","/purchase","/godown","/delivery-fleet","/schemes","/claims","/collections","/accounts","/field-team","/reports","/settings","/manage-team"]', 'active'),
        ('usr-mgr', 'Rohit Sharma (Branch Manager)', 'manager@distributor.com', '${defaultPasswordHash}', 'manager', '9811002201', '["/","/orders-billing","/godown","/purchase","/outlets-beats","/delivery-fleet","/collections","/reports"]', 'active'),
        ('usr-bill', 'Vikas Gupta (Billing Desk)', 'billing@distributor.com', '${defaultPasswordHash}', 'billing_operator', '9811002202', '["/","/orders-billing","/delivery-fleet","/outlets-beats"]', 'active'),
        ('usr-godown', 'Deepak Verma (Godown Incharge)', 'godown@distributor.com', '${defaultPasswordHash}', 'godown_manager', '9811002203', '["/","/godown","/purchase"]', 'active'),
        ('usr-cashier', 'Suresh Jain (Cashier & Accounts)', 'cashier@distributor.com', '${defaultPasswordHash}', 'cashier', '9811002204', '["/","/collections","/accounts","/outlets-beats"]', 'active')
        ON CONFLICT (email) DO NOTHING;
      `);
    }

    // 2. Seed Companies
    const compCheck = await client.query('SELECT COUNT(*) FROM companies');
    if (parseInt(compCheck.rows[0].count, 10) === 0) {
      console.log('Seeding initial FMCG Companies...');
      await client.query(`
        INSERT INTO companies (id, name, category) VALUES
        ('comp-a', 'Company A · Personal Care', 'Personal Care'),
        ('comp-b', 'Company B · Foods', 'Foods & Confectionery'),
        ('comp-c', 'Company C · Beverages', 'Beverages & Juices'),
        ('comp-d', 'Company D · Home Care', 'Home & Fabric Care');
      `);
    }

    // 3. Seed Beats
    const beatsCheck = await client.query('SELECT COUNT(*) FROM beats');
    if (parseInt(beatsCheck.rows[0].count, 10) === 0) {
      console.log('Seeding initial Beats / Routes...');
      await client.query(`
        INSERT INTO beats (id, name, route_code, day_of_week) VALUES
        ('beat-1', 'Gandhi Nagar (Route R4)', 'R4', 'Monday'),
        ('beat-2', 'Station Road (Route R2)', 'R2', 'Tuesday'),
        ('beat-3', 'Old Market (Route R3)', 'R3', 'Wednesday'),
        ('beat-4', 'Civil Lines (Route R1)', 'R1', 'Thursday'),
        ('beat-5', 'Industrial Area (Route R5)', 'R5', 'Friday'),
        ('beat-6', 'Main Bazaar (Route R6)', 'R6', 'Saturday');
      `);
    }

    // 4. Seed Outlets
    const outletsCheck = await client.query('SELECT COUNT(*) FROM outlets');
    if (parseInt(outletsCheck.rows[0].count, 10) === 0) {
      console.log('Seeding initial Retail Outlets...');
      await client.query(`
        INSERT INTO outlets (id, name, owner_name, route, beat_id, channel, gstin, phone, credit_limit, credit_days, current_balance, overdue_days, status) VALUES
        ('out-1', 'Gupta Kirana Store', 'Ramesh Gupta', 'R4 Gandhi Nagar', 'beat-1', 'General Trade', '07AAAAA0000A1Z5', '9811001122', 50000, 14, 18500, 5, 'active'),
        ('out-2', 'Shree Ram General Store', 'Ram Kumar', 'R2 Station Road', 'beat-2', 'General Trade', '07BBBBB0000B1Z6', '9822002233', 40000, 14, 12400, 2, 'active'),
        ('out-3', 'Apollo Mart Superstore', 'Sanjay Verma', 'R1 Civil Lines', 'beat-4', 'Modern Trade', '07CCCCC0000C1Z7', '9833003344', 150000, 30, 84000, 12, 'active'),
        ('out-4', 'Hotel Sagar (HoReCa)', 'Sagar Joshi', 'R4 Gandhi Nagar', 'beat-1', 'HoReCa', '07DDDDD0000D1Z8', '9844004455', 60000, 7, 28000, 8, 'active'),
        ('out-5', 'Ma Durga Traders (wholesale)', 'Durga Prasad', 'R6 Main Bazaar', 'beat-6', 'Wholesale', '07EEEEE0000E1Z9', '9855005566', 200000, 21, 142000, 22, 'active'),
        ('out-6', 'City Daily Needs', 'Arun Sharma', 'R3 Old Market', 'beat-3', 'General Trade', '07FFFFF0000F1Z0', '9866006677', 45000, 14, 21500, 16, 'active');
      `);
    }

    // 5. Seed SKUs (Products)
    const skusCheck = await client.query('SELECT COUNT(*) FROM skus');
    if (parseInt(skusCheck.rows[0].count, 10) === 0) {
      console.log('Seeding initial FMCG SKUs...');
      await client.query(`
        INSERT INTO skus (id, name, code, barcode, company_id, company_name, brand, mrp, rate, uom, units_per_case, gst_percent, stock_cases, stock_pcs, must_sell) VALUES
        ('sku-1', 'Premium CTC Tea 250g', 'TEA-250', '890103001', 'comp-a', 'Company A · Personal Care', 'Red Label', 140, 125, 'Pcs', 24, 5, 45, 12, true),
        ('sku-2', 'Glucose Biscuits 100g', 'BIS-GLU', '890103002', 'comp-b', 'Company B · Foods', 'Parle-G', 10, 8.5, 'Pcs', 60, 5, 120, 30, false),
        ('sku-3', 'Cold Beverage Lime 600ml', 'BEV-COLD', '890103003', 'comp-c', 'Company C · Beverages', 'Sprite', 40, 34, 'Pcs', 24, 28, 65, 15, true),
        ('sku-4', 'Dishwash Bar Lemon 150g', 'DISH-BAR', '890103004', 'comp-d', 'Company D · Home Care', 'Vim', 20, 17, 'Pcs', 48, 18, 80, 20, false),
        ('sku-5', 'Hair Fall Shampoo 180ml', 'SHM-180', '890103005', 'comp-a', 'Company A · Personal Care', 'Clinic Plus', 120, 102, 'Pcs', 36, 18, 35, 8, false),
        ('sku-6', 'Chakki Fresh Atta 5kg', 'ATT-5KG', '890103006', 'comp-b', 'Company B · Foods', 'Aashirvaad', 245, 215, 'Pcs', 4, 0, 95, 2, true);
      `);
    }

    // 6. Seed Stock Batches
    const batchCheck = await client.query('SELECT COUNT(*) FROM stock_batches');
    if (parseInt(batchCheck.rows[0].count, 10) === 0) {
      console.log('Seeding initial Godown Stock Batches...');
      await client.query(`
        INSERT INTO stock_batches (sku_id, batch_number, mfg_date, expiry_date, days_to_expiry, cases_available, pcs_available, location, status) VALUES
        ('sku-1', 'BAT-TEA-09', '01/09/2026', '01/09/2027', 315, 30, 0, 'Main Godown (Bay A)', 'Healthy'),
        ('sku-1', 'BAT-TEA-08', '01/08/2026', '01/08/2027', 285, 15, 12, 'Main Godown (Bay A)', 'Healthy'),
        ('sku-2', 'BAT-BIS-10', '10/10/2026', '10/04/2027', 140, 80, 0, 'Foods Section (Bay B)', 'Healthy'),
        ('sku-2', 'BAT-BIS-08', '05/08/2026', '05/02/2027', 75, 40, 30, 'Foods Section (Bay B)', 'Near Expiry'),
        ('sku-3', 'BAT-BEV-09', '15/09/2026', '15/03/2027', 115, 65, 15, 'Beverages Cold Room', 'Healthy'),
        ('sku-4', 'BAT-DISH-07', '01/07/2026', '01/07/2028', 610, 80, 20, 'Home Care Bay C', 'Healthy'),
        ('sku-5', 'BAT-SHM-09', '01/09/2026', '01/09/2028', 670, 35, 8, 'Personal Care Shelf', 'Healthy'),
        ('sku-6', 'BAT-ATT-10', '01/10/2026', '01/01/2027', 42, 95, 2, 'Main Godown (Bay D)', 'Near Expiry');
      `);
    }

    // 7. Seed Purchase Orders & Items
    const poCheck = await client.query('SELECT COUNT(*) FROM purchase_orders');
    if (parseInt(poCheck.rows[0].count, 10) === 0) {
      console.log('Seeding initial Purchase Orders...');
      await client.query(`
        INSERT INTO purchase_orders (id, company_id, company_name, po_date, total_amount, status, grn_status, items_count, dispatch_ref, invoice_number, notes) VALUES
        ('PO-26-801', 'comp-a', 'Company A · Personal Care', '21 Oct 2026', 142500, 'In Transit', 'Pending GRN Scan', 2, 'TRK-9921', 'INV-COMA-8812', 'Monthly Primary Inward'),
        ('PO-26-802', 'comp-b', 'Company B · Foods', '20 Oct 2026', 98400, 'Received & Audited', 'GRN Verified', 2, 'TRK-9833', 'INV-COMB-4410', 'Festive Stock-up'),
        ('PO-26-803', 'comp-c', 'Company C · Beverages', '18 Oct 2026', 65200, 'Received & Audited', 'GRN Verified', 1, 'TRK-7712', 'INV-COMC-1109', 'Cold Drink Replenishment');

        INSERT INTO purchase_order_items (po_id, sku_id, sku_name, cases_ordered, pcs_ordered, cases_received, pcs_received, rate, amount, batch_number, expiry_date) VALUES
        ('PO-26-801', 'sku-1', 'Premium CTC Tea 250g', 30, 0, 0, 0, 3000, 90000, 'BAT-TEA-09', '01/09/2027'),
        ('PO-26-801', 'sku-5', 'Hair Fall Shampoo 180ml', 15, 0, 0, 0, 3500, 52500, 'BAT-SHM-09', '01/09/2028'),
        ('PO-26-802', 'sku-2', 'Glucose Biscuits 100g', 100, 0, 100, 0, 510, 51000, 'BAT-BIS-10', '10/04/2027'),
        ('PO-26-802', 'sku-6', 'Chakki Fresh Atta 5kg', 55, 0, 55, 0, 860, 47400, 'BAT-ATT-10', '01/01/2027'),
        ('PO-26-803', 'sku-3', 'Cold Beverage Lime 600ml', 80, 0, 80, 0, 815, 65200, 'BAT-BEV-09', '15/03/2027');
      `);
    }

    // 8. Seed Sales Orders & Lines
    const soCheck = await client.query('SELECT COUNT(*) FROM sales_orders');
    if (parseInt(soCheck.rows[0].count, 10) === 0) {
      console.log('Seeding initial Sales Orders...');
      await client.query(`
        INSERT INTO sales_orders (id, outlet_id, outlet_name, route, source, salesman_name, order_date, delivery_date, lines_count, total_value, scheme_total, status, check_status) VALUES
        ('ORD-26-101', 'out-1', 'Gupta Kirana Store', 'R4 Gandhi Nagar', 'Salesman', 'Rakesh Sharma', 'Today, 09:45 AM', 'Tomorrow', 3, 14250, 450, 'Pending', 'OK'),
        ('ORD-26-102', 'out-2', 'Shree Ram General Store', 'R2 Station Road', 'Salesman', 'Anil Verma', 'Today, 10:15 AM', 'Tomorrow', 2, 8900, 200, 'Billed', 'OK'),
        ('ORD-26-103', 'out-3', 'Apollo Mart Superstore', 'R1 Civil Lines', 'Chain PO · EDI', 'Counter / Direct', 'Yesterday', 'Today', 4, 38400, 1200, 'Billed', 'OK'),
        ('ORD-26-104', 'out-4', 'Hotel Sagar (HoReCa)', 'R4 Gandhi Nagar', 'Phone', 'Rakesh Sharma', 'Yesterday', 'Today', 2, 19500, 600, 'Delivered', 'OK'),
        ('ORD-26-105', 'out-5', 'Ma Durga Traders (wholesale)', 'R6 Main Bazaar', 'Salesman', 'Dinesh Rawat', '21 Oct 2026', '22 Oct 2026', 5, 84200, 2500, 'Delivered', 'OK');

        INSERT INTO sales_order_lines (order_id, sku_id, sku_name, qty_cases, qty_pcs, rate, scheme_desc, scheme_discount, amount) VALUES
        ('ORD-26-101', 'sku-1', 'Premium CTC Tea 250g', 2, 0, 3000, '2% QPS Volume', 120, 5880),
        ('ORD-26-101', 'sku-2', 'Glucose Biscuits 100g', 10, 0, 510, '12+1 Free Deal', 255, 4845),
        ('ORD-26-101', 'sku-3', 'Cold Beverage Lime 600ml', 4, 0, 815, NULL, 0, 3260),
        ('ORD-26-102', 'sku-4', 'Dishwash Bar Lemon 150g', 5, 0, 816, 'Free 75g bar', 100, 3980),
        ('ORD-26-102', 'sku-6', 'Chakki Fresh Atta 5kg', 6, 0, 860, 'Festive discount', 100, 5060),
        ('ORD-26-103', 'sku-1', 'Premium CTC Tea 250g', 6, 0, 3000, '2% QPS', 360, 17640),
        ('ORD-26-103', 'sku-5', 'Hair Fall Shampoo 180ml', 4, 0, 3500, NULL, 0, 14000),
        ('ORD-26-103', 'sku-3', 'Cold Beverage Lime 600ml', 8, 0, 815, '₹500 subsidy', 500, 6020);
      `);
    }

    // Seed Collections if empty
    const collCheck = await client.query('SELECT COUNT(*) FROM collections');
    if (parseInt(collCheck.rows[0].count, 10) === 0) {
      console.log('Seeding initial Collections Receipts...');
      await client.query(`
        INSERT INTO collections (id, outlet_id, outlet_name, amount, payment_mode, reference_no, collection_date, salesman_name, notes, status) VALUES
        ('REC-26-901', 'out-1', 'Gupta Kirana Store', 4200, 'UPI', 'UPI/261099281', 'Today, 10:30 AM', 'Rakesh', 'Weekly beat collection', 'Cleared'),
        ('REC-26-902', 'out-2', 'Shree Ram General', 5000, 'Cash', 'CSH-0912', 'Yesterday', 'Rakesh', 'Part payment of balance', 'Cleared'),
        ('REC-26-903', 'out-4', 'Hotel Sagar (HoReCa)', 14200, 'Cheque', 'CHQ-88201', '21 Oct 2026', 'Imran Khan', 'Cheque clearing pending', 'In Clearing'),
        ('REC-26-904', 'out-5', 'Ma Durga Traders (wholesale)', 50000, 'NEFT', 'NEFT-AXIS-9921', '20 Oct 2026', 'Direct Account', 'Advance against wholesale order', 'Cleared');
      `);
    }

    // Seed Schemes if empty
    const schemesCheck = await client.query('SELECT COUNT(*) FROM schemes');
    if (parseInt(schemesCheck.rows[0].count, 10) === 0) {
      console.log('Seeding initial Trade Schemes...');
      await client.query(`
        INSERT INTO schemes (id, name, company_id, company_name, category, condition_desc, benefit_desc, funded_by, budget_used, budget_total, status) VALUES
        ('SCH-01', 'QPS 2% Volume Discount', 'comp-a', 'Company A · Personal Care', 'Tea 250 g', 'Orders ≥ ₹5,000', '2% off invoice value', 'Company-funded', 34200, 50000, 'Active'),
        ('SCH-02', 'Biscuits 12 + 1 Case Deal', 'comp-b', 'Company B · Foods', 'Biscuit ₹10 pack', 'Buy 12 cases', '1 case free (60 units)', 'Company-funded', 68400, 100000, 'Active'),
        ('SCH-03', 'Cooler Display Asset Subsidy', 'comp-c', 'Company C · Beverages', 'Cold Beverages', 'Planogram verified', '₹500 / outlet monthly', 'Company-funded', 22500, 30000, 'Active'),
        ('SCH-04', 'CleanMax Combo Bar Pack', 'comp-d', 'Company D · Home Care', 'Detergent & Bars', '1 Carton combo', 'Free 75 g dish bar per 4-pack', 'Distributor-funded', 12400, 20000, 'Active'),
        ('SCH-05', 'First Order Welcome Bonus', 'comp-a', 'Company A · Personal Care', 'All Brands', 'New outlet KYC complete', '₹250 flat bill discount', 'Company-funded', 8750, 15000, 'Active'),
        ('SCH-06', 'Festive Stock-up Slab', 'comp-b', 'Company B · Foods', 'Atta & Oils', 'Orders ≥ ₹25,000', '3.5% back via credit note', 'Company-funded', 89000, 120000, 'Active');
      `);
    }

    // Seed Claims if empty
    const claimsCheck = await client.query('SELECT COUNT(*) FROM claims');
    if (parseInt(claimsCheck.rows[0].count, 10) === 0) {
      console.log('Seeding initial Company Claims...');
      await client.query(`
        INSERT INTO claims (id, company_id, company, claim_type, period, amount, age_days, status, query_note, free_goods_list, outlet_list_gst, circular_linked, format_generated) VALUES
        ('CL-26-088', 'comp-a', 'Company A · Personal Care', 'Trade scheme (QPS)', 'Sep 2026', 482300, 8, 'Submitted', NULL, true, true, true, true),
        ('CL-26-086', 'comp-b', 'Company B · Foods', 'Free goods (12+1)', 'Sep 2026', 214600, 9, 'Query raised', '3 invoices outside circular billing period', true, true, true, true),
        ('CL-26-081', 'comp-c', 'Company C · Beverages', 'Damage / expiry', 'Aug 2026', 136900, 34, 'Audit done', NULL, false, true, true, true),
        ('CL-26-074', 'comp-a', 'Company A · Personal Care', 'Display / visibility', 'Aug 2026', 68000, 39, 'Credit note recd.', NULL, false, true, true, true),
        ('CL-26-061', 'comp-d', 'Company D · Home Care', 'Price drop (stock on hand)', 'Jul 2026', 92400, 71, 'Overdue', NULL, false, true, false, true),
        ('CL-26-058', 'comp-b', 'Company B · Foods', 'Transport subsidy', 'Jul 2026', 41200, 74, 'Overdue', NULL, false, true, false, true);
      `);
    }

    // 13. Salesmen (Field Team) Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS salesmen (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        beat_name VARCHAR(100) NOT NULL,
        planned_calls INTEGER DEFAULT 30,
        visited_calls INTEGER DEFAULT 0,
        productive_calls INTEGER DEFAULT 0,
        lpc NUMERIC(4, 1) DEFAULT 5.0,
        target_sales NUMERIC(12, 2) DEFAULT 50000,
        today_sales NUMERIC(12, 2) DEFAULT 0,
        must_sell_completed INTEGER DEFAULT 0,
        must_sell_total INTEGER DEFAULT 5,
        incentive_rate NUMERIC(4, 3) DEFAULT 0.048,
        status VARCHAR(20) DEFAULT 'On Beat',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed Salesmen if empty
    const smCheck = await client.query('SELECT COUNT(*) FROM salesmen');
    if (parseInt(smCheck.rows[0].count, 10) === 0) {
      console.log('Seeding initial Field Team Salesmen...');
      await client.query(`
        INSERT INTO salesmen (id, name, phone, beat_name, planned_calls, visited_calls, productive_calls, lpc, target_sales, today_sales, must_sell_completed, must_sell_total, status) VALUES
        ('SM-01', 'Rakesh Sharma', '9811001122', 'Gandhi Nagar', 32, 28, 22, 7.1, 50000, 48600, 5, 5, 'On Beat'),
        ('SM-02', 'Anil Verma', '9822002233', 'Station Road', 35, 31, 19, 5.2, 45000, 36900, 3, 5, 'On Beat'),
        ('SM-03', 'Farhan Akhtar', '9833003344', 'Old Market', 30, 18, 11, 4.6, 40000, 21400, 2, 5, 'On Beat'),
        ('SM-04', 'Manoj Kumar', '9844004455', 'Civil Lines', 28, 26, 21, 6.8, 50000, 44100, 5, 5, 'On Beat'),
        ('SM-05', 'Suresh Yadav', '9855005566', 'Industrial Area', 30, 24, 18, 5.8, 45000, 39200, 4, 5, 'On Beat'),
        ('SM-06', 'Dinesh Rawat', '9866006677', 'Main Bazaar', 34, 30, 24, 6.2, 55000, 51300, 5, 5, 'On Beat');
      `);
    }

    // 14. Delivery Trips (Fleet Dispatch & POD) Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS delivery_trips (
        id VARCHAR(50) PRIMARY KEY,
        vehicle VARCHAR(100) NOT NULL,
        driver VARCHAR(100) NOT NULL,
        route VARCHAR(100) NOT NULL,
        drops_total INTEGER DEFAULT 0,
        drops_completed INTEGER DEFAULT 0,
        total_value NUMERIC(12, 2) DEFAULT 0,
        cash_collected NUMERIC(12, 2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'In Transit',
        orders_list JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed initial delivery trips if empty
    const tripsCheck = await client.query('SELECT COUNT(*) FROM delivery_trips');
    if (parseInt(tripsCheck.rows[0].count, 10) === 0) {
      console.log('Seeding initial Delivery Fleet Trips...');
      await client.query(`
        INSERT INTO delivery_trips (id, vehicle, driver, route, drops_total, drops_completed, total_value, cash_collected, status) VALUES
        ('TRIP-R4-101', 'Tata Ace · DL 1L AA 2210', 'Manoj Kumar', 'R4 Gandhi Nagar', 26, 11, 148000, 86400, 'In Transit'),
        ('TRIP-R2-102', 'Mahindra Bolero · DL 1L BB 3390', 'Satish Pal', 'R2 Station Road', 31, 24, 196000, 142000, 'In Transit'),
        ('TRIP-R1-103', 'Tata Ace · DL 1L CC 7781', 'Raju Yadav', 'R1 Civil Lines', 18, 18, 112000, 112000, 'Settled & Completed');
      `);
    }

    // 15. System Settings Table (Distributor Profile, Statutory, Controls)
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id VARCHAR(50) PRIMARY KEY DEFAULT 'primary_config',
        distributor_name VARCHAR(255) NOT NULL DEFAULT 'Agarwal FMCG Distributors Pvt Ltd',
        trade_name VARCHAR(255) DEFAULT 'Agarwal Agency & Supply Hub',
        fssai_number VARCHAR(50) DEFAULT '10019011004421',
        gstin VARCHAR(50) DEFAULT '07AAACA1234A1Z5',
        pan_number VARCHAR(50) DEFAULT 'AAACA1234A',
        contact_email VARCHAR(100) DEFAULT 'admin@gmail.com',
        contact_phone VARCHAR(50) DEFAULT '+91 9811002233',
        address TEXT DEFAULT 'Plot 42, Okhla Industrial Area Phase-III, New Delhi 110020',
        city VARCHAR(100) DEFAULT 'New Delhi',
        state VARCHAR(100) DEFAULT 'Delhi (07)',
        pincode VARCHAR(20) DEFAULT '110020',
        credit_hard_stop BOOLEAN DEFAULT TRUE,
        max_credit_days INTEGER DEFAULT 21,
        auto_irn_generation BOOLEAN DEFAULT TRUE,
        dms_auto_sync BOOLEAN DEFAULT TRUE,
        van_reconciliation_lock BOOLEAN DEFAULT TRUE,
        whatsapp_alerts BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      INSERT INTO system_settings (id) VALUES ('primary_config')
      ON CONFLICT (id) DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('Database Schema & Collections initialized successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  initDb()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = initDb;
