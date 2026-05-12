/**
 * Lightweight biometric/device unlock using WebAuthn (works on iOS/Android
 * Safari/Chrome PWAs and inside Capacitor WebView). No native plugin
 * required. Falls back gracefully when unsupported.
 *
 * Strategy: register a platform authenticator credential keyed to the user's
 * device. On unlock, prompt the OS biometric (Face ID / Touch ID /
 * fingerprint) to satisfy the credential. We don't verify the assertion
 * server-side — this is purely a local app-lock gate.
 */

const ENABLED_KEY = "grim_biometric_enabled";
const CRED_KEY = "grim_biometric_cred_id";
const SESSION_KEY = "grim_biometric_unlocked";
const LOGIN_CREDS_KEY = "grim_biometric_login_creds";

interface StoredLoginCreds {
  nickname: string;
  password: string;
}

/** Save login credentials behind biometric gate so user can re-login after sign-out. */
export const saveBiometricLogin = (nickname: string, password: string) => {
  try {
    const payload: StoredLoginCreds = { nickname, password };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    localStorage.setItem(LOGIN_CREDS_KEY, encoded);
  } catch {
    /* ignore */
  }
};

export const hasBiometricLogin = () =>
  typeof localStorage !== "undefined" && !!localStorage.getItem(LOGIN_CREDS_KEY);

export const clearBiometricLogin = () => {
  localStorage.removeItem(LOGIN_CREDS_KEY);
};

/** Prompt biometric, then return stored credentials on success. */
export const getBiometricLogin = async (): Promise<StoredLoginCreds | null> => {
  if (!hasBiometricLogin()) return null;
  const ok = await verifyBiometric();
  if (!ok) return null;
  try {
    const raw = localStorage.getItem(LOGIN_CREDS_KEY);
    if (!raw) return null;
    return JSON.parse(decodeURIComponent(escape(atob(raw)))) as StoredLoginCreds;
  } catch {
    return null;
  }
};

const isSupported = () =>
  typeof window !== "undefined" &&
  typeof (window as any).PublicKeyCredential !== "undefined" &&
  typeof navigator !== "undefined" &&
  !!navigator.credentials;

export const isBiometricSupported = async (): Promise<boolean> => {
  if (!isSupported()) return false;
  try {
    return await (window as any).PublicKeyCredential
      .isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

export const isBiometricEnabled = () =>
  typeof localStorage !== "undefined" && localStorage.getItem(ENABLED_KEY) === "1";

const randBytes = (n: number) => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
};

/** Register a platform authenticator and store the credential id locally. */
export const enableBiometric = async (userId: string, displayName: string): Promise<boolean> => {
  if (!(await isBiometricSupported())) return false;
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: randBytes(32),
        rp: { name: "Grim", id: window.location.hostname },
        user: {
          id: new TextEncoder().encode(userId),
          name: displayName || "grim-user",
          displayName: displayName || "Grim",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },   // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    const id = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
    localStorage.setItem(CRED_KEY, id);
    localStorage.setItem(ENABLED_KEY, "1");
    sessionStorage.setItem(SESSION_KEY, "1");
    return true;
  } catch (e) {
    console.warn("[biometric] enroll failed", e);
    return false;
  }
};

export const disableBiometric = () => {
  localStorage.removeItem(ENABLED_KEY);
  localStorage.removeItem(CRED_KEY);
  localStorage.removeItem(LOGIN_CREDS_KEY);
  sessionStorage.removeItem(SESSION_KEY);
};

const b64ToBytes = (b64: string) => {
  const bin = atob(b64);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
};

/** Prompt biometric to unlock. Returns true on success. */
export const verifyBiometric = async (): Promise<boolean> => {
  if (!isSupported()) return false;
  const credId = localStorage.getItem(CRED_KEY);
  try {
    await navigator.credentials.get({
      publicKey: {
        challenge: randBytes(32),
        timeout: 60000,
        userVerification: "required",
        ...(credId
          ? { allowCredentials: [{ id: b64ToBytes(credId), type: "public-key" }] }
          : {}),
      },
    });
    sessionStorage.setItem(SESSION_KEY, "1");
    return true;
  } catch (e) {
    console.warn("[biometric] verify failed", e);
    return false;
  }
};

/** Gate the app at startup. Resolves once unlocked (or skipped). */
export const ensureUnlocked = async (): Promise<boolean> => {
  if (!isBiometricEnabled()) return true;
  if (sessionStorage.getItem(SESSION_KEY) === "1") return true;
  return await verifyBiometric();
};
