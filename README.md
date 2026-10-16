# ARMOR — TU Rental

Aplikasi input handover downtime shift. ARMOR adalah Asset Readiness & Monitoring of Operational Repair. Data mengikuti kolom sheet Excel handover. Tampilan berbahasa Indonesia.

## Menjalankan

- Dev server: `npm run dev` di http://localhost:3010
- Schema database: `npm run db:ensure`
- Seed akun admin (hanya jika username belum ada): `npm run seed`
- Login awal seed: `admin` / `ChangeMe-Admin1` (atau nilai `SEED_ADMIN_PASSWORD`). Segera ganti password setelah login pertama.
- Salin `.env.example` ke `.env`. Isi `AUTH_SECRET` kuat (minimal 32 karakter), misalnya `openssl rand -base64 32`. Di production, secret lemah/default membuat server gagal start.

Database aplikasi adalah `tu_rental` di MariaDB lokal. Tabel `users` mengikuti bentuk `tu_prima.users`, tetapi aplikasi ini tidak menulis ke database `tu_prima`.

## Keamanan

Hardening setelah audit (dibandingkan dengan pola TSMS / aplikasi internal Trakindo):

### Autentikasi & sesi

- Session Auth.js memakai cookie **httpOnly** + `SameSite=lax` (bukan token di `localStorage`).
- JWT di-revalidasi dari database paling lambat tiap **60 detik**: user nonaktif atau dihapus kehilangan sesi; level ikut diperbarui.
- Setiap API mutasi/baca lewat `requireUser` / `requireWriter` / `requireSuperuser` juga mengecek `active` + `level` di DB.
- Middleware melindungi halaman dan **semua `/api/*`** kecuali `/api/auth/*` (tanpa sesi → 401 JSON).
- Login credentials: rate limit **5 gagal / 15 menit** per username+IP, lalu lockout **15 menit**.

### Password & secret

- Password hanya bcrypt (cost 10). **Tidak ada fallback plaintext.**
- Kebijakan: minimal **8** karakter, maksimal 72 (batas bcrypt).
- `AUTH_SECRET` / `NEXTAUTH_SECRET`: production wajib kuat (≥32 karakter, bukan `change-me`). Development hanya memperingatkan di log.

### Otorisasi sensitif

- Kirim WhatsApp Summary by Model: **admin / superuser** (`requireWriter`). Tombol jadwal otomatis hanya **superuser** di UI.
- Halaman dan API backup data: **admin / superuser**. Role `user` diarahkan ke beranda / ditolak 403.
- CRUD pengguna: hanya **superuser**.

### Header HTTP

Di `next.config.ts` (semua path):

- `Content-Security-Policy` (default `self`; script mengizinkan inline/eval untuk Next.js + bootstrap tema)
- `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`
- `Referrer-Policy`, `Permissions-Policy` (kamera/mikrofon/geolokasi/payment dimatikan)
- `Strict-Transport-Security` jika `AUTH_URL` memakai `https://`

### Catatan operasional

- Akun lama dengan hash bukan bcrypt tidak bisa login — reset password lewat superuser.
- Cookie `secure` aktif bila `AUTH_URL` (atau `NEXTAUTH_URL`) diawali `https://`.

## Design System TU

Sumber: Figma `xkqwaYJnltsvh4V9N8A7vr` (Design System TU).

### Warna (Color Guideline `1:4913`)

- Token ada di `src/styles/ds-tokens.css`, diimpor oleh `globals.css`.
- Brand teal: `--ds-brand` `#20A4B0`. Tombol aksi / aksen kuning: `--ds-yellow-80` `#FDBA12` (juga `--ds-btn-primary`). Tombol sekunder hitam `#181818`. Teks tombol enable: `--ds-btn-ink` `#1A202C`.
- Netral Cloudy-0…130 untuk latar, garis, dan teks. Semantik: info biru, sukses hijau, peringatan oranye, kritis merah (solid + subtle).
- Status half/ok: `--ds-status-half` (`Orange-80`), `--ds-status-ok` (`Green-80`).
- Mode terang: latar halaman Cloudy-0 (`#FAFBFC`), kartu putih, teks Ink (`Cloudy-110`). Mode gelap: latar polos Cloudy-130, teks terang, aksen Yellow-80 dan brand teal.

### Typography (Figma `1:5287`)

- Face app: **Inter** (`next/font/google`, `--font-body`) — sama dengan Figma.
- Wordmark navbar / login (`.brand`, `.login-card h1`): Title md→lg 16–18 px Bold, tracking −0.5 px. Tagline: Subtitle xs 12/18 Semibold.
- Judul di luar tabel: Title sm→md `--ds-title-page-*` (14–16 / 22–24, Bold).
- Judul modal: Title lg 18/28 Bold.
- Tombol: Button sm 14/22 (bawaan), Button md 16/24 (`.btn-md` / `.btn-lg`), Button xs 12/18 (`.btn-sm` / `.btn-xs`).
- Form field: Body sm 14/22. Label field default (dropdown sm): Subtitle xs **12/18** Semibold; label di atas `.ds-select-lg`: 14/22.

### Button (Figma `3:4420`)

- Primary: Enable Yellow-80 + ink `#1A202C`; Hover / pressed / focus `#181818` + putih (focus border 2px Cloudy-110); Disabled Cloudy-50 + Disabled text.
- Ukuran fixed: **xs 28 / r4**, **sm 36 / r6** (`.btn` bawaan), **md 44 / r8** (`.btn-md`, navbar `--ctrl-size`), **lg 52 / r8** (`.btn-lg`).
- Hierarki: navbar md 44 > halaman sm 36 > tabel xs 28 (`.btn-sm`).
- Delete (`.btn-danger`): merah enable; hover/focus inverse.

### Badge (Figma `17:4367`)

- Class: `.ds-badge`, `.ds-badge--dot`, `.ds-badge--count`, `.ds-badge--outline`, warna `--critical` / `--neutral` / `--info`.
- Tinggi 18, radius 32, font 8 Bold; dot 8×8.

### Dropdown / Specs (Figma `24:7282` + `24:6035`)

- Small: tinggi 44, radius 12, Body sm 14/22, chevron 20. Large (`.ds-select-lg`): tinggi 56, radius 8, Body md 16/24, chevron 24.
- Focus border `--ds-border-active` `#3CB6C1`. Spacing xs 4 / sm 12.

### Layout grid (Figma `2:4146`)

- Phone &lt; 768: 4 kolom, gutter 16, margin **16**.
- Tablet ≥ 768: 8 kolom, gutter 24, margin **32**.
- Desktop ≥ 1280: 12 kolom, gutter 24, margin **64**.
- Shell chrome (hamburger / frame scale): mobile ≤767. Utilitas `.ds-grid` / `.ds-col-*`.

### Carousel / Frame anatomy

- Token `--ds-carousel-*` dan `--ds-shadow-lifted` disiapkan di `ds-tokens.css` (PageController, card radius 12). Komponen carousel image/card belum di-wire ke halaman ARMOR (tidak ada use-case di UI saat ini).

## Log

### Papan handover

- Input baris handover per tanggal dan shift (DS / NS).
- Kolom: crew, unit, location, technician, status, waiting labour, repair time, RD30, HM awal, HM akhir, Unit Back up, Back up time, breakdown problem, done / action, continue / handover, SO, lalu waktu output. SO disimpan sebagai teks dan ikut pencarian serta export. Unit Back up dan Back up time boleh kosong. Jika Unit Back up diisi, unit itu harus dipilih dari master.
- Equipment Type dan User MSD/MOD dihapus dari form, tabel, dan database.
- Form tambah dan ubah unit dibuka sebagai modal.
- Navbar kiri: logo Trakindo CAT (`public/trakindo-cat.png`), garis pemisah, lalu ARMOR + tagline (lockup kompak seperti Trakindo BEST). Klik lockup membuka halaman utama (summary). Di layar lebar tagline "Asset Readiness & Monitoring of Operational Repair" tampil di bawah ARMOR. Di layar sempit tagline disembunyikan. Wordmark ARMOR memakai tipografi Title DS (Inter Bold); mode gelap emas, mode terang hitam.
- Hierarki tinggi kontrol: navbar md 44 > toolbar halaman sm 36 > aksi tabel xs 28. Ikon bar Summary `--ctrl-size-sm` 32. Tombol ikon persegi; glyph 18.
- Tombol hamburger hanya tampil di layar sempit (≤767 px); di layar lebar disembunyikan. Menu hamburger membuka lembaran bawah berisi tahun, muat ulang, tema, dan akun.
- Judul tab diawali ARMOR, misalnya `ARMOR - Daftar unit` dan `ARMOR - Summary DT`. Halaman masuk berjudul `ARMOR`. Favicon-nya kotak kuning dengan huruf A gelap.
- Kontrol kanan navbar: muat ulang, tema, dan akun (edit profil, ubah password, logout). Superuser juga melihat Pengguna di menu akun. Tombol akun berbentuk seperti PRIMA: nama dan level di kiri, avatar di kanan. Tahun tampil di navbar pada layar lebar, tanpa label "Tahun".
- Tombol muat ulang memuat ulang data halaman yang sedang terbuka. Di summary, SUMMARY UNIT dan SUMMARY GROUP dimuat ulang. Di daftar unit, baris handover dan kolom sisa dimuat ulang. Master, backup, dan pengguna memuat ulang daftar halaman itu.
- Halaman pertama adalah summary. Judul bagian memakai huruf besar: SUMMARY UNIT, SUMMARY GROUP, dan DAFTAR UNIT.
- Di layar lebar, Daftar unit adalah tombol pertama di toolbar summary, dan Summary adalah tombol pertama di toolbar daftar unit. Di layar sempit keduanya tetap di dalam menu Kelola.
- Di summary, menu Kelola berisi Freeze kolom, Daftar unit, Master model, Master group, Master unit, dan Backup data. Di daftar unit, menu Kelola berisi Summary (paling atas), Freeze kolom, Export, Upload Excel (admin/superuser), Master model, Master group, Master unit, dan Backup data. Tahun, cari, Upload, Tambah unit, dan Mode Edit tetap di luar menu.
- Upload Excel massal (admin/superuser): di DAFTAR UNIT menambah baris handover tahun aktif (unit harus sudah ada di Master unit); di Master group menambah group + Quota Hrs; di Master unit menambah Model, Quota Hrs, Unit, dan Group (Model/Group harus sudah ada di master). Unduh template dari modal, pilih baris yang valid, lalu simpan.
- Mode Edit disimpan di perangkat. Kolom Aksi (Ubah/Hapus) hanya tampil saat Mode Edit menyala. Ubah memakai ikon pensil berwarna oranye dan Hapus memakai ikon tong sampah berwarna merah. Di layar sempit hanya ikon yang tampil. Tambah unit dan Mode Edit hanya tampil untuk superuser dan admin.
- Pada form ubah daftar unit, Simpan nonaktif sampai ada isian yang berbeda dari data saat form dibuka. Mengembalikan isian semula menonaktifkan Simpan lagi. Form tambah tetap bisa disimpan.
- Di layar sempit, tombol toolbar (Jam, Hari, Cari, Kelola, Tambah unit, Mode Edit, Info, dan Setting) menampilkan ikon saja, berukuran 34 px, lebih kecil dari tombol desktop. Nama tombol muncul saat ikon di-hover atau diketuk. Di daftar unit, baris tombol itu ada di atas kolom pencarian. Filter tahun ada di samping judul DAFTAR UNIT, SUMMARY UNIT, dan MASTER UNIT, sejajar dengan tulisan judul, dengan huruf lebih kecil dari judul.
- Kotak pencarian dan tombol Cari menempel jadi satu kontrol: tanpa jarak, tinggi sama, dan sudut yang berhadapan rata. Di layar sempit tinggi keduanya 34 px. Penyaringan summary, daftar unit, backup, master unit, dan master group baru jalan setelah tombol Cari diklik, atau setelah Enter. Mengosongkan kotak menampilkan semua baris lagi.
- Di layar sempit, Info, Setting, Kelola, menu navbar, menu akun, dan formulir tampil sebagai panel di bagian bawah. Halaman di belakangnya diredupkan satu lapisan, sama seperti modal form. Mengetuk area di luar panel menutupnya.
- Tambah unit ada di daftar unit.
- Tabel penuh, teks remark membungkus, angka rata kanan. Jam di DAFTAR UNIT, SUMMARY UNIT, dan SUMMARY GROUP memakai pemisah ribuan (contoh 6,792.50). Quota di input master tetap tanpa pemisah.
- Mode terang memakai latar halaman Cloudy-0 (`#FAFBFC`) dari Color Guideline. Kartu putih, tombol utama kuning (`Yellow-80`) dengan teks gelap. Tombol dan kartu terangkat sedikit saat kursor di atasnya.
- Tiga kolom pertama di daftar unit (#, Crew, Unit) dan di summary (Model atau Group, Quota, Unit) bisa dibekukan lewat "Freeze kolom" di menu Kelola. Di master unit, Freeze kolom ada di menu Setting dan membekukan Model, Quota Hrs, dan Unit. Pengaturan disimpan di perangkat dan dipakai ketiga halaman. Default menyala.
- Pencarian daftar unit selalu tampil, menempel dengan tombol Cari. Penyaringan jalan setelah tombol Cari diklik, atau setelah Enter. Tombol X mengosongkan pencarian dan menampilkan semua baris. Jika tidak ada yang cocok, pesannya "Tidak ada data yang cocok."
- Nomor baris asli tetap saat hasil pencarian disaring.
- Di layar sempit, tombol navbar (kecuali hamburger) masuk ke menu hamburger. Lembaran menu itu memakai latar yang sama dengan menu Kelola: kartu di bagian bawah, bukan layar hitam penuh.
- Panel Summary by Model ada di atas tabel Master unit dan di Daftar unit, menggantikan kartu Baris, N/Y Ready, RD30, dan Status RT. Satu model satu kartu, di dalam satu panel. Di Master unit kartunya memakai semua unit master. Di Daftar unit, unit yang masuk adalah unit unik pada tabel tahun yang dipilih; model dan quota diambil dari master. Nama model tetap tampil.
- Angka utama kartu adalah Sisa Daily. Di mode Jam angkanya jam:menit. Di bawahnya Quota dan Jam Daily, lalu sisa WTD, MTD, HYTD 1, HYTD 2, dan YTD. Model yang jamnya 0 tetap menampilkan sisa penuh di kartu. Di tabel, sel sisa tetap kosong bila jam unit itu 0. Garis kiri kartu hijau bila sisa Daily masih di atas setengah quota, oranye bila setengah atau kurang, dan merah bila minus. Unit N/Y Ready merah bertanda `*`. Unit yang sudah ada backup hijau tanpa tanda bintang. Kartu diurutkan dari model yang unit N/Y Ready-nya paling banyak. Di dalam satu kartu, unit N/Y Ready ditulis lebih dulu. Di layar sempit kartu tersusun satu kolom.
- Tombol panah di kanan judul menyembunyikan panel Summary by Model, tabel Master unit, dan tabel Daftar unit. Pilihan sembunyi dan tampil disimpan di perangkat lewat Zustand. Tombol gerigi Data kartu memilih bagian yang tampil di setiap kartu: Unit, Sisa Daily, Quota, Jam, WTD, MTD, HYTD 1, HYTD 2, dan YTD. Pilihan yang sama dipakai Master unit dan Daftar unit.
- Di Master unit, ikon WhatsApp pada bar Summary by Model (admin/superuser) membuka modal "Kirim ke WhatsApp?". Summary by Model baru terkirim setelah tombol Kirim diklik. Batal menutup modal. Ikon jam (hanya superuser) mengatur kirim otomatis.
- Pengiriman memakai Fonnte. Token perangkat diisi di `FONNTE_TOKEN`, dan id grup WhatsApp di `FONNTE_GROUP` (bentuknya `120363...@g.us`, bukan nama grup). Keduanya ada di `.env` server. Pesan memakai tahun, mode Jam/Hari, dan data kartu yang sedang tampil saat dikirim atau saat jadwal disimpan.
- Isi pesan: nama model, jumlah unit, kode unit (N/Y Ready tetap bertanda `*`), Sisa Daily, quota, jam, lalu WTD sampai YTD sesuai bagian kartu yang tampil. Gambar kartu ikut dilampirkan. Paket Fonnte Free hanya mengirim teks. Gambar kartu terkirim pada paket Super, Advanced, atau Ultra.
- Kirim otomatis disimpan di database. Interval paling rapat 30 menit, dengan pilihan 30 menit, 1 jam, 2 jam, 3 jam, 6 jam, atau 12 jam. Jam aktif bawaan 06:00–22:00; di luar jam itu pesan tidak dikirim. Kiriman pertama menunggu satu interval setelah jadwal disimpan. Jika server sempat mati, pesan yang terlewat tidak dikirim bertumpuk. Server memeriksa jadwal kira-kira setiap menit, dan hanya menyusun pesan saat waktunya kirim.
- Judul tabel Daftar unit adalah JUMLAH UNIT YANG N/Y READY diikuti jumlahnya. Seluruh judul berwarna merah, tebal, dan huruf besar. Jumlah itu adalah unit unik yang masih N/Y Ready dan Unit Back up-nya kosong. Unit yang sudah RD30 atau sudah ada backup tidak dihitung. Satu kode unit yang muncul di beberapa baris dihitung satu kali. Saat tabel disembunyikan, angka itu tetap tertulis. Judul tabel Master unit tetap Tabel.
- Tombol Tambah unit menampilkan ikon +.
- Filter papan adalah tahun saja, dan tahun yang sama dipakai summary serta kolom periode di master unit. Pilihan disimpan di perangkat. Daftar menampilkan semua baris handover tahun itu, kedua shift. Di layar lebar pemilih tahun ada di navbar. Di layar sempit pemilih tahun ada di samping judul DAFTAR UNIT, SUMMARY UNIT, dan MASTER UNIT.
- Urutan bawaan daftar adalah DT Total: baris N/Y Ready di atas, lalu angka DT terbesar. Klik judul kolom mengubah urutan; klik lagi membalik arahnya. Panah di judul menunjukkan kolom yang aktif.
- Unit baru pada tahun berjalan masuk ke sheet hari ini dan shift bawaan. Jika tahun yang dipilih bukan tahun ini, sheet-nya 1 Januari shift DS. Mengubah baris tidak memindahkan sheet-nya.
- Export membuka modal tahun. Bawaannya tahun ini, bukan tahun yang sedang dipilih di papan. File `Export Data Armor yyyymmdd hhmm.xlsx` memakai waktu saat tombol Export diklik. Isinya dua sheet: Handover (seluruh baris tahun itu, termasuk SO dan Sisa Quota Hrs, tidak mengikuti pencarian yang aktif) dan Summary (SUMMARY UNIT beserta rincian unit, lalu SUMMARY GROUP, dengan Quota Hrs, Jam, dan Sisa). Model dengan lebih dari satu unit menulis baris rincian di bawah model dan bisa dilipat di Excel. Sel tabel berbingkai garis tipis.

### Perhitungan

- ERDM = HM akhir − HM awal.
- Waiting = Repair Time − Waiting Labour.
- Jika RD30 terisi, Repair = RD30 − Repair Time dan DT Total = waiting + repair.
- Jika RD30 kosong dan Repair Time terisi, Repair = jam sekarang − Repair Time, dan DT Total menampilkan "N/Y Ready".
- Setelah DT Total ada Sisa Quota Hrs: Daily, WTD, MTD, HYTD 1, HYTD 2, dan YTD. Angkanya sama dengan sisa summary untuk tahun yang dipilih. Unit dalam satu model menampilkan sisa modelnya.
- Repair yang masih berjalan dihitung ulang otomatis setiap 30 detik, tanpa muat ulang halaman. Angka dibulatkan dua desimal, jadi perubahan 0.01 baru terlihat setelah sekitar 36 detik.
- Jika RD30 sudah terisi, Repair tidak bertambah lagi.
- Status tidak bisa diketik. Kosong jika waiting, repair, dan RD30 kosong. RT jika waiting atau repair terisi dan RD30 kosong. RD30 jika waktu RD30 terisi.
- HM akhir yang lebih kecil dari HM awal ditolak. Pesan muncul saat field diisi, tidak hanya saat Simpan. Nilai yang sama tetap boleh. Salah satu sisi boleh kosong.

### Tanggal

- Waktu di modal memakai teks `dd/mm/yyyy hh:mm` (24 jam). Nilai disimpan sebagai `YYYY-MM-DDTHH:mm`.
- Ikon jam membuka daftar jam 00–23 dan menit 00–59, tanpa AM/PM. Jika waktu masih kosong, klik ikon jam mengisi tanggal hari ini dan jam sekarang. Waktu yang sudah tersimpan tidak berubah.
- Tanggal sheet tidak lagi menjadi filter papan. Filter yang tampil hanya tahun.
- Crew, Unit, dan Waiting Labour wajib diisi, ditandai bintang merah. Tombol Simpan nonaktif selama salah satunya masih kosong.
- Waiting Labour, Repair Time, dan RD30 tidak terisi sendiri saat form dibuka.

### Master model, master unit, dan master group

- Master model: nama model di halaman `/master/model`. Model wajib dan unik. Dipakai pilihan Model di form Master unit dan validasi Upload Excel master unit. Tabel `unit_models` dibuat lewat `npm run db:ensure`.
- Master unit: Model, Quota Hrs, Unit, lalu Daily, WTD, MTD, HYTD 1, HYTD 2, dan YTD, kemudian Group, Quota Hrs (GROUP), dan keenam periode yang sama. Tiap periode punya Quota Hrs, Jam, dan Sisa, dengan warna yang sama seperti summary. Sisi unit memakai quota dan jam unit itu. Sisi group memakai quota group dan jumlah jam anggotanya. Group kosong menampilkan —. Jam dan Sisa mengikuti tahun di navbar: tahun berjalan sampai hari ini, tahun lain sampai 31 Desember. Di mode Jam, Jam Daily dan Sisa Daily tampil jam:menit; periode lain tetap desimal. Bisa tambah, ubah, hapus, dan Upload Excel. Model dipilih dari Master model. Group boleh kosong. Tambah, ubah, dan hapus hanya untuk superuser dan admin.
- Tombol Setting di master unit memilih Quota Hrs, Jam, dan Sisa pada blok periode, pilihan yang sama dengan summary, dan minimal satu kolom tetap tampil. Freeze kolom ada di menu itu.
- Tombol Export mengunduh seluruh master unit, tidak mengikuti pencarian. File `Export Master Unit Armor yyyymmdd hhmm.xlsx` punya sheet Master unit. Jam di Excel tetap desimal, untuk tahun yang sedang dipilih.
- Klik judul kolom di master unit dan master group mengubah urutan. Klik lagi membalik arahnya. Panah di judul menunjukkan kolom yang aktif. Kolom Aksi tidak diurutkan, dan nilai kosong berada di akhir.
- Pada form ubah master unit dan master group, Simpan nonaktif sampai ada isian yang berubah.
- Halaman master unit, master group, dan backup punya tombol Kembali berikon panah. Pencarian (Cari group, Cari model atau unit, Cari data atau pengguna) menempel dengan tombol Cari dan baru menyaring setelah tombol itu diklik. Tombol Tambah ada sebelum pencarian.
- Di layar sempit pada ketiga halaman itu, Kembali hanya ikon dan berada di kanan judul. Tombol Master unit atau Master group hanya ikon. Tombol Tambah hanya ikon + dan tetap sebelum pencarian. Di layar lebar ketiga tombol itu menampilkan ikon beserta tulisannya.
- Group di form unit adalah pencarian dari master group. Nama yang tidak ada di master tidak disimpan. Memilih group tidak mengubah Quota Hrs unit itu sendiri.
- Quota Hrs (GROUP) di tabel unit diambil dari master group. Group kosong menampilkan —.
- Master group: Group dan Quota Hrs, di halaman `/master/group`. Group wajib dan unik. Mengganti nama group ikut memperbarui unit yang memakainya. Group yang masih dipakai unit tidak bisa dihapus.
- Field Unit di form handover wajib dan merupakan pilihan yang bisa dicari dari master (kode unit atau model). Unit yang tidak ada di master tidak bisa disimpan.
- Jika data valid, Simpan menampilkan modal "Simpan data?" beserta nama unit. Data baru tertulis setelah Simpan di modal itu diklik. Batal menutup modal dan form tetap terbuka.
- Model dan quota jam unit yang dipilih tampil di bawah field.

### Summary DT

- Summary adalah halaman pertama. `/summary` ikut membuka halaman itu. Di layar lebar, Daftar unit dibuka dari tombol pertama di toolbar. Di layar sempit, Daftar unit dibuka dari Kelola.
- Satu kotak pencarian di sebelah kanan tombol Daftar unit menyaring SUMMARY UNIT dan SUMMARY GROUP sekaligus. Kata kuncinya dicocokkan ke model, nomor unit, atau nama group. Penyaringan jalan setelah Cari atau Enter. Mengosongkan kotak menampilkan semua baris. Jika tidak ada yang cocok, pesannya "Tidak ada yang cocok."
- Klik judul kolom di summary unit dan summary group mengubah urutan. Klik lagi membalik arahnya. Panah di judul menunjukkan kolom yang aktif. Baris rincian tetap mengikuti modelnya.
- Tombol Info membuka catatan berbagian: tanggal dan unit N/Y Ready di atas, lalu Satuan, Daily, WTD hingga YTD, Quota periode (per baris), Sisa, dan Unit Back up. Panel bisa digulir. Tombol Setting memilih kolom Quota Hrs, Jam, dan Sisa; pilihan disimpan di perangkat, minimal satu kolom tetap tampil.
- Tombol Jam dan Hari ada di toolbar summary dan daftar unit, dengan ikon jam dan kalender, serta jarak yang sama seperti tombol lain. Pilihan yang sama dipakai kedua halaman dan disimpan di perangkat. Hari membagi quota, jam, sisa, Waiting Labour, Repair time, dan DT Total dengan 24 (1 hari = 24 jam). Judul kolom summary menjadi Quota Hari dan Hari; judul sisa di daftar unit menjadi Sisa Quota Hari. N/Y Ready tetap teks. Waktu, HM, dan ERDM tidak dikonversi. Jam mengembalikan angka semula. Export Excel tetap dalam jam.
- Dua tabel terpisah supaya jam unit tidak terhitung dua kali: summary unit (per model) dan summary group.
- Dropdown tahun di summary memakai pilihan yang sama dengan daftar unit. Tahun berjalan dihitung sampai hari ini. Tahun lain dihitung sampai 31 Desember tahun itu, dan hanya baris yang tanggal Waiting Labour-nya jatuh pada jendela tahun itu yang masuk.
- Yang tampil hanya unit yang pernah ada di daftar handover. Group tanpa anggota di daftar disembunyikan.
- Jam = Waiting Labour + Repair time. Baris tanpa Repair Time tidak dijumlah. WTD, MTD, HYTD 1, HYTD 2, dan YTD mengikuti tanggal Waiting Labour. Tanggal sheet tidak dipakai untuk periode itu maupun sebagai cadangan. Waiting Labour kosong tidak masuk keenam periode. Seluruh jam baris melekat pada tanggal Waiting Labour untuk WTD sampai YTD, tidak dipecah per hari. DS dan NS pada tanggal yang sama digabung. Setiap jam dibulatkan dua desimal sebelum dijumlah.
- Jam Daily hanya menghitung bagian downtime pada hari yang sedang berjalan. Pada hari Waiting Labour, hitungan mulai dari jam Waiting Labour. Setelah lewat 00:00 hari berikutnya, Jam Daily kembali ke nol dan dihitung dari 00:00 hari itu. Contoh: Waiting Labour 1 Okt 02:44 yang masih berjalan, pada 2 Okt pukul 08:00 Jam Daily-nya 8 jam, bukan jam sejak 1 Okt. Unit yang RD30-nya sudah terisi sebelum tengah malam tidak menambah Jam Daily hari berikutnya. Sisa Daily mengikuti jam baru itu. WTD sampai YTD tetap memakai seluruh jam.
- Di mode Jam, Jam Daily dan Sisa Daily tampil sebagai jam:menit. Angka 12.89 menjadi 12:53. WTD sampai YTD, Quota, mode Hari, dan Export Excel tetap angka desimal.
- Jika Unit Back up pada baris handover terisi, jam baris itu tidak dijumlah ke Daily, WTD, MTD, HYTD 1, HYTD 2, dan YTD. Nama unit berwarna hijau dan tanpa tanda `*`. Baris lain pada unit yang sama, yang Unit Back up-nya kosong, tetap dihitung.
- Jika RD30 terisi, repair memakai jam tersimpan. Jika masih N/Y Ready, repair = jam sekarang − Repair Time dan terus bertambah (dimuat ulang setiap 30 detik). Kode unit N/Y Ready berwarna merah dan diberi `*` di kolom Unit saja. Unit N/Y Ready yang Unit Back up-nya terisi berwarna hijau dan tanpa `*`.
- Kolom mengikuti `Summary.xlsx`: tiap periode punya Quota Hrs, Jam, dan Sisa. Warna periode dibedakan: Daily kuning, WTD biru, MTD hijau, HYTD 1 abu-abu, HYTD 2 ungu, YTD oranye. Kode unit disusun ke bawah.
- Sisa = quota periode − jam. Sisa kosong jika jam 0, dan merah jika negatif. Daily yang melebihi Quota Hrs unit juga merah. Lingkaran di kiri angka sisa berwarna merah jika minus, oranye jika tersisa 50% atau kurang, dan hijau jika tersisa lebih dari 50%. Lingkaran rata kiri di dalam kolom. Baris unit di dalam model memakai sisa modelnya, bukan sisa unit itu sendiri.
- Quota periode adalah Quota Hrs × jumlah hari, bukan penjumlahan quota unit:
  - Daily memakai Quota Hrs unit (satu hari).
  - WTD = Quota Hrs × 7.
  - MTD = Quota Hrs × tanggal hari ini.
  - HYTD 1 = Quota Hrs × hari dari 1 Jan sampai 30 Jun. Jika hari ini masih di semester pertama, hari dihitung sampai hari ini.
  - HYTD 2 = Quota Hrs × hari dari 1 Jul sampai hari ini. Sebelum 1 Jul, quota-nya 0.
  - YTD = Quota Hrs × hari dari 1 Jan sampai hari ini.
- Baris model dikelompokkan dan tertutup secara bawaan. Tombol + di sebelah kanan nama model membuka rincian unit. Model dengan satu unit tidak punya tombol. Quota di baris model adalah quota unit yang sama; jika quota anggotanya berbeda, yang tampil —. Jam baris model adalah jumlah jam unit di dalamnya. Sisa rincian unit mengikuti sisa modelnya.
- Baris group memakai quota group, dan jam-nya adalah jumlah jam unit anggota yang ada di daftar.

### Backup data

- Ubah dan hapus pada baris daftar unit, master unit, dan master group menyimpan cadangan di tabel `data_backups` sebelum data berubah. Data yang baru ditambah tidak dicadangkan.
- Setiap cadangan menyimpan isi data sebelumnya, pengguna (id, nama, dan username), serta tanggal dan waktu aksi.
- Menu Kelola → Backup data (hanya admin/superuser) membuka halaman `/backup`. Role user tidak melihat menu itu dan dibatasi di server. Daftar menampilkan waktu, aksi (Ubah atau Hapus), jenis, nama data, dan pengguna. Tombol Lihat membuka isi cadangan. Pencarian data atau pengguna menempel dengan tombol Cari. Jika tidak ada yang cocok, pesannya "Tidak ada data yang cocok." Di layar sempit tombol Kembali hanya ikon dan berada di kanan judul.
- Daftar backup menampilkan 10 baris per halaman. Di bawah tabel ada tombol halaman sebelumnya, nomor halaman, dan halaman berikutnya. Halaman yang sedang dibuka berwarna amber. Nomor yang jauh diringkas dengan tanda elipsis. Pencarian kembali ke halaman pertama. Jika hasilnya hanya satu halaman, navigasi disembunyikan.

### Login, peran, dan offline

- Login memakai tabel `users` lokal lewat NextAuth. Level yang dipakai aplikasi adalah superuser, admin, dan user. Detail hardening ada di bagian **Keamanan** di atas.
- Superuser dan admin boleh menambah, mengubah, dan menghapus data daftar unit, master unit, dan master group. Role user hanya melihat data. Tombol Tambah, Mode Edit, Ubah, dan Hapus disembunyikan, dan server menolak simpan atau hapus dari role itu.
- Backup data dan kirim WhatsApp hanya untuk admin/superuser. Jadwal WhatsApp otomatis di UI hanya untuk superuser.
- Menu akun superuser punya Pengguna, di halaman `/pengguna`. Role lain tidak melihat menu itu. Membuka alamatnya langsung dikembalikan ke beranda, dan server menolak permintaan datanya.
- Superuser menambah, mengubah, dan menghapus pengguna: username, nama, level, status aktif, dan password (minimal 8 karakter). Password saat ubah boleh dikosongkan jika tidak diganti. Akun yang sedang dipakai tidak bisa dihapus dan harus tetap superuser aktif. Simpan pada form ubah nonaktif sampai ada perubahan.
- Draft ketikan disimpan di perangkat, per tahun dan baris yang sedang diubah. Pesan "Draft dipulihkan dari perangkat" berarti form diisi lagi dari ketikan yang belum disimpan, bukan dari database.
- Buang draft mengembalikan data terakhir yang sudah disimpan. Simpan menulis ke database.
- Perubahan yang gagal terkirim saat offline masuk antrean dan dikirim saat online.
- Chip Online disembunyikan saat koneksi normal. Chip tetap tampil untuk Offline, Menyinkronkan, Gagal sinkron, atau data yang masih menunggu. Mengklik chip membuka panel data yang menunggu: aksi (Tambah, Ubah, atau Hapus), unit, crew, dan waktu antrean. Jika antrean kosong, pesannya "Tidak ada data menunggu." Tombol Kirim sekarang mengirim antrean setelah perangkat tersambung.
- Tambah, ubah, dan hapus yang berhasil pada daftar unit, master unit, master group, dan pengguna memberitahu browser lain yang sedang membuka aplikasi. Halaman yang terbuka memuat ulang datanya, tanpa memuat ulang seluruh browser. Selama offline atau masih ada antrean, pemuatan ulang itu ditunda sampai koneksi kembali dan antreannya kosong.
