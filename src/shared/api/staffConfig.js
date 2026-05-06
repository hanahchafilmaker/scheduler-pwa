const PROD_API =
  "https://script.google.com/macros/s/AKfycbx10oBcx7NsK2bK_KO-S09J0Znw4VSWr3o8hp8-U06dCrC3F4KZztH833OKqoPUBfnCAg/exec";

export const STAFF_API_URL = import.meta.env.DEV ? "/api/staff" : PROD_API;