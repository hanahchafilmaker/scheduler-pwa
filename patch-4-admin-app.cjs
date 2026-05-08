/**
 * patch-4-admin-app.js
 * 수정 대상: src/admin/App.jsx
 * 내용:
 *   1) handleAutoCheckout 핸들러 추가
 *      — updateAttendance({ ...att, check_out: 현재시각 }) 호출
 *      — 완료 후 fetchToday() 로 재조회
 *   2) TodayTab 에 onAutoCheckout prop 전달
 *
 * 실행: node patch-4-admin-app.js
 */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "src", "admin", "App.jsx");

const PATCHES = [
  // ── 1. handleApprove 아래에 handleAutoCheckout 추가 ──────────────────────
  [
    // old: handleApprove 블록 끝
    `  const handleApprove = useCallback(
    (att, approved) => {
      approveAttendance(att, approved, () => fetchAll(selectedMonth));
    },
    [selectedMonth, fetchAll, approveAttendance],
  );`,
    // new: handleApprove 유지 + handleAutoCheckout 추가
    `  const handleApprove = useCallback(
    (att, approved) => {
      approveAttendance(att, approved, () => fetchAll(selectedMonth));
    },
    [selectedMonth, fetchAll, approveAttendance],
  );

  // 자동퇴근 실행: 현재 시각으로 check_out 기록 후 오늘 탭 재조회
  const handleAutoCheckout = useCallback(
    (att) => {
      const n = new Date();
      const hh = String(n.getHours()).padStart(2, "0");
      const mm = String(n.getMinutes()).padStart(2, "0");
      const checkOut = \`\${hh}:\${mm}\`;
      api.updateAttendance(
        { ...att, check_out: checkOut },
        () => api.fetchToday(),
      );
    },
    [api],
  );`,
  ],

  // ── 2. TodayTab 에 onAutoCheckout prop 추가 ───────────────────────────────
  [
    `        <TodayTab
          todayAttendance={todayAttendance}
          schedule={schedule}
          employees={employees}
          onApprove={handleApprove}
        />`,
    `        <TodayTab
          todayAttendance={todayAttendance}
          schedule={schedule}
          employees={employees}
          onApprove={handleApprove}
          onAutoCheckout={handleAutoCheckout}
        />`,
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

console.log("=== patch-4: admin/App.jsx handleAutoCheckout 추가 ===\n");
applyPatches(FILE, PATCHES);
