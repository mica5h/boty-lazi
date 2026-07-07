// Central configuration. Override any of these with environment variables.
export const config = {
  port: process.env.PORT || 3000,

  // Code visitors must enter to view the gallery.
  accessCode: process.env.ACCESS_CODE || "SHOES2026",

  // Password to reach the admin panel (upload / edit / delete).
  adminPassword: process.env.ADMIN_PASSWORD || "admin123",

  // Secret used to sign the session cookie. Change in production.
  sessionSecret: process.env.SESSION_SECRET || "change-me-in-production",

  // Max photos per shoe and max upload size (bytes).
  maxPhotosPerShoe: 8,
  maxUploadBytes: 8 * 1024 * 1024, // 8 MB per file
};
