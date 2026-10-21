// Student identity helpers: a real full name plus a unique username.
// Pure functions only, so they are easy to test. The database enforces the same rules.

export const USERNAME_RE = /^[a-z0-9._]{3,20}$/;

export function normalizeUsername(v) {
  return String(v || "").trim().toLowerCase();
}

// Returns an error message, or "" when the username is acceptable.
export function usernameError(v) {
  const u = normalizeUsername(v);
  if (!u) return "Choose a username.";
  if (u.length < 3) return "Use at least 3 characters.";
  if (u.length > 20) return "Use at most 20 characters.";
  if (!USERNAME_RE.test(u)) return "Use only letters, numbers, dots and underscores.";
  if (/^[._]|[._]$/.test(u)) return "Start and end with a letter or number.";
  if (/[._]{2,}/.test(u)) return "Don't put two dots or underscores in a row.";
  return "";
}

export function cleanFullName(v) {
  return String(v || "").replace(/\s+/g, " ").trim();
}

export function fullNameError(v) {
  const n = cleanFullName(v);
  if (n.length < 2) return "Enter your full name.";
  if (n.length > 80) return "That name is too long.";
  if (!/\p{L}/u.test(n)) return "Enter your real name using letters.";
  return "";
}

// "Amina Kato" -> "amina.kato"; used only as a starting suggestion.
export function suggestUsername(fullName) {
  const parts = cleanFullName(fullName).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(" ").map((p) => p.replace(/[^a-z0-9]/g, "")).filter(Boolean);
  if (!parts.length) return "";
  let u = parts.length === 1 ? parts[0] : `${parts[0]}.${parts[parts.length - 1]}`;
  if (u.length > 20) u = u.slice(0, 20).replace(/[._]+$/, "");
  while (u.length < 3) u += "1";
  return u;
}

// Maps raw sign-up failures to something a student can act on.
export function friendlySignupError(message) {
  const m = String(message || "");
  if (/already (registered|exists)|user_already_exists/i.test(m)) return "That email already has an account. Try signing in instead.";
  if (/password/i.test(m) && /(6|short|weak|least)/i.test(m)) return "Choose a longer password (at least 6 characters).";
  return m || "Something went wrong. Try again.";
}

// "Amina Kato (@amina.k)" or just the name when there is no username.
export function displayWithUsername(name, username) {
  return username ? `${name} (@${username})` : name;
}
