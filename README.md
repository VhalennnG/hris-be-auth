# hris-be-auth (Authentication and User Management Service)

`hris-be-auth` adalah backend service terisolasi yang mengelola seluruh data kredensial login pengguna, registrasi akun, pengaturan peran (*role management*), reset kata sandi, dan penerbitan token JWT.

---

## Posisi di Arsitektur

```
┌────────────────┐
│    hris-fe     │
└────────────────┘
        │
        ▼
┌────────────────────────┐
│  hris-be-orchestrator  │
└────────────────────────┘
   │                  │
   ▼                  ▼
┌──────────────┐   ┌──────────────┐
│ hris-be-core │   │ hris-be-auth │ ◀── kamu di sini
└──────────────┘   └──────────────┘
```

---

## Tanggung Jawab (Scope)

| In Scope | Out of Scope |
| :--- | :--- |
| Login akun pengguna & penerbitan token JWT. | Validasi keabsahan JWT token per request data (Gateway). |
| Registrasi akun user baru (Superadmin only). | Enforce hak akses granular kepegawaian (Core). |
| Modifikasi peranan/role user (Superadmin only). | Business logic karyawan (CRUD, reporting line, org chart). |
| Reset password akun user (Superadmin only). | - |
| Penyimpanan password ter-hash yang aman (Bcrypt). | - |

---

## Poin Arsitektur Paling Penting
*   **Mengapa Auth Service Tidak Terlibat di Setiap Request?**
    Token JWT yang diterbitkan ditandatangani secara asimetris menggunakan algoritma **RS256** dengan sepasang kunci (*private/public key pairs*). 
    Hal ini memungkinkan API Gateway (`orchestrator`) memverifikasi integritas token secara mandiri menggunakan `public key` tanpa melakukan panggilan jaringan (*network call*) apa pun ke Auth Service. 
    Dengan demikian, Auth Service **hanya beroperasi saat ada proses login, pendaftaran akun baru, reset password, atau perubahan peran**, menghindarkan service ini menjadi *bottleneck* beban lalu lintas data dan mencegah kegagalan fatal (*single point of failure*).

---

## Cara Kerja
1.  **Verifikasi Password Kriptografis:** Pengguna mengirimkan email dan password plaintext ke `/api/v1/auth/login` -> Auth Service mengambil hashed password dari DB berdasarkan email -> Mencocokkan kecocokan sandi menggunakan **`bcrypt.compare`**.
2.  **Penerbitan Token Stateless:** Jika sandi cocok dan akun aktif (`is_active = true`), Auth Service membuat token JWT bertanda tangan digital menggunakan **private key** (RS256) dengan muatan klaim berisi `sub` (userId), `emp_id` (karyawan terikat), dan `role`.
3.  **Hash Password Otomatis:** Saat pendaftaran user baru (`POST /api/v1/auth/users`) atau reset password, string sandi acak di-hash dengan **bcrypt** menggunakan *cost factor* 10 sebelum disimpan permanen ke database guna mitigasi kebocoran database.

---

## API Endpoints (Auth Service)

Semua endpoint (kecuali Login) dilindungi dan diakses secara internal melalui API Gateway (di-proxy dari Orchestrator):

| Method | Path Internal | Permission / Role | Deskripsi |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/auth/login` | Publik (No Token) | Login pengguna dan pengembalian token JWT. |
| **POST** | `/api/v1/auth/users` | Superadmin | Registrasi akun user baru (wajib mengisi password). |
| **PATCH** | `/api/v1/auth/users/:user_id/role` | Superadmin | Mengubah peranan (role) user (`superadmin`/`admin`/`employee`). |
| **POST** | `/api/v1/auth/users/:user_id/reset-password` | Superadmin | Reset password user (mengganti sandi lama). |
| **GET** | `/api/v1/auth/users` | Superadmin | Mengambil daftar seluruh user terdaftar (untuk dropdown/tabel). |

---

## Error Codes (Spesifik Auth Service)

| Code | HTTP Status | Kapan Dipakai |
| :--- | :---: | :--- |
| **`INVALID_CREDENTIALS`** | 401 | Email tidak ditemukan atau password salah saat login. |
| **`ACCOUNT_INACTIVE`** | 403 | Akun berstatus dinonaktifkan (`is_active = false`). |
| **`EMAIL_ALREADY_EXISTS`**| 409 | Upaya mendaftarkan email yang sudah terdaftar (*duplicate constraint*). |
| **`USER_NOT_FOUND`** | 404 | Target `user_id` tidak ditemukan di database. |
| **`VALIDATION_ERROR`** | 400 | Format request buruk / field wajib kosong / format email salah. |

---

## Database

- **Nama Database:** `hris_auth_db`
- **Strategi Primary Key:** Menggunakan tipe `BIGINT` yang secara otomatis bertambah (_auto-increment_) dimulai dari angka `1000000` via deklarasi `GENERATED ALWAYS AS IDENTITY`.
- **Daftar Tabel Utama:**
  - `users`: Menyimpan kredensial `email`, `password_hash`, `role`, status keaktifan (`is_active`), dan `emp_id` (sebagai referensi logis ke karyawan di Core Service tanpa Foreign Key fisik antardatabase).
- **Skema Lengkap:** [docs/auth_shema.sql](docs/auth_shema.sql)
- **Isolasi Database:** Untuk penjelasan detail mengapa database auth dipisahkan secara fisik dari database core, silakan baca [../prd/DATABASE_SCHEMA_OVERVIEW.md](../prd/DATABASE_SCHEMA_OVERVIEW.md).

---

## Diagram

Diagram pendukung keamanan dan otentikasi berikut dapat ditemukan di folder [docs/diagrams](docs/diagrams):

| Nama Diagram | Deskripsi Diagram | Link Relatif |
| :--- | :--- | :--- |
| **Password JWT Signing** | Alur pendaftaran password, verifikasi hash, dan penerbitan token JWT asimetris. | [08_activity_password_jwt_signing.mermaid](docs/diagrams/08_activity_password_jwt_signing.mermaid) |
| **State Machine Account Status**| Transisi daur hidup status keaktifan akun user. | [09_state_machine_account_status.mermaid](docs/diagrams/09_state_machine_account_status.mermaid) |

---

## Environment Variables

Salin berkas `.env.example` menjadi `.env` di folder root auth service untuk konfigurasi:

```env
PORT=4002

# Konfigurasi Database PostgreSQL
HRIS_AUTH_DB_HOST=localhost
HRIS_AUTH_DB_PORT=5432
HRIS_AUTH_DB_USER=vhalen
HRIS_AUTH_DB_PASS=vhalen
HRIS_AUTH_DB_NAME=hris_auth_db

# Asymmetric RSA Key Pairs untuk penandatanganan JWT (RS256)
# Catatan: Gunakan string raw PEM atau load via fs.readFileSync
AUTH_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAv..."
AUTH_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8..."
```

---

## Tech Stack
*   **Runtime:** Node.js
*   **Framework:** Express.js (dengan `nodemon` untuk hot-reload development)
*   **Database:** PostgreSQL (node-postgres `pg` driver)
*   **Kriptografi & Token:** `bcrypt` (password hashing), `jsonwebtoken` (JWT RS256 token manager)

---

## Dokumen Terkait
*   **Spesifikasi Detail PRD Auth:** [docs/prd.md](docs/prd.md)
*   **Spesifikasi Induk Proyek:** [../prd/GENERAL_PRD.md](../prd/GENERAL_PRD.md)
