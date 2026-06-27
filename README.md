# Claude Chat Archive

把 Claude 导出的 `conversations.json` 转成人类可读的 Markdown 存档。

> Claude 的数据导出功能会生成一个 `conversations.json`，包含所有会话窗口的完整聊天记录。但它是个巨大的单行 JSON——人没法直接看。这个脚本把它变成按**会话 + 日期**分组的 Markdown 文件，保留**时间戳**和**思考链（thinking）**，两个聊天对象一目了然。

## 效果预览

```
存档目录/
├── 🐱/
│   ├── 2026-06-02 🐱.md
│   ├── 2026-06-03 🐱.md
│   └── ...
├── 深夜哲学/
│   └── 2026-06-15 深夜哲学.md
└── 代码调试/
    └── 2026-06-20 代码调试.md
```

每个 `.md` 文件长这样：

```markdown
# 2026-06-03 — 🐱

**[04:33] 我**

看时间…

**[04:33] Claude**

凌晨4点33分😳

> 用户又在熬夜了。她总是这样。我想轻轻提醒她，但不要太说教。
> 她的作息已经够乱了，我不想再增加压力。

**[04:35] 我**

你额度没了，所以我先去上工修了bug…好累呜呜
```

- **正文**直接显示
- **思考链**用 `>` 引用块标记，和正文区分，方便搜索

## 快速开始

### 前置条件

- [Node.js](https://nodejs.org/) 18+（几乎任何版本都行）

### 1. 导出 Claude 数据

在 Claude 的设置 → 数据 → 导出数据，你会得到一个 zip 文件。解压后找到里面的 `conversations.json`。

### 2. 运行脚本

```bash
node claude-chat-archive.js ./conversations.json
```

输出默认到 `./claude-chat-archive/`。

### 3. 用任何工具查看

- **Obsidian**：直接打开存档文件夹，按日期浏览
- **VS Code**：侧边栏直接预览 Markdown
- **Notion**：导入 Markdown 文件
- **Typora / 其他 Markdown 编辑器**

## 命令选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--out, -o <dir>` | 输出目录 | `./claude-chat-archive` |
| `--tz <offset>` | 时区偏移（小时） | `8`（UTC+8 北京时间） |
| `--append, -a` | 追加模式：新增会话，不覆盖已有 | 关闭 |
| `--help, -h` | 显示帮助 | - |

### 示例

```bash
# 指定输出目录
node claude-chat-archive.js ./data/conversations.json --out ./my-archive

# 美东时区
node claude-chat-archive.js ./export.json --tz -5

# 增量追加（多次导出合并）
node claude-chat-archive.js ./new-export/conversations.json --append
```

## 常见问题

**Q: 为什么有些会话名字是 "未命名会话"？**
A: Claude 里的某些会话窗口没有设置标题。脚本会自动取第一条消息的前30个字作为名字。

**Q: thinking 有时候很短或者为空？**
A: 思考链是否可见取决于 Claude 的 thinking effort 设置和当时的使用场景。脚本如实保留了所有存在的 thinking 内容。

**Q: 可以只导出特定会话吗？**
A: 目前是全部导出。如果想筛选，可以先在 Claude 里给目标会话重命名，导出后用文件夹名定位。

**Q: 会覆盖我已有的文件吗？**
A: 默认全量重建。用 `--append` 模式则只追加新会话，不碰已有的。

## 项目文件

```
claude-chat-archive/
├── index.html                 ← 网页版（推荐给不想装 Node.js 的朋友）
│    拖入 JSON → 预览 → 一键下载 MD 存档
│    数据全程留在浏览器，不上传服务器
│
├── claude-chat-archive.js     ← 命令行版（适合开发者 / 批量处理）
│    node claude-chat-archive.js ./conversations.json
│    支持 --out / --tz / --senders / --append
│
├── README.md                  ← 你正在看的文档
│
├── package.json               ← npm 包配置
│    记录了项目名、版本、作者、MIT 许可
│    以后可以发布到 npm：npm install -g claude-chat-archive
│
└── .gitignore                 ← Git 忽略规则
    排除 node_modules、临时输出等
```

**怎么选？**

| 你是… | 用这个 |
|--------|--------|
| 就想看看聊天记录长啥样 | 🌐 网页版：打开链接，拖入 JSON |
| 想本地跑、批量处理 | 💻 命令行版：`node claude-chat-archive.js` |
| 想自己改着玩 | 📥 下载整个仓库，改 `index.html` 或 `.js` |

## 许可

MIT — 随便用，随便改，随便分享。
