/**
 * patch-1-staff-app.js
 * 수정 대상: src/staff/App.jsx
 * 내용: isRejected 조건 수정 (null/undefined 와 명시적 false 구분)
 *       isPending 에서 isRejected 제외
 *
 * 실행: node patch-1-staff-app.js
 * 주의: 전체 파일 재저장 없음 — str_replace 방식만 사용
 */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "src", "staff", "App.jsx");

// ── 패치 목록: [oldStr, newStr] ───────────────────────────────────────────────
const PATCHES = [
  // ① isRejected 와 isPending 을 동시에 교체
  //   기존 코드에서 두 상수가 연속으로 붙어 있는 블록 전체를 교체
  [
    // old
    `  const approved = toBool(todayAttendance?.approved);

  const isPending = !!todayAttendance?.check_in && !todayAttendance?.check_out && !approved;

  const isWorking = !!todayAttendance?.check_in && !todayAttendance?.check_out && approved;

  const isDone = !!todayAttendance?.check_in && !!todayAttendance?.check_out && approved;

  const isRejected =
    !!todayAttendance?.check_in &&
    !todayAttendance?.check_out &&
    toBool(todayAttendance?.approved) === false;`,
    // new
    `  const approved = toBool(todayAttendance?.approved);

  // approved 가 명시적으로 false 인 경우만 반려로 판단
  // null / undefined / "" 은 "미승인(승인 전)" 이지 반려가 아님
  const isRejected =
    !!todayAttendance?.check_in &&
    !todayAttendance?.check_out &&
    (todayAttendance?.approved === false ||
      String(todayAttendance?.approved).toLowerCase() === "false");

  // 반려된 경우는 isPending 에서 제외
  const isPending =
    !!todayAttendance?.check_in &&
    !todayAttendance?.check_out &&
    !approved &&
    !isRejected;

  const isWorking = !!todayAttendance?.check_in && !todayAttendance?.check_out && approved;

  const isDone = !!todayAttendance?.check_in && !!todayAttendance?.check_out && approved;`,
  ],
];

// ── 실행 ──────────────────────────────────────────────────────────────────────
function applyPatches(filePath, patches) {
  let src = fs.readFileSync(filePath, "utf8");
  let changed = 0;

  for (const [oldStr, newStr] of patches) {
    if (!src.includes(oldStr)) {
      console.error(`[SKIP] 대상 문자열을 찾지 못했습니다. 이미 패치됐거나 파일이 다릅니다.`);
      console.error(`  찾던 문자열 시작: "${oldStr.slice(0, 60).replace(/\n/g, "\\n")}..."`);
      continue;
    }
    src = src.replace(oldStr, newStr);
    changed++;
    console.log(`[OK] 패치 적용 완료 (${changed}번째)`);
  }

  if (changed > 0) {
    fs.writeFileSync(filePath, src, "utf8");
    console.log(`\n저장 완료: ${filePath}`);
    console.log(`총 ${changed}개 패치 적용`);
  } else {
    console.log("\n변경 사항 없음. 파일 그대로 유지.");
  }
}

console.log("=== patch-1: staff/App.jsx isRejected/isPending 수정 ===\n");
applyPatches(FILE, PATCHES);
