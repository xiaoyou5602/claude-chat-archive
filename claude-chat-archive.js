#!/usr/bin/env node

/**
 * Claude Chat Archive — 把 Claude 导出的 conversations.json 转成人类可读的 Markdown 存档
 *
 * 用法:
 *   node claude-chat-archive.js <conversations.json> [--out <dir>] [--tz <offset>] [--append]
 *
 * 示例:
 *   node claude-chat-archive.js ./全部-25/conversations.json
 *   node claude-chat-archive.js ./data/conversations.json --out ./my-archive --tz -5
 *   node claude-chat-archive.js ./new-export/conversations.json --append
 *
 * 输出结构:
 *   存档目录/
 *     ├── 会话名1/
 *     │   ├── 2026-06-02 会话名1.md
 *     │   └── 2026-06-03 会话名1.md
 *     └── 会话名2/
 *         └── 2026-06-15 会话名2.md
 */

const fs = require('fs');
const path = require('path');

// ====== 命令行参数解析 ======

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    src: null,
    out: './claude-chat-archive',
    tz: 8,           // 默认 UTC+8（北京时间）
    senders: null,    // null = 自动检测；"--senders toge,克" 手动指定
    append: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--out':
      case '-o':
        opts.out = args[++i];
        break;
      case '--tz':
        opts.tz = parseFloat(args[++i]);
        break;
      case '--senders':
        opts.senders = args[++i];
        break;
      case '--append':
      case '-a':
        opts.append = true;
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      default:
        if (!opts.src && !args[i].startsWith('-')) {
          opts.src = args[i];
        }
    }
  }

  return opts;
}

// ====== 核心逻辑 ======

function toLocalTime(iso, tzOffset) {
  const d = new Date(new Date(iso).getTime() + tzOffset * 60 * 60 * 1000);
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}

function extractDate(iso, tzOffset) {
  const d = new Date(new Date(iso).getTime() + tzOffset * 60 * 60 * 1000);
  return d.getUTCFullYear() + '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0');
}

function getConvName(conv) {
  // 优先用会话名
  if (conv.name && conv.name.trim()) return conv.name.trim();

  // 回退：取第一条人类消息的前几个字
  for (const msg of conv.chat_messages || []) {
    if (msg.sender === 'human') {
      for (const c of msg.content || []) {
        if (c.type === 'text' && c.text && c.text.trim()) {
          const t = c.text.trim();
          return t.length > 30 ? t.slice(0, 30) + '…' : t;
        }
      }
    }
  }

  return '未命名会话';
}

function processContent(contentArray) {
  let text = '', thinking = '';

  for (const block of contentArray) {
    if (block.type === 'text' && block.text && block.text.trim()) {
      text += (text ? '\n\n' : '') + block.text.trim();
    }
    if (block.type === 'thinking' && block.thinking && block.thinking.trim()) {
      thinking += (thinking ? '\n\n' : '') + block.thinking.trim();
    }
  }

  return { text, thinking };
}

function detectUserName(srcPath) {
  // 1. 读同目录下的 users.json
  const dir = path.dirname(srcPath);
  const usersPath = path.join(dir, 'users.json');
  if (fs.existsSync(usersPath)) {
    try {
      const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
      if (Array.isArray(users) && users.length > 0 && users[0].full_name) {
        return users[0].full_name;
      }
    } catch (_) {}
  }

  // 2. 回退：取第一条人类消息的前几个字
  try {
    const conversations = JSON.parse(fs.readFileSync(srcPath, 'utf-8'));
    for (const conv of conversations) {
      for (const msg of conv.chat_messages || []) {
        if (msg.sender === 'human') {
          for (const c of msg.content || []) {
            if (c.type === 'text' && c.text && c.text.trim()) {
              const t = c.text.trim();
              // 只取看起来像名字的：短于 20 字，不含问号/你好等泛用开头
              if (t.length <= 20 && !/^[你嗨哈早晚]/ .test(t) && !/[?？]/.test(t)) {
                return t;
              }
            }
          }
        }
      }
    }
  } catch (_) {}

  return '我';
}

function buildArchive(conversations, opts) {
  const archive = {}; // { convName: { date: [msgs] } }
  let totalMsgs = 0;

  // --senders 覆盖自动检测
  let humanName, aiName;
  if (opts.senders) {
    [humanName, aiName] = opts.senders.split(',').map(s => s.trim());
  } else {
    humanName = detectUserName(opts.src);
    aiName = 'Claude';
  }

  for (const conv of conversations) {
    if (!conv.chat_messages?.length) continue;

    const name = getConvName(conv);
    if (!archive[name]) archive[name] = {};

    for (const m of conv.chat_messages) {
      if (!m.content?.length || !m.created_at) continue;

      const date = extractDate(m.created_at, opts.tz);
      const { text, thinking } = processContent(m.content);
      if (!text && !thinking) continue;

      if (!archive[name][date]) archive[name][date] = [];
      archive[name][date].push({
        sender: m.sender === 'human' ? humanName : aiName,
        time: toLocalTime(m.created_at, opts.tz),
        text,
        thinking,
      });
      totalMsgs++;
    }
  }

  return { archive, totalMsgs };
}

function writeArchive(archive, outDir, opts) {
  const tmpDir = outDir + '_tmp';

  // 追加模式：复制已有目录
  if (opts.append && fs.existsSync(outDir)) {
    fs.cpSync(outDir, tmpDir, { recursive: true });
  } else {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  let fileCount = 0;

  for (const [name, dates] of Object.entries(archive)) {
    const folder = name.replace(/[<>:"/\\|?*]/g, '_');
    const folderPath = path.join(tmpDir, folder);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    for (const [date, msgs] of Object.entries(dates)) {
      msgs.sort((a, b) => a.time.localeCompare(b.time));

      let md = `# ${date} — ${name}\n\n`;
      for (const m of msgs) {
        md += `**[${m.time}] ${m.sender}**\n\n`;
        if (m.text) md += m.text + '\n\n';
        if (m.thinking) {
          md += '> ' + m.thinking.replace(/\n/g, '\n> ') + '\n\n';
        }
      }

      const fname = `${date} ${folder}.md`;
      const fpath = path.join(folderPath, fname);

      // 追加模式且文件已存在：合并内容
      if (opts.append && fs.existsSync(fpath)) {
        const existing = fs.readFileSync(fpath, 'utf-8');
        // 简单拼接，依赖于时间排序
        fs.writeFileSync(fpath, existing + '\n' + md, 'utf-8');
      } else {
        fs.writeFileSync(fpath, md, 'utf-8');
      }

      fileCount++;
    }
  }

  // 原子替换
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true });
  fs.renameSync(tmpDir, outDir);

  return fileCount;
}

function printSummary(archive, totalMsgs, fileCount, outDir) {
  const sorted = Object.entries(archive).sort((a, b) => {
    const a0 = Object.keys(a[1]).sort()[0] || '';
    const b0 = Object.keys(b[1]).sort()[0] || '';
    return a0.localeCompare(b0);
  });

  console.log(`\n✅ ${sorted.length} 个会话, ${fileCount} 个日文件, ${totalMsgs} 条消息`);
  console.log(`📁 输出目录: ${path.resolve(outDir)}\n`);

  for (const [name, dates] of sorted) {
    const dlist = Object.keys(dates).sort();
    const n = Object.values(dates).reduce((s, m) => s + m.length, 0);
    const range = dlist.length > 1 ? `${dlist[0]} ~ ${dlist[dlist.length - 1]}` : dlist[0];
    console.log(`  ${name}/  — ${dlist.length}天 ${n}条  — ${range}`);
  }
}

// ====== 入口 ======

function main() {
  const opts = parseArgs();

  if (opts.help || !opts.src) {
    console.log(`
Claude Chat Archive — 把 Claude 导出的 conversations.json 转成人类可读的 Markdown 存档

用法:
  node claude-chat-archive.js <conversations.json> [选项]

选项:
  --out, -o  <dir>    输出目录（默认: ./claude-chat-archive）
  --tz       <offset> 时区偏移小时数（默认: 8，即 UTC+8 北京时间）
  --senders  <名,名>  发送者显示名，逗号分隔（默认: 自动从 users.json 检测，回退为"我,Claude"）
  --append, -a        追加模式：新会话加入已有存档，不覆盖
  --help, -h          显示帮助

示例:
  node claude-chat-archive.js ./data/conversations.json
  node claude-chat-archive.js ./export.json --out ./my-archive
  node claude-chat-archive.js ./new.json --append --tz -5
  node claude-chat-archive.js ./data.json --senders "小明,小助手"
`);
    process.exit(opts.help ? 0 : 1);
  }

  if (!fs.existsSync(opts.src)) {
    console.error(`❌ 找不到文件: ${opts.src}`);
    process.exit(1);
  }

  console.log(`📖 读取: ${opts.src}`);

  let conversations;
  try {
    conversations = JSON.parse(fs.readFileSync(opts.src, 'utf-8'));
  } catch (e) {
    console.error(`❌ JSON 解析失败: ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(conversations)) {
    console.error('❌ 格式错误: conversations.json 应该是一个数组');
    process.exit(1);
  }

  console.log(`📊 ${conversations.length} 个会话窗口`);

  const { archive, totalMsgs } = buildArchive(conversations, opts);
  const fileCount = writeArchive(archive, opts.out, opts);

  printSummary(archive, totalMsgs, fileCount, opts.out);
}

main();
