// ============================================================
// build.js — Magic Arena 静态打包脚本（F7 · 无网络依赖）
// 用途：将 index.html / game.js / 文档拷贝到 dist/，作为可分发的静态站点
// 用法：node build.js
// 约束：零 npm install、零外网请求、纯 Node.js 内置 API
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const FILES = [
  'index.html',
  'game.js',
  'README.md',
  'DESIGN.md',
  'PRODUCT.md',
  'PROTOCOL.md',
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  const content = fs.readFileSync(src, 'utf8');
  fs.writeFileSync(dest, content, 'utf8');
  const stat = fs.statSync(dest);
  console.log(`  ✓ ${path.relative(ROOT, dest)}  (${stat.size} bytes)`);
}

function main() {
  console.log('=== Magic Arena 静态打包（F7）===');
  console.log(`源目录: ${ROOT}`);
  console.log(`目标目录: ${DIST}`);
  console.log('');

  // 清理旧构建
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
    console.log('已清理旧 dist/ 目录');
  }
  ensureDir(DIST);

  // 拷贝核心文件
  console.log('\n[1/2] 拷贝游戏文件:');
  for (const f of FILES) {
    const src = path.join(ROOT, f);
    const dest = path.join(DIST, f);
    if (fs.existsSync(src)) {
      copyFile(src, dest);
    } else {
      console.log(`  ✗ 跳过（不存在）: ${f}`);
    }
  }

  // 生成简单的入口说明
  console.log('\n[2/2] 生成 START.html 入口提示:');
  const startHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>Magic Arena — 启动</title>
<meta http-equiv="refresh" content="2;url=index.html">
<style>
body { font-family: sans-serif; background: #1a1a2e; color: #e0e0e0; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
.box { background: #16213e; padding: 32px; border-radius: 12px; text-align: center; }
a { color: #f0c27f; }
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
  console.log('  ✓ START.html  (入口提示)');

  // 输出统计
  const distFiles = fs.readdirSync(DIST);
  const totalSize = distFiles.reduce((sum, f) => {
    const s = fs.statSync(path.join(DIST, f));
    return sum + s.size;
  }, 0);
  console.log('\n=== 打包完成 ===');
  console.log(`文件数: ${distFiles.length}`);
  console.log(`总大小: ${(totalSize / 1024).toFixed(2)} KB`);
  console.log(`\n启动方式：双击 dist/index.html，或运行：`);
  console.log(`  cd dist && npx serve .`);
  console.log(`  python -m http.server 8080 --directory dist`);
}

main();
