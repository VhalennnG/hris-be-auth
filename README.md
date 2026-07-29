# hris-be-auth (Authentication and User Management Service)

`hris-be-auth` adalah backend service terisolasi yang mengelola seluruh data kredensial login pengguna, registrasi akun, pengaturan peran (_role management_), reset kata sandi, dan penerbitan token JWT.

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

| In Scope                                          | Out of Scope                                               |
| :------------------------------------------------ | :--------------------------------------------------------- |
| Login akun pengguna & penerbitan token JWT.       | Validasi keabsahan JWT token per request data (Gateway).   |
| Registrasi akun user baru (Superadmin only).      | Enforce hak akses granular kepegawaian (Core).             |
| Modifikasi peranan/role user (Superadmin only).   | Business logic karyawan (CRUD, reporting line, org chart). |
| Reset password akun user (Superadmin only).       | -                                                          |
| Penyimpanan password ter-hash yang aman (Bcrypt). | -                                                          |

---

## Poin Arsitektur Paling Penting

- **Mengapa Auth Service Tidak Terlibat di Setiap Request?**
  Token JWT yang diterbitkan ditandatangani secara asimetris menggunakan algoritma **RS256** dengan sepasang kunci (_private/public key pairs_).
  Hal ini memungkinkan API Gateway (`orchestrator`) memverifikasi integritas token secara mandiri menggunakan `public key` tanpa melakukan panggilan jaringan (_network call_) apa pun ke Auth Service.
  Dengan demikian, Auth Service **hanya beroperasi saat ada proses login, pendaftaran akun baru, reset password, atau perubahan peran**, menghindarkan service ini menjadi _bottleneck_ beban lalu lintas data dan mencegah kegagalan fatal (_single point of failure_).

---

## Cara Kerja

1.  **Verifikasi Password Kriptografis:** Pengguna mengirimkan email dan password plaintext ke `/api/v1/auth/login` -> Auth Service mengambil hashed password dari DB berdasarkan email -> Mencocokkan kecocokan sandi menggunakan **`bcrypt.compare`**.
2.  **Penerbitan Token Stateless:** Jika sandi cocok dan akun aktif (`is_active = true`), Auth Service membuat token JWT bertanda tangan digital menggunakan **private key** (RS256) dengan muatan klaim berisi `sub` (userId), `emp_id` (karyawan terikat), dan `role`.
3.  **Hash Password Otomatis:** Saat pendaftaran user baru (`POST /api/v1/auth/users`) atau reset password, string sandi acak di-hash dengan **bcrypt** menggunakan _cost factor_ 10 sebelum disimpan permanen ke database guna mitigasi kebocoran database.

---

## API Endpoints (Auth Service)

Semua endpoint (kecuali Login) dilindungi dan diakses secara internal melalui API Gateway (di-proxy dari Orchestrator):

| Method    | Path Internal                                | Permission / Role | Deskripsi                                                       |
| :-------- | :------------------------------------------- | :---------------- | :-------------------------------------------------------------- |
| **POST**  | `/api/v1/auth/login`                         | Publik (No Token) | Login pengguna dan pengembalian token JWT.                      |
| **POST**  | `/api/v1/auth/users`                         | Superadmin        | Registrasi akun user baru (wajib mengisi password).             |
| **PATCH** | `/api/v1/auth/users/:user_id/role`           | Superadmin        | Mengubah peranan (role) user (`superadmin`/`admin`/`employee`). |
| **POST**  | `/api/v1/auth/users/:user_id/reset-password` | Superadmin        | Reset password user (mengganti sandi lama).                     |
| **GET**   | `/api/v1/auth/users`                         | Superadmin        | Mengambil daftar seluruh user terdaftar (untuk dropdown/tabel). |

> 💡 **Dokumentasi Interaktif (Swagger UI):** Jalankan server auth lalu buka [http://localhost:4002/docs](http://localhost:4002/docs) atau [http://localhost:4002/api-docs](http://localhost:4002/api-docs) pada browser untuk melihat dokumentasi API interaktif.

---

## Error Codes (Spesifik Auth Service)

| Code                       | HTTP Status | Kapan Dipakai                                                           |
| :------------------------- | :---------: | :---------------------------------------------------------------------- |
| **`INVALID_CREDENTIALS`**  |     401     | Email tidak ditemukan atau password salah saat login.                   |
| **`ACCOUNT_INACTIVE`**     |     403     | Akun berstatus dinonaktifkan (`is_active = false`).                     |
| **`EMAIL_ALREADY_EXISTS`** |     409     | Upaya mendaftarkan email yang sudah terdaftar (_duplicate constraint_). |
| **`USER_NOT_FOUND`**       |     404     | Target `user_id` tidak ditemukan di database.                           |
| **`VALIDATION_ERROR`**     |     400     | Format request buruk / field wajib kosong / format email salah.         |

---

## Database

- **Nama Database:** `hris_auth_db`
- **Strategi Primary Key:** Menggunakan tipe `BIGINT` yang secara otomatis bertambah (_auto-increment_) dimulai dari angka `1000000` via deklarasi `GENERATED ALWAYS AS IDENTITY`.
- **Daftar Tabel Utama:**
  - `users`: Menyimpan kredensial `email`, `password_hash`, `role`, status keaktifan (`is_active`), dan `emp_id` (sebagai referensi logis ke karyawan di Core Service tanpa Foreign Key fisik antardatabase).
- **Skema Lengkap:** [docs/auth_shema.sql](docs/auth_shema.sql)

---

## Diagram

Diagram pendukung keamanan dan otentikasi berikut dapat ditemukan di folder [docs/diagrams](docs/diagrams):

| Nama Diagram                     | Deskripsi Diagram                                                               | Link Relatif                                                                                       |
| :------------------------------- | :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------- |
| **Password JWT Signing**         | Alur pendaftaran password, verifikasi hash, dan penerbitan token JWT asimetris. | [08_activity_password_jwt_signing.mermaid](docs/diagrams/08_activity_password_jwt_signing.mermaid) |
| **State Machine Account Status** | Transisi daur hidup status keaktifan akun user.                                 | [09_state_machine_account_status.mermaid](docs/diagrams/09_state_machine_account_status.mermaid)   |

## Panduan Memulai & Cara Menjalankan (Quick Start Guide)

Ikuti langkah-langkah berikut untuk meng-cloning, mengonfigurasi, dan menjalankan service `hris-be-auth` dari awal:

### 1. Clone Repositori

```bash
git clone https://github.com/VhalennnG/hris-be-auth.git
cd hris-be-auth
```

### 2. Instalasi Dependensi

```bash
npm install
```

### 3. Setup Kunci Kriptografi RSA (Asymmetric Keys)

Karena berkas kunci privat (`private_key.pem`) diabaikan oleh Git (`.gitignore`) demi alasan keamanan, Anda wajib men-generate kunci Anda sendiri:

```bash
mkdir -p keys
openssl genrsa -out keys/private_key.pem 2048
openssl rsa -in keys/private_key.pem -pubout -out keys/public_key.pem
```

### 4. Konfigurasi Environment Variables

Salin berkas contoh `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Buka berkas `.env` dan sesuaikan kredensial database PostgreSQL Anda (seperti host, port, user, dan password):

```env
PORT=4002
HRIS_AUTH_DB_HOST=localhost
HRIS_AUTH_DB_PORT=5432
HRIS_AUTH_DB_USER=<YOUR_DB_USER>
HRIS_AUTH_DB_PASS=<YOUR_DB_PASSWORD>
HRIS_AUTH_DB_NAME=hris_auth_db

# Kunci asimetris RSA yang dimuat dari folder keys
AUTH_PRIVATE_KEY="<YOUR_RSA_PRIVATE_KEY_PEM_STRING>"
AUTH_PUBLIC_KEY="<YOUR_RSA_PUBLIC_KEY_PEM_STRING>"
```

### 5. Inisialisasi Database & Seeding Data

Pastikan database `hris_auth_db` sudah dibuat di PostgreSQL Anda, kemudian jalankan script seeder untuk membuat tabel dan mengisi data awal:

```bash
node scripts/seed-data.js
```

### 6. Menjalankan Service (Development Mode)

Jalankan service menggunakan `nodemon` untuk hot-reload di lingkungan development:

```bash
npm run dev
```

Service akan berjalan secara lokal di `http://localhost:4002`. Anda dapat mengakses dokumentasi API interaktif (Swagger UI) di [http://localhost:4002/docs](http://localhost:4002/docs).

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js (dengan `nodemon` untuk hot-reload development)
- **Database:** PostgreSQL (node-postgres `pg` driver)
- **Kriptografi & Token:** `bcrypt` (password hashing), `jsonwebtoken` (JWT RS256 token manager)

---

## Dokumen Terkait

- **Spesifikasi Detail PRD Auth:** [docs/prd.md](docs/prd.md)
