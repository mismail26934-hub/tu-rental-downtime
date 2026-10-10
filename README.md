# TU Rental — Handover

Aplikasi input handover downtime shift. Data mengikuti kolom sheet Excel handover. Tampilan berbahasa Indonesia.

## Menjalankan

- Dev server: `npm run dev` di http://localhost:3010
- Schema database: `npm run db:ensure`
- Seed akun admin (hanya jika username belum ada): `npm run seed`
- Login awal: `admin` / `admin`

Database aplikasi adalah `tu_rental` di MariaDB lokal. Tabel `users` mengikuti bentuk `tu_prima.users`, tetapi aplikasi ini tidak menulis ke database `tu_prima`.

## Log

### Papan handover

- Input baris handover per tanggal dan shift (DS / NS).
- Kolom: crew, unit, location, technician, status, waiting labour, repair time, RD30, HM awal, HM akhir, breakdown problem, done / action, continue / handover, SO, lalu waktu output. SO disimpan sebagai teks dan ikut pencarian serta export.
- Equipment Type dan User MSD/MOD dihapus dari form, tabel, dan database.
- Form tambah dan ubah unit dibuka sebagai modal.
- Navbar memakai gaya terang: muat ulang, bahasa, tema, dan akun (edit profil, ubah password, logout).
- Halaman pertama adalah summary. Daftar unit ada di `/daftar`, dibuka dari menu Kelola.
- Di summary, menu Kelola berisi Daftar unit, Master group, dan Master unit. Di daftar unit, menu Kelola berisi Freeze kolom, Export, Summary, Master group, dan Master unit. Tahun, cari, Tambah unit, dan Mode Edit tetap di luar menu.
- Mode Edit disimpan di perangkat. Kolom Aksi (Ubah/Hapus) hanya tampil saat Mode Edit menyala.
- Di layar sempit, tombol Cari, Kelola, Tambah unit, Mode Edit, Info, dan Setting menampilkan ikon saja.
- Tambah unit ada di daftar unit.
- Tabel penuh, teks remark membungkus, angka rata kanan.
- Tiga kolom pertama (#, Crew, Unit) bisa dibekukan. Pengaturan "Freeze kolom" disimpan di perangkat. Default menyala.
- Pencarian daftar unit selalu tampil. Penyaringan jalan setelah tombol Cari diklik, atau setelah Enter. Tombol X mengosongkan pencarian dan menampilkan semua baris. Jika tidak ada yang cocok, pesannya "Tidak ada data yang cocok."
- Nomor baris asli tetap saat hasil pencarian disaring.
- Di layar sempit, tombol navbar masuk ke menu hamburger.
- Kartu ringkasan (Baris, N/Y Ready, RD30, Status RT) di layar mobile tersusun 2×2.
- Tombol Tambah unit menampilkan ikon +.
- Filter papan adalah tahun saja, dan tahun yang sama dipakai summary. Pilihan disimpan di perangkat. Daftar menampilkan semua baris handover tahun itu, kedua shift.
- Urutan bawaan daftar adalah DT Total: baris N/Y Ready di atas, lalu angka DT terbesar. Klik judul kolom mengubah urutan; klik lagi membalik arahnya. Panah di judul menunjukkan kolom yang aktif.
- Unit baru pada tahun berjalan masuk ke sheet hari ini dan shift bawaan. Jika tahun yang dipilih bukan tahun ini, sheet-nya 1 Januari shift DS. Mengubah baris tidak memindahkan sheet-nya.
- Export membuka modal tahun. Bawaannya tahun ini, bukan tahun yang sedang dipilih di papan. File `handover-YYYY.xlsx` berisi seluruh baris tahun itu, termasuk SO dan Sisa Quota Hrs, tidak mengikuti pencarian yang aktif.

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

- Waktu di modal memakai teks `dd/mm/yyyy hh:mm`, plus pemilih tanggal dan pemilih jam.
- Nilai disimpan sebagai `YYYY-MM-DDTHH:mm`.
- Tanggal sheet tidak lagi menjadi filter papan. Filter yang tampil hanya tahun.
- Waiting Labour, Repair Time, dan RD30 tidak diisi otomatis dengan hari ini.

### Master unit dan master group

- Master unit: Model, Quota Hrs, Unit, Group, dan Quota Hrs (GROUP). Bisa tambah, ubah, dan hapus lewat tombol Master unit. Group boleh kosong.
- Group di form unit adalah pencarian dari master group. Nama yang tidak ada di master tidak disimpan. Memilih group tidak mengubah Quota Hrs unit itu sendiri.
- Quota Hrs (GROUP) di tabel unit diambil dari master group. Group kosong menampilkan —.
- Master group: Group dan Quota Hrs, di halaman `/master/group`. Group wajib dan unik. Mengganti nama group ikut memperbarui unit yang memakainya. Group yang masih dipakai unit tidak bisa dihapus.
- Field Unit di form handover adalah pilihan yang bisa dicari dari master (kode unit atau model).
- Model dan quota jam unit yang dipilih tampil di bawah field.
- Unit yang tidak ada di master tidak bisa disimpan.

### Summary DT

- Summary adalah halaman pertama. `/summary` ikut membuka halaman itu. Daftar unit dibuka dari Kelola.
- Tombol Info menampilkan catatan tanggal, jumlah unit N/Y Ready, dan rumus jam, quota, serta sisa. Tombol Setting memilih kolom Quota Hrs, Jam, dan Sisa. Pilihan disimpan di perangkat, dan minimal satu kolom tetap tampil.
- Dua tabel terpisah supaya jam unit tidak terhitung dua kali: summary unit (per model) dan summary group.
- Dropdown tahun di summary memakai pilihan yang sama dengan daftar unit. Tahun berjalan dihitung sampai hari ini. Tahun lain dihitung sampai 31 Desember tahun itu, dan hanya baris pada jendela tahun itu yang masuk.
- Yang tampil hanya unit yang pernah ada di daftar handover. Group tanpa anggota di daftar disembunyikan.
- Jam = Waiting Labour + Repair time. Baris tanpa Repair Time tidak dijumlah. Waiting Labour kosong dihitung 0. Seluruh jam baris melekat pada tanggal sheet-nya, tidak dipecah per hari. DS dan NS pada tanggal yang sama digabung. Setiap jam dibulatkan dua desimal sebelum dijumlah.
- Jika RD30 terisi, repair memakai jam tersimpan. Jika masih N/Y Ready, repair = jam sekarang − Repair Time dan terus bertambah (dimuat ulang setiap 30 detik). Kode unit N/Y Ready berwarna merah dan diberi `*` di kolom Unit saja.
- Kolom mengikuti `Summary.xlsx`: tiap periode punya Quota Hrs, Jam, dan Sisa. Warna periode dibedakan: Daily kuning, WTD biru, MTD hijau, HYTD 1 abu-abu, HYTD 2 ungu, YTD oranye. Kode unit disusun ke bawah.
- Sisa = quota periode − jam. Sisa kosong jika jam 0, dan merah jika negatif. Daily yang melebihi Quota Hrs unit juga merah. Lingkaran di kiri angka sisa berwarna merah jika minus, oranye jika tersisa 50% atau kurang, dan hijau jika tersisa lebih dari 50%. Lingkaran rata kiri di dalam kolom. Baris unit di dalam model memakai sisa modelnya, bukan sisa unit itu sendiri.
- Quota periode adalah Quota Hrs × jumlah hari, bukan penjumlahan quota unit:
  - Daily memakai Quota Hrs unit (satu hari).
  - WTD = Quota Hrs × hari berjalan sejak Senin. Sabtu adalah hari ke-6, Minggu hari ke-7.
  - MTD = Quota Hrs × tanggal hari ini.
  - HYTD 1 = Quota Hrs × hari dari 1 Jan sampai 30 Jun. Jika hari ini masih di semester pertama, hari dihitung sampai hari ini.
  - HYTD 2 = Quota Hrs × hari dari 1 Jul sampai hari ini. Sebelum 1 Jul, quota-nya 0.
  - YTD = Quota Hrs × hari dari 1 Jan sampai hari ini.
- Baris model dikelompokkan dan tertutup secara bawaan. Tombol + di sebelah kanan nama model membuka rincian unit. Model dengan satu unit tidak punya tombol. Quota di baris model adalah quota unit yang sama; jika quota anggotanya berbeda, yang tampil —. Jam baris model adalah jumlah jam unit di dalamnya. Sisa rincian unit mengikuti sisa modelnya.
- Baris group memakai quota group, dan jam-nya adalah jumlah jam unit anggota yang ada di daftar.

### Login dan offline

- Login memakai tabel `users` lokal lewat NextAuth.
- Draft ketikan disimpan di perangkat, per tahun dan baris yang sedang diubah. Pesan "Draft dipulihkan dari perangkat" berarti form diisi lagi dari ketikan yang belum disimpan, bukan dari database.
- Buang draft mengembalikan data terakhir yang sudah disimpan. Simpan menulis ke database.
- Perubahan yang gagal terkirim saat offline masuk antrean dan dikirim saat online.
