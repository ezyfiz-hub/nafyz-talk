# NaFyzTalk - Platform Chat & WebRTC P2P

NaFyzTalk ialah platform komunikasi masa nyata tanpa login. Disebabkan persekitaran pembangunan WebRTC dan WebSocket memerlukan pelayan (*server*) sebenar untuk perhubungan isyarat (*signaling*) dan perkongsian fail, anda perlu menjalankannya menggunakan Node.js.

## Ciri-ciri
- Ruang Chat Awam dengan nama samaran (Guest).
- Panggilan Suara & Video 1-ke-1 (WebRTC sebenar).
- Mesej Suara terbina dalam.
- Perkongsian Imej & Fail (had 50MB).
- Antara Muka Responsif, Minimalis, Mod Gelap terbina dalam.

## Syarat-syarat
- **Node.js** (Versi 14 dan ke atas)

## Langkah-Langkah Menjalankan Projek

1. **Simpan Fail**: 
   Pastikan anda menyimpan fail dalam struktur folder berikut:
   ```
   nafyz-talk/
   ├── package.json
   ├── server.js
   ├── README.md
   └── public/
       └── index.html
   ```

2. **Pasang Dependencies**:
   Buka terminal di dalam folder `nafyz-talk/` dan jalankan arahan ini:
   ```bash
   npm install
   ```

3. **Mulakan Pelayan**:
   Jalankan pelayan Node.js:
   ```bash
   npm start
   ```

4. **Uji Laman Web**:
   Buka pelayar web dan pergi ke:
   👉 **http://localhost:3000**

   *Nota PENTING untuk WebRTC*: Ciri Kamera dan Mikrofon (WebRTC) pada pelayar web hanya berfungsi di bawah domain **`localhost`** atau sambungan **`HTTPS`**.

## Menguji Panggilan Suara/Video
Untuk menguji fungsi panggilan:
1. Buka dua tab berbeza pada `http://localhost:3000`.
2. Anda akan melihat dua pengguna online (contoh: Guest-1234 dan Guest-5678).
3. Pada pengguna pertama, klik ikon Telefon atau Kamera bersebelahan nama pengguna kedua.
4. Tab kedua akan memaparkan notifikasi panggilan masuk. Klik butang hijau untuk menerima.
5. Anda mesti membenarkan akses Mikrofon/Kamera apabila diminta oleh pelayar (browser).

## Struktur Senibina WebRTC
- **Signaling**: WebSocket (`ws` library Node.js) digunakan untuk menukar mesej pertukaran maklumat SDP (`Offer` / `Answer`) dan calon `ICE`.
- **STUN Server**: Menggunakan server STUN awam Google (`stun:stun.l.google.com:19302`) secara lalai untuk menebuk lubang NAT (NAT Traversal).
- **Video Palsu/Placeholder**: Projek ini **TIDAK** menggunakan video simulasi. Kesemua isyarat diproses menggunakan `RTCPeerConnection` dari API WebRTC tempatan.

## Isu Persekitaran Selamat
Sekiranya anda mencuba aplikasi ini dari prapapar (preview static), anda hanya dapat melihat antara muka sahaja. WebSockets akan cuba bersambung, dan bergantung kepada dasar keselamatan pelayar, ia mungkin tidak dibenarkan tanpa *backend* yang aktif. Sila ikuti langkah di atas untuk pengalaman sebenar.