# Discord Presence Tracker

Theo dõi trạng thái online/offline của một người dùng Discord và ghi log liên tục lên Google Sheets.

## Cảnh báo quan trọng

Dự án này sử dụng **self-bot** — tự động hóa tài khoản người dùng thật của Discord. Theo [Điều khoản Dịch vụ Discord](https://discord.com/terms), điều này **không được phép** và có thể dẫn đến **khóa vĩnh viễn tài khoản**. Hãy cân nhắc rủi ro trước khi sử dụng.

## Yêu cầu

- Node.js 18 trở lên (đã test với Node 22)
- Một Google Cloud Service Account + file `credentials.json`
- Một Google Sheet đã share cho email của Service Account (quyền Editor)
- Tài khoản Discord và token của tài khoản đó

## Cài đặt

```bash
cd discord-tracker
npm install
```

## Cấu hình

### 1. Đặt file `credentials.json`

Sao chép file JSON tải về từ Google Cloud Console vào thư mục gốc của dự án, đổi tên thành `credentials.json`.

### 2. Share Google Sheet

Mở file `credentials.json`, tìm dòng `client_email` (dạng `xxx@xxx.iam.gserviceaccount.com`), sau đó mở Google Sheet của bạn → bấm **Share** → dán email đó vào → cấp quyền **Editor**.

### 3. Điền file `.env`

Mở file `.env` và điền các giá trị:

```env
DISCORD_TOKEN=token_discord_cua_ban
TARGET_USERNAME=username_can_theo_doi
SPREADSHEET_ID=id_google_sheet
SHEET_NAME=Sheet1
TIMEZONE=Asia/Ho_Chi_Minh
```

**Cách lấy DISCORD_TOKEN:**
1. Mở Discord trên trình duyệt, đăng nhập
2. Mở DevTools (F12) → tab **Network**
3. Gửi một tin nhắn bất kỳ
4. Tìm request → mở **Headers** → copy giá trị `authorization` (KHÔNG bao gồm chữ `Bearer`)

**Cách lấy SPREADSHEET_ID:** Mở Google Sheet, copy phần giữa `/d/` và `/edit` trong URL.

## Chạy

```bash
node selfbot.js
```

## Điều kiện để hoạt động

Selfbot này chỉ nhận được sự kiện `presenceUpdate` khi:
- Tài khoản selfbot **CHIA SẺ CHUNG SERVER** với người dùng mục tiêu
- Người dùng mục tiêu **KHÔNG bật chế độ ẩn trạng thái** trong Settings → Privacy & Safety
- Token còn hiệu lực và tài khoản chưa bị khóa

## Định dạng log trên Google Sheet

Mỗi dòng mới được thêm vào cuối sheet với 3 cột:

| Thời gian | Username | Trạng thái |
|-----------|----------|------------|
| 02/07/2026, 08:33:00 | thanhduykx | online |
| 02/07/2026, 09:15:23 | thanhduykx | offline |

Các giá trị `status` có thể: `online`, `idle` (AFK), `dnd` (Do Not Disturb), `offline`.

## Khắc phục lỗi thường gặp

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-----------|-----------|
| `Logged in as ... but error: Something took too long` | Token không hợp lệ | Lấy lại token mới |
| `[LỖI GOOGLE SHEETS] The caller does not have permission` | Chưa share Sheet | Share Sheet cho email `client_email` trong `credentials.json` |
| Không có log nào được ghi | Không chung server với target | Đảm bảo cả 2 cùng ở trong ít nhất 1 server |
| Tài khoản Discord bị khóa | Discord phát hiện selfbot | **Không có cách khôi phục** |

## Giấy phép

Dự án cá nhân, sử dụng với trách nhiệm của bạn.