// Central configuration. Override any of these with environment variables.
export const config = {
  // Rosti.cz proxies to an HTTP server on 8080, so that is the default.
  // Locally, `npm run dev` sets PORT=3000.
  port: process.env.PORT || 8080,

  // Code visitors must enter to view the gallery.
  accessCode: process.env.ACCESS_CODE || "BotyLazi",

  // Password to reach the admin panel (upload / edit / delete).
  adminPassword: process.env.ADMIN_PASSWORD || "Lazi123",

  // Secret used to sign the session cookie. Change in production.
  sessionSecret: process.env.SESSION_SECRET || "change-me-in-production",

  // Max photos per shoe and max upload size (bytes).
  maxPhotosPerShoe: 8,
  maxUploadBytes: 8 * 1024 * 1024, // 8 MB per file
};
