// ============================================================
// Systems: Utils — 坐标工具、辅助函数
// ============================================================

function cellToPixel(gx, gy) { return { x: gx * CELL, y: gy * CELL }; }
function pixelToCell(px, py) { return { gx: Math.floor(px / CELL), gy: Math.floor(py / CELL) }; }
function cellDist(a, b) { return Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy); }
function cellDistPt(gx1, gy1, gx2, gy2) { return Math.abs(gx1 - gx2) + Math.abs(gy1 - gy2); }
function getUnitAt(gx, gy) { return units.find(u => u.gx === gx && u.gy === gy && u.hp > 0); }
function coverAt(gx, gy) { return !!(currentMap && currentMap.cover && currentMap.cover.some(c => c.gx === gx && c.gy === gy)); }
function hazardAt(gx, gy) { return !!(currentMap && currentMap.hazard && currentMap.hazard.some(c => c.gx === gx && c.gy === gy)); }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pushFloater(gx, gy, text, kind) {
  floaters.push({ gx, gy, text, kind: kind || 'damage', life: 30 });
}
