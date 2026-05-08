/**
 * patch-2-today-tab.js
 * 수정 대상: src/shared/components/TodayTab.jsx
 * 내용:
 *   1) AttCard — 반려 버튼 추가 (승인 버튼 옆)
 *   2) AutoCard — 자동퇴근 실행 버튼 추가
 *   3) TodayTab props — onAutoCheckout 추가
 *   4) AutoCard 에 onAutoCheckout prop 전달
 *
 * 실행: node patch-2-today-tab.js
 */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "src", "shared", "components", "TodayTab.jsx");

const PATCHES = [
  // ── 1. AttCard: 승인 버튼 옆에 반려 버튼 추가 ────────────────────────────
  [
    // old: 승인 버튼만 있는 블록
    `        {/* 승인 버튼 — approved !== true 인 경우만 */}
        {!approved && onApprove && (
          <button
            type="button"
            className="approve-btn"
            onClick={() => onApprove(a, true)}
          >
            승인
          </button>
        )}`,
    // new: 승인 + 반려 버튼
    `        {/* 승인 / 반려 버튼 — approved !== true 인 경우만 */}
        {!approved && onApprove && (
          <div className="approve-actions">
            <button
              type="button"
              className="approve-btn"
              onClick={() => onApprove(a, true)}
            >
              승인
            </button>
            <button
              type="button"
              className="reject-btn"
              onClick={() => onApprove(a, false)}
            >
              반려
            </button>
          </div>
        )}`,
  ],

  // ── 2. AutoCard: onAutoCheckout prop 추가 + 자동퇴근 버튼 ─────────────────
  [
    // old: AutoCard 함수 시그니처 + 승인 버튼 블록
    `function AutoCard({ a, onApprove }) {`,
    `function AutoCard({ a, onApprove, onAutoCheckout }) {`,
  ],
  [
    // old: AutoCard 내부의 기존 approve 버튼 블록 끝
    `        {!approved && onApprove && (
          <button
            type="button"
            className="approve-btn"
            onClick={() => onApprove(a, true)}
          >
            승인
          </button>
        )}`,
    // new: 승인 + 반려 + 자동퇴근 버튼
    `        {!approved && onApprove && (
          <div className="approve-actions">
            <button
              type="button"
              className="approve-btn"
              onClick={() => onApprove(a, true)}
            >
              승인
            </button>
            <button
              type="button"
              className="reject-btn"
              onClick={() => onApprove(a, false)}
            >
              반려
            </button>
          </div>
        )}
        {onAutoCheckout && (
          <button
            type="button"
            className="auto-checkout-btn"
            onClick={() => onAutoCheckout(a)}
          >
            자동퇴근
          </button>
        )}`,
  ],

  // ── 3. TodayTab: props 에 onAutoCheckout 추가 ─────────────────────────────
  [
    `export function TodayTab({ todayAttendance = [], schedule = [], employees = [], onApprove }) {`,
    `export function TodayTab({ todayAttendance = [], schedule = [], employees = [], onApprove, onAutoCheckout }) {`,
  ],

  // ── 4. 자동퇴근 예정 섹션: AutoCard 에 onAutoCheckout 전달 ────────────────
  [
    `            {autoCheckout.map((a) => (
              <AutoCard
                key={a.attendance_id || \`\${a.employee_id}-auto\`}
                a={a}
                onApprove={onApprove}
              />
            ))}`,
    `            {autoCheckout.map((a) => (
              <AutoCard
                key={a.attendance_id || \`\${a.employee_id}-auto\`}
                a={a}
                onApprove={onApprove}
                onAutoCheckout={onAutoCheckout}
              />
            ))}`,
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
    console.log(`총 ${changed}개 패치 적용`);
  } else {
    console.log("\n변경 사항 없음.");
  }
}

console.log("=== patch-2: TodayTab.jsx 반려버튼 + 자동퇴근 버튼 추가 ===\n");
applyPatches(FILE, PATCHES);
