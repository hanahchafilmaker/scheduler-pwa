// 환경에 따라 API URL 자동 선택
// - 로컬 개발: vite 프록시(/api/scheduler) 사용
// - 프로덕션(Vercel): GAS URL 직접 호출
const IS_DEV = import.meta.env.DEV;

export const API_URL = IS_DEV
  ? "/api/scheduler"
  : "https://script.google.com/macros/s/AKfycbwNkyY9klWD0nDlTtl4xjFjG1z1MVp8uoWa9LEPvkhcoR7VZu8Kk7asDlxYOaOcW8MLkA/exec";
