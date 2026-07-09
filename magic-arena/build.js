// ============================================================
// build.js — Magic Arena 构建脚本
// 将 src/ 目录下模块拼接为 game.js，并拷贝到 dist/
// 零 npm 依赖，纯 Node.js 内置 API
// 用法：node build.js   （在 magic-arena/ 内运行）
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

// 构建产物输出路径
const GAME_JS = path.join(ROOT, 'game.js');

// 拼接顺序：依赖关系必须保证先定义的函数/常量被后引用
const CONCAT_ORDER = [
  // Entry — IIFE 开头
  '_entry.js',

  // Config
  'config/constants.js',
  'config/difficulty.js',

  // Data
  'data/skills.js',
  'data/units.js',
  'data/equipment.js',
  'data/campaign.js',
  'data/lore.js',
  'data/bonds.js',

  // Core — 运行时状态与战斗逻辑
  'core/state.js',
  'systems/utils.js',
  'core/unit-factory.js',
  'core/combat.js',
  'core/turn.js',
  'core/ai.js',

  // UI — 渲染与交互
  'ui/renderer.js',
  'ui/interaction.js',
  'ui/panels.js',
  'ui/ui-update.js',

  // Systems — 存档/预测/测试钩子
  'systems/save.js',
  'systems/prediction.js',
  'systems/hooks.js',

  // Main — init 与公共 API 导出
  'main.js',
];

function concatSrc() {
  const chunks = [];
  for (const rel of CONCAT_ORDER) {
    const filepath = path.join(SRC, rel);
    if (!fs.existsSync(filepath)) {
      console.error(`  ✗ 缺少文件: ${rel}`);
      process.exit(1);
    }
    const code = fs.readFileSync(filepath, 'utf8');
    // 注入文件路径注释（便于调试）
    chunks.push(`\n// ===== ${rel} =====\n${code}`);
  }
  return chunks.join('\n');
}

function buildGameJs() {
  console.log('=== Magic Arena 构建 ===');
  console.log(`源目录: ${SRC}`);

  // 1. 拼接所有模块为 game.js
  console.log('\n[1/3] 拼接 src/ 模块 → game.js:');
  const combined = concatSrc();
  const expectedSymbols = [
    'startMove', 'endTurn', 'skipUnit', 'castSkill', 'restart',
    'closeOverlay', 'cancelAction', 'startCampaign', 'startSkirmish',
    'showMenu', 'showWorldMap', 'showLore', 'renderLore',
    'setDifficulty', 'setPlayerFaction', 'renderCodex',
    'renderEquipment', 'setEquipment', 'renderBonds', 'deepenBond', '_state', '_perf',
    'evaluateSideScore', 'predictOutcome', 'updateBattlePrediction',
    'showChoice', 'chooseOption', 'getEndingId',
  ];
  expectedSymbols.forEach(sym => {
    if (!combined.includes(sym)) {
      console.error(`  ✗ 拼接结果缺少符号: ${sym}`);
      process.exit(1);
    }
  });
  fs.writeFileSync(GAME_JS, combined, 'utf8');
  const size = fs.statSync(GAME_JS).size;
  console.log(`  ✓ game.js  (${(size / 1024).toFixed(1)} KB, ~${combined.split('\n').length} 行)`);

  // 2. 准备 dist/
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
    console.log('  已清理旧 dist/');
  }
  fs.mkdirSync(DIST, { recursive: true });

  // 3. 拷贝到 dist/
  console.log('\n[2/3] 拷贝到 dist/:');
  const FILES = ['index.html', 'game.js', 'README.md', 'DESIGN.md'];
  for (const f of FILES) {
    const src = path.join(ROOT, f);
    const dest = path.join(DIST, f);
    if (fs.existsSync(src)) {
      const content = fs.readFileSync(src, 'utf8');
      fs.writeFileSync(dest, content, 'utf8');
      const sz = fs.statSync(dest).size;
      console.log(`  ✓ ${f}  (${sz} bytes)`);
    } else {
      console.log(`  - 跳过（不存在）: ${f}`);
    }
  }

  // 4. 生成 START.html
  console.log('\n[3/3] 生成 START.html:');
  const startHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>Magic Arena — 启动</title>
<meta http-equiv="refresh" content="2;url=index.html">
<style>
body{font-family:sans-serif;background:#1a1a2e;color:#e0e0e0;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}
.box{background:#16213e;padding:32px;border-radius:12px;text-align:center}
a{color:#f0c27f}
</style>
</head>
<body>
<div class="box">
<h1>Magic Arena — 魔法竞技场</h1>
<p>正在跳转至游戏...</p>
<p><a href="index.html">手动进入 →</a></p>
</div>
</body>
</html>`;
  fs.writeFileSync(path.join(DIST, 'START.html'), startHtml, 'utf8');
  console.log('  ✓ START.html');

  // 统计
  const distFiles = fs.readdirSync(DIST);
  const totalSize = distFiles.reduce((sum, f) => sum + fs.statSync(path.join(DIST, f)).size, 0);
  console.log('\n=== 构建完成 ===');
  console.log(`dist/: ${distFiles.length} 个文件, ${(totalSize / 1024).toFixed(2)} KB`);
  console.log(`root game.js: ${(size / 1024).toFixed(1)} KB`);
}

buildGameJs();
