const IS_DEV = import.meta.env.DEV;

export const STAFF_API_URL = IS_DEV
  ? "/api/staff"
  : "https://script.google.com/macros/s/AKfycbyHU9b2OEeLMY9z9S94M7XWhfOYV7AwmZ8DHTzeBDspD3dGnf9GT2xCRzCaAQGTZ342zQ/exec";
