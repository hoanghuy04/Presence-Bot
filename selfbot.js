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

async function logStatusToSheets(username, eventType, statusAction, platform = '', guildName = '', gameName = '', gameDetails = '', gameState = '') {
    const time = new Date().toLocaleString('vi-VN', { timeZone: TIMEZONE });
    console.log(`[SHEETS] Bắt đầu gọi API append cho: ${username} | ${eventType} | ${statusAction}`);

    try {
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:H`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[
                    time,
                    eventType || '',
                    statusAction || '',
                    platform || '',
                    guildName || '',
                    gameName || '',
                    gameDetails || '',
                    gameState || ''
                ]],
            },
        });
        console.log(`[GHI LOG THÀNH CÔNG] [${time}] ${username} -> ${statusAction} (HTTP ${response.status})`);
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

    const newStatus = newPresence.status;
    const oldStatus = oldPresence ? oldPresence.status : 'offline';

    // Kiểm tra xem user có phải mục tiêu cần theo dõi không
    const targetLower = TARGET_USERNAME.toLowerCase();
    const isTarget =
        (username && username.toLowerCase() === targetLower) ||
        (userId === TARGET_USERNAME);

    if (isTarget) {
        const getPlatform = (presence, activity) => {
            if (activity && activity.platform) return activity.platform;
            if (presence && presence.clientStatus) {
                return Object.keys(presence.clientStatus).join(', ');
            }
            return '';
        };

        const guildName = newPresence.guild ? newPresence.guild.name : '';

        // 1. Kiểm tra thay đổi trạng thái Online / Offline
        if (oldStatus !== newStatus) {
            const displayName = username ? `${username}` : `User_${userId}`;
            console.log(`[DEBUG] Phát hiện trạng thái thay đổi: ${displayName} (${oldStatus} -> ${newStatus})`);
            console.log(`🎯 [MỤC TIÊU] Ghi trạng thái: ${username || userId} -> ${newStatus}`);

            const platform = getPlatform(newPresence, null);
            await logStatusToSheets(
                username || userId,
                'Trạng thái',
                newStatus,
                platform,
                guildName,
                '',
                '',
                ''
            );
        }

        // 2. Kiểm tra thay đổi hoạt động chơi game (Vào game / Thoát game / Cập nhật game)
        const oldGameActivity = oldPresence ? oldPresence.activities.find(act => act.type === 'PLAYING') : null;
        const newGameActivity = newPresence ? newPresence.activities.find(act => act.type === 'PLAYING') : null;
        console.log("newPresence", newPresence);

        const oldGame = oldGameActivity ? oldGameActivity.name : null;
        const newGame = newGameActivity ? newGameActivity.name : null;

        const oldDetails = oldGameActivity ? oldGameActivity.details : null;
        const newDetails = newGameActivity ? newGameActivity.details : null;

        const oldState = oldGameActivity ? oldGameActivity.state : null;
        const newState = newGameActivity ? newGameActivity.state : null;

        if (oldGame !== newGame || oldDetails !== newDetails || oldState !== newState) {
            if (!oldGame && newGame) {
                // Vào game
                console.log(`🎮 [GAME] ${username || userId} đã vào game: ${newGame} | Chi tiết: ${newDetails || 'không'} | Trạng thái: ${newState || 'không'}`);
                await logStatusToSheets(
                    username || userId,
                    'Chơi game',
                    'Vào game',
                    getPlatform(newPresence, newGameActivity),
                    guildName,
                    newGame,
                    newDetails || '',
                    newState || ''
                );
            } else if (oldGame && !newGame) {
                // Thoát game
                console.log(`🎮 [GAME] ${username || userId} đã thoát game: ${oldGame}`);
                await logStatusToSheets(
                    username || userId,
                    'Chơi game',
                    'Thoát game',
                    getPlatform(oldPresence, oldGameActivity),
                    guildName,
                    oldGame,
                    oldDetails || '',
                    oldState || ''
                );
            } else if (oldGame && newGame && oldGame !== newGame) {
                // Đổi game trực tiếp (ví dụ: chuyển từ game này sang game khác)
                console.log(`🎮 [GAME] ${username || userId} đổi game: ${oldGame} -> ${newGame}`);
                await logStatusToSheets(
                    username || userId,
                    'Chơi game',
                    'Thoát game',
                    getPlatform(oldPresence, oldGameActivity),
                    guildName,
                    oldGame,
                    oldDetails || '',
                    oldState || ''
                );
                await logStatusToSheets(
                    username || userId,
                    'Chơi game',
                    'Vào game',
                    getPlatform(newPresence, newGameActivity),
                    guildName,
                    newGame,
                    newDetails || '',
                    newState || ''
                );
            } else if (oldGame && newGame && oldGame === newGame && (oldDetails !== newDetails || oldState !== newState)) {
                // Cập nhật thông tin trong game (ví dụ: số người trong trận, chế độ đấu, bản đồ)
                console.log(`🎮 [GAME UPDATE] ${username || userId} cập nhật game: ${newGame} | Details: ${newDetails || 'không'} | State: ${newState || 'không'}`);
                await logStatusToSheets(
                    username || userId,
                    'Chơi game',
                    'Cập nhật game',
                    getPlatform(newPresence, newGameActivity),
                    guildName,
                    newGame,
                    newDetails || '',
                    newState || ''
                );
            }
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