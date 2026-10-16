export const API_URL = import.meta.env.VITE_API_URL || 
  (typeof window !== "undefined" && window.location.hostname
    ? `http://${window.location.hostname}:3000` 
    : "http://localhost:3000");
