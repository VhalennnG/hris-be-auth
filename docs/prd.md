# PRD — `hris-be-auth`

**Versi:** 1.1
**Status:** Draft (Open Questions Resolved)
**Mengacu ke:** GENERAL_PRD.md v1.2 (Section 5.3, 8.1.1, 8.1.4)

---

## 1. Tujuan Service

`hris-be-auth` adalah service tunggal yang bertanggung jawab atas:

1. Autentikasi user (login, verifikasi kredensial)
2. Penerbitan & penandatanganan JWT (signing, bukan verifying penuh — verifying dilakukan di service lain)
3. Manajemen user, role, dan password reset (khusus `superadmin`)

**Yang BUKAN tanggung jawab service ini** (penting, sesuai Section 5.3 General PRD):

- Authorization granular ("role X boleh melakukan aksi Y") — itu domain `hris-be-core`.
- Data karyawan (employee, reporting line) — itu domain `hris-be-core`.
- Service ini **tidak pernah dipanggil langsung oleh frontend** — semua request via `hris-be-orchestrator`.

Tech Stack & Environment

| Layer             | Teknologi                                 |
| :---------------- | :---------------------------------------- |
| Framework Backend | Node.js dengan Express[cite: 2]           |
| Database          | PostgreSQL (Pure SQL, tanpa ORM)[cite: 2] |

AI-Assisted Development Tooling (MCP)

Selama sesi _vibe coding_ (pengembangan, _review_, _debugging_) yang merujuk pada PRD dan skema basis data, disarankan mengaktifkan MCP (Model Context Protocol) berikut:

- **`context7`** — dipakai untuk mengambil dokumentasi terbaru dari library/framework yang dipakai (Express, `pg` / `node-postgres`), supaya kode yang dihasilkan AI assistant mengikuti API versi yang aktual.
- **`sequential-thinking`** — dipakai untuk memecah task implementasi yang kompleks menjadi langkah-langkah bertahap sebelum eksekusi, supaya keputusan desain terstruktur dan bisa direview per langkah.

---

## 2. Scope & Batasan

| In Scope                                             | Out of Scope                                        |
| ---------------------------------------------------- | --------------------------------------------------- |
| Login (issue JWT)                                    | Refresh token rotation lanjutan (bisa jadi phase 2) |
| Verifikasi kredensial (password hash check)          | OAuth/SSO pihak ketiga                              |
| CRUD user account (superadmin only)                  | Authorization granular per capability               |
| Reset password (superadmin only, sesuai matriks 5.2) | Multi-factor authentication (MFA)                   |
| Signing JWT dengan private key (RS256)               | Session management berbasis server (stateless only) |

---

## 3. Data Model

### 3.1 Tabel `users`

| Kolom                      | Tipe                                                | Keterangan                                                                               |
| -------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `user_id`                  | UUID / string PK                                    | Identifier unik user (bisa sama dengan `emp_id` atau terpisah — lihat Open Question 6.1) |
| `email`                    | string, unique                                      | Login identifier                                                                         |
| `password_hash`            | string                                              | Di-hash dengan bcrypt/argon2, **tidak pernah** disimpan plaintext                        |
| `role`                     | enum (`superadmin`, `admin`, `employee`)            | Role tunggal per user, sesuai Section 5.1 General PRD                                    |
| `emp_id`                   | string, FK (logical, bukan FK fisik lintas service) | Menghubungkan akun ke data karyawan di `core`                                            |
| `is_active`                | boolean                                             | Untuk soft-disable akun tanpa hapus data                                                 |
| `created_at`, `updated_at` | timestamp                                           | Audit dasar                                                                              |

> Catatan: karena `core` dan `auth` adalah database terpisah (service isolation), `emp_id` di sini adalah **referensi logis**, bukan foreign key constraint fisik antar database. Validasi bahwa `emp_id` benar-benar ada di `core` dilakukan lewat call orchestrator saat pembuatan user (lihat Section 4.3).

### 3.2 Tabel `refresh_tokens` — **TIDAK diimplementasikan di prototype ini**

> Sesuai keputusan Section 9.2: prototype ini hanya pakai access token short-lived, tanpa refresh token. Skema di bawah ini didokumentasikan sebagai referensi _future improvement_ saja, bukan bagian dari scope implementasi.

| Kolom        | Tipe          | Keterangan                                                |
| ------------ | ------------- | --------------------------------------------------------- |
| `token_id`   | UUID PK       |                                                           |
| `user_id`    | FK ke `users` |                                                           |
| `token_hash` | string        | Refresh token disimpan dalam bentuk hash, bukan plaintext |
| `expires_at` | timestamp     |                                                           |
| `revoked`    | boolean       | Untuk logout/invalidate                                   |

---

## 4. Endpoint Spesifikasi

### 4.1 `POST /api/v1/auth/login`

**Purpose:** Autentikasi kredensial, terbitkan JWT.

**Request:**

```json
{
  "email": "citra@majumundur.com",
  "password": "plaintext-password"
}
```

**Response Sukses (200):**

```json
{
  "status": "success",
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "user": {
      "user_id": "USR001",
      "emp_id": "EMP002",
      "role": "admin"
    }
  }
}
```

**Response Error (401):**

```json
{
  "status": "error",
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email atau password salah",
    "details": null
  }
}
```

### 4.2 JWT Claims (Payload Structure)

```json
{
  "sub": "USR001",
  "emp_id": "EMP002",
  "role": "admin",
  "iat": 1735300000,
  "exp": 1735303600
}
```

- **Algoritma:** RS256 (asymmetric) — sesuai keputusan 8.1.1 General PRD, supaya service lain (`orchestrator`, `core`) bisa verifikasi signature dengan **public key** tanpa perlu network call ke `auth`.
- **Key management:** private key hanya ada di `hris-be-auth`. Public key didistribusikan ke `orchestrator` & `core` via environment variable/config (untuk prototype), atau shared secret store (nice to have, bukan wajib).
- **Expiry:** disarankan pendek (contoh: 1 jam) karena tidak ada mekanisme revoke token yang solid di sistem stateless — trade-off ini didokumentasikan di Section 6.2 (Open Question).

### 4.3 `POST /api/v1/auth/users` (Create User) — **superadmin only**

**Purpose:** Membuat akun login baru untuk karyawan yang sudah ada di `core`.

**Request:**

```json
{
  "email": "budi@majumundur.com",
  "password": "initial-password",
  "role": "employee",
  "emp_id": "EMP088"
}
```

> Catatan implementasi: karena `emp_id` adalah referensi logis ke `core`, endpoint ini idealnya dipanggil oleh **orchestrator** yang sudah melakukan validasi bahwa `emp_id` tersebut valid di `core` sebelum diteruskan ke `auth` — bukan `auth` yang langsung percaya begitu saja. Ini didetailkan di PRD `orchestrator`.

### 4.4 `PATCH /api/v1/auth/users/{user_id}/role` — **superadmin only**

**Purpose:** Mengubah role user (sesuai capability "Manage users, roles" di Section 5.2).

### 4.5 `POST /api/v1/auth/users/{user_id}/reset-password` — **superadmin only**

**Purpose:** Reset password user (generate password sementara atau set password baru).

### 4.6 `GET /api/v1/auth/verify` (internal, dipanggil orchestrator — opsional)

**Purpose:** Endpoint fallback untuk verifikasi token bila orchestrator butuh double-check di luar local signature verification (jarang dipakai, bukan jalur utama — jalur utama tetap local verification sesuai 8.1.1).

---

## 5. Business Rules & Validasi

1. **Password wajib di-hash** (bcrypt cost factor ≥10, atau argon2id) — tidak ada plaintext storage dalam kondisi apapun.
2. **Satu email = satu akun** (unique constraint).
3. **Role hanya bisa diubah oleh `superadmin`** (di-enforce di layer ini karena ini memang domain manajemen user, bukan authorization granular karyawan yang jadi domain core).
4. **`is_active = false`** memblokir login meski password benar (untuk offboarding karyawan tanpa hapus histori akun).
5. Token yang diterbitkan **tidak menyimpan permission granular** (seperti "boleh manage reporting line") di dalam JWT — JWT hanya membawa identitas (`sub`, `emp_id`, `role`). Keputusan "role ini boleh apa" tetap dievaluasi di `core` saat request masuk, sesuai Section 5.3 General PRD, supaya token tidak perlu di-reissue setiap kali matriks permission berubah.

---

## 6. Error Codes (Spesifik Service Ini)

| Code                   | HTTP Status | Kapan Dipakai                                               |
| ---------------------- | ----------- | ----------------------------------------------------------- |
| `INVALID_CREDENTIALS`  | 401         | Email tidak ditemukan atau password salah                   |
| `ACCOUNT_INACTIVE`     | 403         | Akun `is_active = false`                                    |
| `EMAIL_ALREADY_EXISTS` | 409         | Duplikat saat create user                                   |
| `USER_NOT_FOUND`       | 404         | Target user_id tidak ada (untuk role update/reset password) |
| `VALIDATION_ERROR`     | 400         | Format request tidak sesuai                                 |
| `INTERNAL_ERROR`       | 500         | Kesalahan tak terduga                                       |

_(Mengikuti enum dasar & envelope error dari Section 6 General PRD)_

---

## 7. Non-Functional Requirements

- **Tidak boleh diakses langsung dari frontend** — hanya dari `orchestrator` (service-to-service, idealnya dibatasi juga secara network-level, misal internal network/VPC pada deployment nyata; untuk prototype cukup didokumentasikan sebagai aturan).
- **Private key tidak boleh ter-commit ke repo** — via environment variable/secrets manager.
- **Stateless**: tidak menyimpan session di memory/server; state login sepenuhnya di token (kecuali refresh token bila diimplementasikan).

---

## 8. Tech Stack Spesifik

| Komponen         | Rekomendasi                                                                 |
| ---------------- | --------------------------------------------------------------------------- |
| Framework        | Node.js (Express/Fastify/NestJS — bebas, konsisten dengan `core`)           |
| Password hashing | bcrypt atau argon2                                                          |
| JWT library      | `jsonwebtoken` (Node) dengan RS256                                          |
| Database         | PostgreSQL (schema/database terpisah dari `core`, sesuai service isolation) |

---

## 9. Keputusan Final (Disetujui)

### 9.1 `user_id` terpisah dari `emp_id`

**Keputusan:** `user_id` adalah entitas/identifier sendiri, `emp_id` disimpan sebagai kolom referensi logis di tabel `users` (lihat Section 3.1).

**Alasan:** Tidak semua data di `core` (misal karyawan non-aktif/historis) tentu butuh akun login, dan sebaliknya bisa saja ada akun sistem (superadmin) tanpa `emp_id`. Memisahkan keduanya menghindari coupling yang tidak perlu antara identitas login dan identitas karyawan.

### 9.2 Tanpa refresh token — access token short-lived saja

**Keputusan:** Prototype ini **tidak mengimplementasikan refresh token**. Cukup access token dengan expiry sedang (rekomendasi: 1–4 jam). User re-login setelah token expired.

**Alasan:** Refresh token rotation menambah kompleksitas (tabel tambahan, logic revoke, rotasi) yang tidak diminta task dan tidak proporsional untuk skala prototype. Ini konsisten dengan prinsip "hindari over-engineering" yang dipegang sejak General PRD. Refresh token tetap dicatat sebagai _future improvement_, bukan dihapus dari opsi selamanya.

### 9.3 Password awal: input manual oleh superadmin

**Keputusan:** Saat `POST /api/v1/auth/users`, password awal diinput manual oleh superadmin (lihat Section 4.3) — bukan auto-generate random oleh sistem.

**Alasan:** Paling sederhana untuk diimplementasikan dan cukup untuk kebutuhan assessment. "Paksa ganti password di login pertama" boleh ditambahkan sebagai nice-to-have jika waktu memungkinkan, tapi bukan requirement wajib.

> Ketiga keputusan ini final dan menjadi acuan implementasi — tidak lagi berstatus open question.

---

## 10. Struktur Folder Repo (Working Layout)

```
hris-be-auth/
├── src/
│   ├── routes/          (login, users, role, reset-password)
│   ├── controllers/
│   ├── services/        (password hashing, JWT signing)
│   ├── models/          (users, refresh_tokens)
│   ├── middlewares/     (validation, error handler)
│   └── config/          (private key loading, db connection)
├── migrations/          (schema PostgreSQL)
├── .env.example
└── package.json
```
