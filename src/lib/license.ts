/**
 * UniTvFilm — License Protection System
 * Validates the operator license key before allowing access to the platform.
 * The secret key is NEVER stored in plain text — only its SHA-256 hash.
 */

// SHA-256 hash of "Nivaldosilva01062002####"
// Generated: echo -n "Nivaldosilva01062002####" | sha256sum
const LICENSE_KEY_HASH = "2ad34a76026f0b9a77b16cbf12a78e559f1a7c7bcebb453107dad287482a6568";

// Domains that are ALWAYS authorized (no key needed — these are YOUR official deployments)
const AUTHORIZED_DOMAINS: string[] = [
  "unitvfilms-git-main-wwwosvaldocoma-2541s-projects.vercel.app",
  "unitvfilms-cyduae4x1-wwwosvaldocoma-2541s-projects.vercel.app",
  "localhost",
  "127.0.0.1",
];

// Additional authorized domain from env (custom domain set in Vercel)
const ENV_AUTHORIZED_DOMAIN = import.meta.env.VITE_AUTHORIZED_DOMAIN as string | undefined;

const LS_KEY = "__unitvfilm_lic__";

// Key that stores whether the LicenseGate is enabled (default: disabled)
const LS_GATE_ENABLED_KEY = "__unitvfilm_gate_enabled__";

/** Returns whether the LicenseGate is enabled. Defaults to false (disabled) */
export function isLicenseGateEnabled(): boolean {
  try {
    const val = localStorage.getItem(LS_GATE_ENABLED_KEY);
    // If key was never set, default to false (disabled)
    if (val === null) return false;
    return val === "true";
  } catch {
    return false;
  }
}

/** Enable or disable the LicenseGate */
export function setLicenseGateEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LS_GATE_ENABLED_KEY, enabled ? "true" : "false");
  } catch {
    // ignore
  }
}

/** Compute SHA-256 hash of a string using the Web Crypto API */
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Check if the current hostname is an officially authorized domain */
export function isAuthorizedDomain(): boolean {
  if (typeof window === "undefined") return true;
  const hostname = window.location.hostname;

  const allAuthorized = [...AUTHORIZED_DOMAINS];
  if (ENV_AUTHORIZED_DOMAIN) allAuthorized.push(ENV_AUTHORIZED_DOMAIN);

  return allAuthorized.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

/** Check if a valid license is already saved in localStorage */
export function hasSavedLicense(): boolean {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (!saved) return false;
    // Verify the saved hash matches the expected key hash
    return saved === LICENSE_KEY_HASH;
  } catch {
    return false;
  }
}

/** Validate a license key entered by the user */
export async function validateLicenseKey(key: string): Promise<boolean> {
  try {
    const trimmed = key.trim();
    if (!trimmed) return false;
    const hash = await sha256(trimmed);
    if (hash === LICENSE_KEY_HASH) {
      localStorage.setItem(LS_KEY, hash);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Clear the saved license (for admin reset purposes) */
export function clearLicense(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }
}

/** Main gate check — returns true if app should be accessible */
export function isLicenseGranted(): boolean {
  // If the gate is disabled, always grant access
  if (!isLicenseGateEnabled()) return true;
  return isAuthorizedDomain() || hasSavedLicense();
}
