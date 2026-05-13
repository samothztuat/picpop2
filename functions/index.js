const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

initializeApp();

const SUPERADMIN_EMAIL = "tomtautz@gmail.com";

// Setzt das Passwort eines beliebigen Firebase-Auth-Users direkt — ohne den Account neu anzulegen.
// Darf nur vom Superadmin aufgerufen werden.
exports.adminSetPassword = onCall({ region: "europe-west1" }, async (request) => {
  // Authentifizierung prüfen
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Nicht angemeldet.");
  }
  if (request.auth.token.email !== SUPERADMIN_EMAIL) {
    throw new HttpsError("permission-denied", "Nur für Superadmin.");
  }

  const { uid, newPassword } = request.data;
  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "uid fehlt.");
  }
  if (!newPassword || newPassword.length < 6) {
    throw new HttpsError("invalid-argument", "Passwort muss mindestens 6 Zeichen haben.");
  }

  await getAuth().updateUser(uid, { password: newPassword });
  return { success: true };
});
