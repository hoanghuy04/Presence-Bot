/* =====================================================================
 * DISCORD PRESENCE TRACKER — SELF-BOT
 * =====================================================================
 * CẢNH BÁO: File này sử dụng thư viện discord.js-selfbot-v13 để điều
 * khiển một tài khoản NGƯỜI DÙNG THẬT (user token), không phải bot.
 *
 * Theo Điều khoản Dịch vụ của Discord, việc sử dụng self-bot có thể
 * dẫn đến KHÓA VĨNH VIỄN tài khoản. Hãy cân nhắc rủi ro trước khi
 * triển khai. Discord có hệ thống tự động phát hiện hành vi bất
 * thường và sẽ không khôi phục tài khoản bị cấm.
 * ===================================================================== */

require('dotenv').config();

const { Client } = require('discord.js-selfbot-v13');
const { auth, sheets_v4 } = require('@googleapis/sheets');
const path = require('path');

// --- ĐỌC CẤU HÌNH TỪ .ENV ---
const {
    DISCORD_TOKEN,
    TARGET_USERNAME,
    SPREADSHEET_ID,
    SHEET_NAME,
    TIMEZONE = 'Asia/Ho_Chi_Minh',
} = process.env;

// --- KIỂM TRA CẤU HÌNH BẮT BUỘC ---
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

// --- KHỞI TẠO KẾT NỐI TỚI GOOGLE SHEETS API ---
const authClient = new auth.JWT({
    keyFile: path.join(__dirname, 'credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = new sheets_v4.Sheets({ auth: authClient });

// --- HÀM GHI LOG TRẠNG THÁI LÊN GOOGLE SHEET ---
async function logStatusToSheets(username, status) {
    const time = new Date().toLocaleString('vi-VN', { timeZone: TIMEZONE });

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:C`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[time, username, status]],
            },
        });
        console.log(`[GHI LOG THÀNH CÔNG] [${time}] ${username} -> ${status}`);
    } catch (error) {
        console.error('[LỖI GOOGLE SHEETS]', error.message);
        if (error.code === 403) {
            console.error('→ Gợi ý: Bạn đã share Google Sheet cho email của Service Account chưa?');
        } else if (error.code === 404) {
            console.error('→ Gợi ý: Kiểm tra lại SPREADSHEET_ID và SHEET_NAME trong file .env');
        }
    }
}

// --- SỰ KIỆN: BOT SẴN SÀNG ---
client.on('ready', () => {
    console.log('\n======================================================');
    console.log(`Selfbot đang hoạt động trên tài khoản: ${client.user.tag}`);
    console.log(`Đang theo dõi trạng thái của user: ${TARGET_USERNAME}`);
    console.log('======================================================\n');
    console.log('Lưu ý: Bạn phải CHIA SẺ CHUNG SERVER với người dùng mục tiêu');
    console.log('       thì mới nhận được sự kiện presenceUpdate.\n');
});

// --- SỰ KIỆN: TRẠNG THÁI HIỆN DIỆN THAY ĐỔI ---
client.on('presenceUpdate', (oldPresence, newPresence) => {
    if (!newPresence || !newPresence.user) return;

    if (newPresence.user.username === TARGET_USERNAME) {
        const oldStatus = oldPresence ? oldPresence.status : 'offline';
        const newStatus = newPresence.status;

        if (oldStatus !== newStatus) {
            logStatusToSheets(newPresence.user.username, newStatus);
        }
    }
});

// --- XỬ LÝ LỖI ĐĂNG NHẬP ---
client.on('error', (err) => {
    console.error('[LỖI DISCORD]', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('[UNHANDLED PROMISE]', reason);
});

// --- BẮT ĐẦU ĐĂNG NHẬP ---
client.login(DISCORD_TOKEN).catch((err) => {
    console.error('\n[ĐĂNG NHẬP THẤT BẠI]', err.message);
    console.error('→ Kiểm tra lại DISCORD_TOKEN trong file .env');
    console.error('→ Token có thể đã hết hạn hoặc bị thu hồi.\n');
    process.exit(1);
});