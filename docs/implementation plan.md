# Implementation Plan — `hris-be-auth` Development

Implementasi `hris-be-auth` sebagai service yang mengelola data akun pengguna (`users`), hashing password, otentikasi login, penerbitan JWT dengan algoritma asimetris **RS256** (Private Key signing), dan manajemen akun khusus untuk `superadmin`.

## User Review Required

> [!IMPORTANT]
> **Port Default & Konfigurasi Lingkungan (.env)**
> Kami mengusulkan port default **`4002`** untuk `hris-be-auth` agar tidak bentrok dengan Orchestrator (`4000`) dan Core (`4001`).
> Database PostgreSQL diasumsikan berjalan secara lokal dan akan diakses via connection string. Kami akan menyediakan default `.env` dengan:
> `HRIS_AUTH_DB_NAME=hris_auth`
> Database ini terpisah secara fisik dari database `hris_core` sesuai prinsip isolasi layanan.

> [!WARNING]
> **RSA Key Pair Sharing**
> Service `auth` akan menggunakan file Private Key (`keys/private_key.pem`) yang dihasilkan dari pasangan kunci RSA yang sama dengan Public Key di `core`. Kami akan menyalin kunci privat yang telah dibuat sebelumnya di folder `core/keys/private_key.pem` ke folder `auth/keys/private_key.pem` agar token yang diterbitkan dapat diverifikasi dengan benar oleh service lainnya.

---

## Open Questions

> [!NOTE]
> **1. Integrasi Validasi Lintas Service (`auth` -> `core`)**
> Sesuai PRD Section 4.3, saat superadmin membuat akun baru, service `auth` harus memastikan `emp_id` tersebut valid di database `core`.
> Kami akan mengimplementasikan ini menggunakan panggilan HTTP internal (`fetch`) dari `auth` ke `core` menggunakan endpoint internal `GET /api/v1/employees/check/:emp_id` yang telah disiapkan di `core`. Kami berasumsi URL core didefinisikan di `.env` sebagai `CORE_SERVICE_URL=http://localhost:4001/api/v1`. Apakah penamaan variabel ini sudah sesuai?

---

## Proposed Changes

### Project Foundation & Configuration

#### [NEW] [package.json](file:///Users/vhalen/Code/Playground/hris-project/auth/package.json)

Mendefinisikan package manifest, dependencies (`express`, `pg` untuk database PostgreSQL, `jsonwebtoken` untuk pembuatan token JWT, `bcrypt` untuk password hashing, `dotenv` untuk konfigurasi environment, `cors` untuk resource sharing), serta script start/dev/test. Menggunakan ES modules (`"type": "module"`).

#### [NEW] [.env.example](file:///Users/vhalen/Code/Playground/hris-project/auth/.env.example)

Template variabel lingkungan untuk port aplikasi, koneksi PostgreSQL hris_auth, URL internal service core, dan lokasi Private Key JWT.

#### [NEW] [src/config/db.js](file:///Users/vhalen/Code/Playground/hris-project/auth/src/config/db.js)

Inisialisasi `pg.Pool` menggunakan parameter dari environment variable untuk koneksi database PostgreSQL `hris_auth`.

#### [NEW] [src/config/keys.js](file:///Users/vhalen/Code/Playground/hris-project/auth/src/config/keys.js)

Helper untuk membaca file Private Key RSA PEM secara aman dari filesystem untuk menandatangani JWT.

---

### Core Security & Middleware

#### [NEW] [src/middlewares/validation.js](file:///Users/vhalen/Code/Playground/hris-project/auth/src/middlewares/validation.js)

Middleware untuk melakukan validasi payload pada request masuk, misalnya memastikan format email valid pada login dan pengecekan kelengkapan data saat pembuatan user baru.

#### [NEW] [src/middlewares/error-handler.js](file:///Users/vhalen/Code/Playground/hris-project/auth/src/middlewares/error-handler.js)

Express global error handler untuk menangani runtime error dan mengembalikan response error sesuai dengan format envelope PRD Section 6:
`{ status: "error", error: { code, message, details } }`.

#### [NEW] [src/middlewares/trusted-role-check.js](file:///Users/vhalen/Code/Playground/hris-project/auth/src/middlewares/trusted-role-check.js)

Middleware untuk memvalidasi bahwa pemanggil endpoint administratif (seperti membuat user, mengganti role, reset password) memiliki header `X-User-Role: superadmin` (trusted header yang disuntikkan oleh gateway orchestrator).

---

### Business Logic Services

#### [NEW] [src/services/password-service.js](file:///Users/vhalen/Code/Playground/hris-project/auth/src/services/password-service.js)

Menyediakan helper untuk hashing password menggunakan `bcrypt` (cost factor 10) dan membandingkan password plaintext dengan hash yang tersimpan.

#### [NEW] [src/services/token-service.js](file:///Users/vhalen/Code/Playground/hris-project/auth/src/services/token-service.js)

Menyediakan fungsi untuk menandatangani token JWT asimetris (RS256) dengan klaim standard (`sub`, `role`, `emp_id`, `iat`, `exp`) menggunakan Private Key PEM.

#### [NEW] [src/services/core-service.js](file:///Users/vhalen/Code/Playground/hris-project/auth/src/services/core-service.js)

Mengintegrasikan panggilan API ke `hris-be-core` via HTTP `fetch` ke endpoint `GET /api/v1/employees/check/:emp_id` untuk memvalidasi apakah karyawan tersebut valid dan aktif sebelum akun dibuat.

---

### Controllers & Routes

#### [NEW] [src/controllers/auth-controller.js](file:///Users/vhalen/Code/Playground/hris-project/auth/src/controllers/auth-controller.js)

- `POST /api/v1/auth/login` — Menerima email dan password, mencocokkan hash di database, memeriksa apakah user aktif (`is_active = true`), menerbitkan JWT token, dan mengembalikan user info.

#### [NEW] [src/controllers/user-controller.js](file:///Users/vhalen/Code/Playground/hris-project/auth/src/controllers/user-controller.js)

- `POST /api/v1/auth/users` — Membuat akun pengguna baru. Terlebih dahulu memanggil `core-service` untuk memvalidasi `emp_id`, melakukan hashing password, dan menyimpannya ke database (hanya superadmin).
- `PATCH /api/v1/auth/users/:user_id/role` — Mengubah role user (hanya superadmin).
- `POST /api/v1/auth/users/:user_id/reset-password` — Mengubah password user menjadi password baru yang diinput manual (hanya superadmin).

#### [NEW] [src/routes/auth-routes.js](file:///Users/vhalen/Code/Playground/hris-project/auth/src/routes/auth-routes.js)

Mendefinisikan routing endpoint login, registrasi, penggantian role, dan reset password.

#### [NEW] [src/app.js](file:///Users/vhalen/Code/Playground/hris-project/auth/src/app.js)

Inisialisasi Express app, middleware global, mount router di `/api/v1/auth`, dan global error handler.

#### [NEW] [src/server.js](file:///Users/vhalen/Code/Playground/hris-project/auth/src/server.js)

Entry point utama aplikasi. Melakukan inisialisasi tabel basis data menggunakan berkas SQL migrasi [auth_shema.sql](file:///Users/vhalen/Code/Playground/hris-project/auth/docs/auth_shema.sql) jika tabel `users` belum terbentuk, kemudian menjalankan server Express pada port `4002`.

---

## Verification Plan

### Automated Tests

Pengujian otomatis menggunakan unit test ringan `node:test` untuk menguji:

1.  **Password Hashing:** Memastikan hashing dan verifikasi kecocokan password bekerja dengan benar.
2.  **JWT Signing:** Memastikan token JWT ditandatangani menggunakan RS256 dan private key, serta berisi klaim yang benar.

Command:

```bash
npm run test
```

### Manual Verification

1.  **Inisialisasi Tabel:** Menjalankan aplikasi untuk memverifikasi tabel `users` dibuat secara otomatis dalam database target `hris_auth`.
2.  **Uji Coba Endpoint via Postman:**
    - Membuat akun pengguna baru dengan `emp_id` yang valid dan tidak valid di `core`.
    - Melakukan uji coba login untuk mendapatkan JWT token.
    - Mencoba mengubah role user dan reset password dengan dan tanpa header `X-User-Role: superadmin` untuk memverifikasi proteksi akses.
