require('dotenv').config();

const { Client } = require('discord.js-selfbot-v13');
const googleSheets = require('@googleapis/sheets');
const path = require('path');

const {
    DISCORD_TOKEN,
    TARGET_USERNAME,
    SPREADSHEET_ID,
    SHEET_NAME,
    TIMEZONE = 'Asia/Ho_Chi_Minh',
} = process.env;

function fail(message) {
    console.error(`\n[CONFIG ERROR] ${message}\n`);
    console.error('Vui lòng mở file .env và điền đầy đủ các giá trị sau:');
    console.error('  - DISCORD_TOKEN');
    console.error('  - TARGET_USERNAME');
    console.error('  - SPREADSHEET_ID');
    console.error('  - SHEET_NAME\n');
    process.exit(1);
}

if (!DISCORD_TOKEN || DISCORD_TOKEN === 'YOUR_DISCORD_TOKEN_HERE') {
    fail('Chưa cấu hình DISCORD_TOKEN trong file .env');
}
if (!TARGET_USERNAME) fail('Chưa cấu hình TARGET_USERNAME trong file .env');
if (!SPREADSHEET_ID) fail('Chưa cấu hình SPREADSHEET_ID trong file .env');
if (!SHEET_NAME) fail('Chưa cấu hình SHEET_NAME trong file .env');

const client = new Client({ checkUpdate: false });

const authClient = new googleSheets.auth.JWT({
    keyFile: path.join(__dirname, 'credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = googleSheets.sheets({ version: 'v4', auth: authClient });

async function logStatusToSheets(username, status) {
    const time = new Date().toLocaleString('vi-VN', { timeZone: TIMEZONE });
    console.log(`[SHEETS] Bắt đầu gọi API append cho: ${username} -> ${status}`);

    try {
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:C`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[time, username, status]],
            },
        });
        console.log(`[GHI LOG THÀNH CÔNG] [${time}] ${username} -> ${status} (HTTP ${response.status})`);
    } catch (error) {
        console.error('[LỖI GOOGLE SHEETS]', error.message);
        if (error.code === 403) {
            console.error('→ Gợi ý: Bạn đã share Google Sheet cho email của Service Account chưa?');
        } else if (error.code === 404) {
            console.error('→ Gợi ý: Kiểm tra lại SPREADSHEET_ID và SHEET_NAME trong file .env');
        }
    }
}

client.on('ready', () => {
    console.log('\n======================================================');
    console.log(`Selfbot đang hoạt động trên tài khoản: ${client.user.tag}`);
    console.log(`Đang theo dõi trạng thái của user: ${TARGET_USERNAME}`);
    console.log('======================================================\n');

    const isSelfTarget = (client.user.username.toLowerCase() === TARGET_USERNAME.toLowerCase()) || (client.user.id === TARGET_USERNAME);
    if (isSelfTarget) {
        console.log('⚠️ [CẢNH BÁO] Tài khoản cần theo dõi đang trùng với tài khoản chạy bot!');
        console.log('  -> Discord không gửi sự kiện presenceUpdate cho chính tài khoản đang đăng nhập.');
        console.log('  -> Để tự theo dõi chính mình, bạn cần chạy bot bằng tài khoản khác (tài khoản phụ),');
        console.log('     sau đó kết bạn hoặc ở chung server với tài khoản chính của bạn.\n');
    }

    console.log('Lưu ý: Bạn phải CHIA SẺ CHUNG SERVER với người dùng mục tiêu');
    console.log('       thì mới nhận được sự kiện presenceUpdate.\n');
});

client.on('presenceUpdate', async (oldPresence, newPresence) => {
    if (!newPresence) return;

    const userId = newPresence.userId;
    let user = newPresence.user;


    // Nếu user chưa được cache hoặc thiếu username, thử fetch từ Discord API
    if (!user || !user.username) {
        try {
            user = await client.users.fetch(userId);
        } catch (err) {
            // Bỏ qua lỗi nếu không fetch được
        }
    }

    const username = user ? user.username : null;

    console.log("user: ", user);
    const newStatus = newPresence.status;
    const oldStatus = oldPresence ? oldPresence.status : 'offline';

    if (oldStatus !== newStatus) {
        const targetLower = TARGET_USERNAME.toLowerCase();
        const isTarget =
            (username && username.toLowerCase() === targetLower) ||
            (userId === TARGET_USERNAME);

        const displayName = username ? `${username}` : `User_${userId}`;
        console.log(`[DEBUG] Phát hiện trạng thái thay đổi: ${displayName} [ID: ${userId}] (${oldStatus} -> ${newStatus}) | Phù hợp mục tiêu: ${isTarget ? 'ĐÚNG' : 'KHÔNG'}`);

        if (isTarget) {
            console.log(`🎯 [MỤC TIÊU] Bắt đầu ghi sheet cho: ${username || userId} -> ${newStatus}`);
            await logStatusToSheets(username || userId, newStatus);
            console.log(`[INFO] Hoàn thành ghi log cho: ${username || userId}`);
        }
    }
});

client.on('error', (err) => {
    // Ẩn các lỗi spam do thư viện cũ không tương thích hoàn toàn với API mới của Discord
    if (err.message && err.message.includes("reading 'members'")) {
        return;
    }
    console.error('[LỖI DISCORD]', err.message);
});

process.on('unhandledRejection', (reason) => {
    if (reason && reason.message && reason.message.includes("reading 'members'")) {
        return;
    }
    console.error('[UNHANDLED PROMISE]', reason);
});

// --- ĐOẠN CODE BỔ SUNG ĐỂ CHẠY FREE TRÊN RENDER WEB SERVICE ---
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Tạo 1 đường dẫn để Render hoặc UptimeRobot ping vào kiểm tra
app.get('/', (req, res) => {
    res.send('Selfbot Discord đang chạy ngầm ổn định!');
});

app.listen(PORT, () => {
    console.log(`Server HTTP ảo đang lắng nghe tại cổng: ${PORT}`);
});
// -----------------------------------------------------------

client.login(DISCORD_TOKEN).catch((err) => {
    console.error('\n[ĐĂNG NHẬP THẤT BẠI]', err.message);
    console.error('→ Kiểm tra lại DISCORD_TOKEN trong file .env');
    console.error('→ Token có thể đã hết hạn hoặc bị thu hồi.\n');
    process.exit(1);
});