const IS_DEV = import.meta.env.DEV;

export const API_URL = IS_DEV
  ? "/api/scheduler"
  : "https://script.google.com/macros/s/AKfycbwCvilYKpGVECaRcuwKvzI_7FO9BTtoDcBp9gQiFX0h81-biLPKn0uC58m43FY9zsM6Kg/exec";
