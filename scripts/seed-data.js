import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment configurations
dotenv.config({ path: path.join(__dirname, '../.env') });
// Read core DB credentials from core env
dotenv.config({ path: path.join(__dirname, '../../core/.env') });

const coreConfig = {
  host: process.env.HRIS_CORE_DB_HOST || 'localhost',
  port: parseInt(process.env.HRIS_CORE_DB_PORT || '5432', 10),
  user: process.env.HRIS_CORE_DB_USER || 'vhalen',
  password: process.env.HRIS_CORE_DB_PASS || 'vhalen',
  database: process.env.HRIS_CORE_DB_NAME || 'hris_core_db',
};

const authConfig = {
  host: process.env.HRIS_AUTH_DB_HOST || 'localhost',
  port: parseInt(process.env.HRIS_AUTH_DB_PORT || '5432', 10),
  user: process.env.HRIS_AUTH_DB_USER || 'vhalen',
  password: process.env.HRIS_AUTH_DB_PASS || 'vhalen',
  database: process.env.HRIS_AUTH_DB_NAME || 'hris_auth_db',
};

async function seed() {
  console.log('====================================================');
  console.log('          HRIS DATABASE SEEDER SCRIPT               ');
  console.log('====================================================');
  
  const corePool = new pg.Pool(coreConfig);
  const authPool = new pg.Pool(authConfig);

  try {
    // 1. Clean existing records in correct order to avoid FK constraint failures
    console.log('[-] Membersihkan data lama di kedua database...');
    
    await corePool.query('TRUNCATE TABLE reporting_line_history RESTART IDENTITY CASCADE');
    await corePool.query('TRUNCATE TABLE reporting_lines RESTART IDENTITY CASCADE');
    await corePool.query('TRUNCATE TABLE employees RESTART IDENTITY CASCADE');

    await authPool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    
    console.log('[✓] Database berhasil dibersihkan.');

    // 2. Insert Core Employees
    console.log('[-] Menambahkan data karyawan (employees) ke core db...');
    
    const employees = [
      // CEO (is_ceo=true)
      { name: 'Budi Santoso', job_title: 'Chief Executive Officer', department: 'Executive Office', division: 'Management', company: 'PT Maju Mundur', assignment_type: 'shared_services', is_ceo: true, is_active: true },
      // HR Director (Shared Services)
      { name: 'Siti Rahmawati', job_title: 'HR Director', department: 'Human Resources', division: 'Operations', company: 'PT Maju Mundur', assignment_type: 'shared_services', is_ceo: false, is_active: true },
      // Engineering Manager (Shared Services)
      { name: 'Dedi Kurniawan', job_title: 'Engineering Manager', department: 'Engineering', division: 'Technology', company: 'PT Maju Mundur', assignment_type: 'shared_services', is_ceo: false, is_active: true },
      // Product Manager (Shared Services)
      { name: 'Joko Widodo', job_title: 'Product Manager', department: 'Product', division: 'Technology', company: 'PT Maju Mundur', assignment_type: 'shared_services', is_ceo: false, is_active: true },
      // Software Engineer (Shared Services)
      { name: 'Ani Wijaya', job_title: 'Software Engineer', department: 'Engineering', division: 'Technology', company: 'PT Maju Mundur', assignment_type: 'shared_services', is_ceo: false, is_active: true },
      // Business Analyst (Unit Business - 2 managers)
      { name: 'Bambang Hermawan', job_title: 'Business Analyst', department: 'Product', division: 'Technology', company: 'PT Maju Mundur', assignment_type: 'unit_business', is_ceo: false, is_active: true },
      // UI/UX Designer (Unit Business - 2 managers)
      { name: 'Cici Paramida', job_title: 'UI/UX Designer', department: 'Design', division: 'Technology', company: 'PT Maju Mundur', assignment_type: 'unit_business', is_ceo: false, is_active: true },
      // VP of Engineering (Shared Services)
      { name: 'Eka Putra', job_title: 'VP of Engineering', department: 'Engineering', division: 'Technology', company: 'PT Maju Mundur', assignment_type: 'shared_services', is_ceo: false, is_active: true },
      // VP of Marketing (Shared Services)
      { name: 'Fitriani', job_title: 'VP of Marketing', department: 'Marketing', division: 'Business', company: 'PT Maju Mundur', assignment_type: 'shared_services', is_ceo: false, is_active: true },
      // DevOps Engineer (Shared Services)
      { name: 'Guntur', job_title: 'DevOps Engineer', department: 'Engineering', division: 'Technology', company: 'PT Maju Mundur', assignment_type: 'shared_services', is_ceo: false, is_active: true },
      // Frontend Engineer (Unit Business)
      { name: 'Hadi', job_title: 'Frontend Engineer', department: 'Engineering', division: 'Technology', company: 'PT Maju Mundur', assignment_type: 'unit_business', is_ceo: false, is_active: true },
      // QA Engineer (Shared Services)
      { name: 'Indah', job_title: 'QA Engineer', department: 'Engineering', division: 'Technology', company: 'PT Maju Mundur', assignment_type: 'shared_services', is_ceo: false, is_active: true },
      // Product Designer (Unit Business)
      { name: 'Kartika', job_title: 'Product Designer', department: 'Design', division: 'Technology', company: 'PT Maju Mundur', assignment_type: 'unit_business', is_ceo: false, is_active: true },
      // Marketing Manager (Shared Services)
      { name: 'Lukman', job_title: 'Marketing Manager', department: 'Marketing', division: 'Business', company: 'PT Maju Mundur', assignment_type: 'shared_services', is_ceo: false, is_active: true },
      // Social Media Specialist (Shared Services)
      { name: 'Mega', job_title: 'Social Media Specialist', department: 'Marketing', division: 'Business', company: 'PT Maju Mundur', assignment_type: 'shared_services', is_ceo: false, is_active: true },
      // Inactive Marketing Associate
      { name: 'Zulkifli Hasan', job_title: 'Marketing Associate', department: 'Marketing', division: 'Business', company: 'PT Maju Mundur', assignment_type: 'shared_services', is_ceo: false, is_active: false }
    ];

    const empIdMap = {};
    
    for (const emp of employees) {
      const res = await corePool.query(
        `INSERT INTO employees (name, job_title, department, division, company, assignment_type, is_ceo, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING emp_id, name`,
        [emp.name, emp.job_title, emp.department, emp.division, emp.company, emp.assignment_type, emp.is_ceo, emp.is_active]
      );
      const inserted = res.rows[0];
      empIdMap[inserted.name] = inserted.emp_id;
      console.log(`    -> Karyawan ditambahkan: [ID: ${inserted.emp_id}] ${inserted.name}`);
    }

    // 3. Insert Core Reporting Lines
    console.log('[-] Menambahkan hubungan atasan (reporting lines)...');
    
    const reportingLines = [
      // Siti reports to Budi (CEO)
      { emp_id: empIdMap['Siti Rahmawati'], manager_emp_id: empIdMap['Budi Santoso'], manager_type: 'core_line_manager', is_primary: true },
      // Dedi reports to Budi (CEO)
      { emp_id: empIdMap['Dedi Kurniawan'], manager_emp_id: empIdMap['Budi Santoso'], manager_type: 'core_line_manager', is_primary: true },
      // Joko reports to Budi (CEO)
      { emp_id: empIdMap['Joko Widodo'], manager_emp_id: empIdMap['Budi Santoso'], manager_type: 'core_line_manager', is_primary: true },
      // Eka reports to Budi (CEO)
      { emp_id: empIdMap['Eka Putra'], manager_emp_id: empIdMap['Budi Santoso'], manager_type: 'core_line_manager', is_primary: true },
      // Fitriani reports to Budi (CEO)
      { emp_id: empIdMap['Fitriani'], manager_emp_id: empIdMap['Budi Santoso'], manager_type: 'core_line_manager', is_primary: true },
      
      // Ani (Shared Services) reports to Dedi
      { emp_id: empIdMap['Ani Wijaya'], manager_emp_id: empIdMap['Dedi Kurniawan'], manager_type: 'core_line_manager', is_primary: true },
      // Guntur (Shared Services) reports to Dedi
      { emp_id: empIdMap['Guntur'], manager_emp_id: empIdMap['Dedi Kurniawan'], manager_type: 'core_line_manager', is_primary: true },
      // Indah (Shared Services) reports to Dedi
      { emp_id: empIdMap['Indah'], manager_emp_id: empIdMap['Dedi Kurniawan'], manager_type: 'core_line_manager', is_primary: true },
      
      // Lukman reports to Fitriani
      { emp_id: empIdMap['Lukman'], manager_emp_id: empIdMap['Fitriani'], manager_type: 'core_line_manager', is_primary: true },
      // Mega reports to Lukman
      { emp_id: empIdMap['Mega'], manager_emp_id: empIdMap['Lukman'], manager_type: 'core_line_manager', is_primary: true },

      // Bambang (Unit Business) reports to:
      // - Dedi (Core Line - Primary)
      // - Joko (UB Manager - Secondary)
      { emp_id: empIdMap['Bambang Hermawan'], manager_emp_id: empIdMap['Dedi Kurniawan'], manager_type: 'core_line_manager', is_primary: true },
      { emp_id: empIdMap['Bambang Hermawan'], manager_emp_id: empIdMap['Joko Widodo'], manager_type: 'ub_manager', is_primary: false },
      
      // Cici (Unit Business) reports to:
      // - Joko (Core Line - Secondary)
      // - Dedi (UB Manager - Primary)
      { emp_id: empIdMap['Cici Paramida'], manager_emp_id: empIdMap['Joko Widodo'], manager_type: 'core_line_manager', is_primary: false },
      { emp_id: empIdMap['Cici Paramida'], manager_emp_id: empIdMap['Dedi Kurniawan'], manager_type: 'ub_manager', is_primary: true },

      // Hadi (Unit Business) reports to:
      // - Eka (Core Line - Primary)
      // - Dedi (UB Manager - Secondary)
      { emp_id: empIdMap['Hadi'], manager_emp_id: empIdMap['Eka Putra'], manager_type: 'core_line_manager', is_primary: true },
      { emp_id: empIdMap['Hadi'], manager_emp_id: empIdMap['Dedi Kurniawan'], manager_type: 'ub_manager', is_primary: false },

      // Kartika (Unit Business) reports to:
      // - Joko (Core Line - Primary)
      // - Eka (UB Manager - Secondary)
      { emp_id: empIdMap['Kartika'], manager_emp_id: empIdMap['Joko Widodo'], manager_type: 'core_line_manager', is_primary: true },
      { emp_id: empIdMap['Kartika'], manager_emp_id: empIdMap['Eka Putra'], manager_type: 'ub_manager', is_primary: false }
    ];

    for (const line of reportingLines) {
      await corePool.query(
        `INSERT INTO reporting_lines (emp_id, manager_emp_id, manager_type, is_primary)
         VALUES ($1, $2, $3, $4)`,
        [line.emp_id, line.manager_emp_id, line.manager_type, line.is_primary]
      );
      console.log(`    -> Atasan diset: Karyawan ${line.emp_id} melapor ke ${line.manager_emp_id} (${line.manager_type}, primary=${line.is_primary})`);
    }

    // 4. Insert Core History Logs
    console.log('[-] Menambahkan log riwayat pelaporan...');
    const historyLogs = [
      { emp_id: empIdMap['Siti Rahmawati'], changed_field: 'assignment_type', old_value: null, new_value: 'shared_services', changed_by: 1000000 },
      { emp_id: empIdMap['Siti Rahmawati'], changed_field: 'primary_manager', old_value: null, new_value: empIdMap['Budi Santoso'].toString(), changed_by: 1000000 },
      { emp_id: empIdMap['Bambang Hermawan'], changed_field: 'assignment_type', old_value: null, new_value: 'unit_business', changed_by: 1000000 },
      { emp_id: empIdMap['Bambang Hermawan'], changed_field: 'primary_manager', old_value: null, new_value: empIdMap['Dedi Kurniawan'].toString(), changed_by: 1000000 },
      { emp_id: empIdMap['Bambang Hermawan'], changed_field: 'secondary_manager', old_value: null, new_value: empIdMap['Joko Widodo'].toString(), changed_by: 1000000 },
      { emp_id: empIdMap['Hadi'], changed_field: 'assignment_type', old_value: null, new_value: 'unit_business', changed_by: 1000000 },
      { emp_id: empIdMap['Hadi'], changed_field: 'primary_manager', old_value: null, new_value: empIdMap['Eka Putra'].toString(), changed_by: 1000000 },
      { emp_id: empIdMap['Hadi'], changed_field: 'secondary_manager', old_value: null, new_value: empIdMap['Dedi Kurniawan'].toString(), changed_by: 1000000 }
    ];

    for (const log of historyLogs) {
      await corePool.query(
        `INSERT INTO reporting_line_history (emp_id, changed_field, old_value, new_value, changed_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [log.emp_id, log.changed_field, log.old_value, log.new_value, log.changed_by]
      );
    }
    console.log('[✓] Log riwayat berhasil ditambahkan.');

    // 5. Insert Auth Users
    console.log('[-] Menambahkan akun pengguna ke auth db...');
    const saltRounds = 10;
    const commonPassword = 'password';
    const passwordHash = await bcrypt.hash(commonPassword, saltRounds);

    const users = [
      // Superadmin (Budi Santoso - CEO)
      { email: 'superadmin@majumundur.com', password_hash: passwordHash, role: 'superadmin', emp_id: empIdMap['Budi Santoso'], is_active: true },
      // Admin (Siti Rahmawati - HR Director)
      { email: 'admin@majumundur.com', password_hash: passwordHash, role: 'admin', emp_id: empIdMap['Siti Rahmawati'], is_active: true },
      // Employee (Ani Wijaya - Software Engineer)
      { email: 'employee@majumundur.com', password_hash: passwordHash, role: 'employee', emp_id: empIdMap['Ani Wijaya'], is_active: true },
      // Standalone Superadmin (No emp_id)
      { email: 'sysadmin@majumundur.com', password_hash: passwordHash, role: 'superadmin', emp_id: null, is_active: true }
    ];

    for (const user of users) {
      const res = await authPool.query(
        `INSERT INTO users (email, password_hash, role, emp_id, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING user_id, email, role`,
        [user.email, user.password_hash, user.role, user.emp_id, user.is_active]
      );
      const inserted = res.rows[0];
      console.log(`    -> User ditambahkan: [ID: ${inserted.user_id}] ${inserted.email} (Role: ${inserted.role})`);
    }

    console.log('====================================================');
    console.log('[✓] DATABASE SEEDING BERHASIL DISELESAIKAN!');
    console.log('    Email: superadmin@majumundur.com');
    console.log('    Email: admin@majumundur.com');
    console.log('    Email: employee@majumundur.com');
    console.log('    Password: password (berlaku untuk semua akun)');
    console.log('====================================================');
  } catch (error) {
    console.error('[X] Seeding gagal:', error);
  } finally {
    await corePool.end();
    await authPool.end();
  }
}

seed();
