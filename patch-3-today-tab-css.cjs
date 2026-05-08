/**
 * patch-3-today-tab-css.js
 * 수정 대상: src/shared/components/TodayTab.css
 * 내용:
 *   1) .approve-actions 래퍼 (승인+반려 버튼 가로 배치)
 *   2) .reject-btn 스타일
 *   3) .auto-checkout-btn 스타일
 *
 * 실행: node patch-3-today-tab-css.js
 */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "src", "shared", "components", "TodayTab.css");

const PATCHES = [
  [
    // old: 기존 .approve-btn 블록 끝
    `.approve-btn:hover { background: #1d4ed8; }`,
    // new: 기존 블록 유지 + 새 스타일 추가
    `.approve-btn:hover { background: #1d4ed8; }

/* ── 승인/반려 버튼 묶음 ──────────────────────────────────────────── */
.approve-actions {
  display: flex;
  gap: 4px;
}

/* ── 반려 버튼 ──────────────────────────────────────────────────── */
.reject-btn {
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  background: #ef4444;
  color: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  white-space: nowrap;
}
.reject-btn:hover { background: #dc2626; }

/* ── 자동퇴근 실행 버튼 ─────────────────────────────────────────── */
.auto-checkout-btn {
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  background: #8b5cf6;
  color: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  white-space: nowrap;
  margin-top: 4px;
}
.auto-checkout-btn:hover { background: #7c3aed; }`,
  ],
];

function applyPatches(filePath, patches) {
  let src = fs.readFileSync(filePath, "utf8");
  let changed = 0;

  for (let i = 0; i < patches.length; i++) {
    const [oldStr, newStr] = patches[i];
    if (!src.includes(oldStr)) {
      console.error(`[SKIP] 패치 ${i + 1}: 대상 문자열 없음`);
      console.error(`  시작: "${oldStr.slice(0, 60).replace(/\n/g, "\\n")}..."`);
      continue;
    }
    src = src.replace(oldStr, newStr);
    changed++;
    console.log(`[OK] 패치 ${i + 1} 적용`);
  }

  if (changed > 0) {
    fs.writeFileSync(filePath, src, "utf8");
    console.log(`\n저장 완료: ${filePath}`);
  } else {
    console.log("\n변경 사항 없음.");
  }
}

console.log("=== patch-3: TodayTab.css 버튼 스타일 추가 ===\n");
applyPatches(FILE, PATCHES);
