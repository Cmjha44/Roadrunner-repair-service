import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Provider with Drive scopes
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/drive.file");
// Request offline/consent so token is renewed
googleProvider.setCustomParameters({
  prompt: "select_account",
});

// In-memory token caching (NOT in localStorage / sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) {
        onAuthFailure();
      }
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken || "";

    cachedAccessToken = accessToken;

    // Send access token and user info to backend so all subsequent uploads & syncs
    // automatically save to this user's Google Drive
    if (accessToken) {
      try {
        await fetch("/api/auth/google/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken,
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
          }),
        });
      } catch (err) {
        console.warn("Failed to notify server of session:", err);
      }
    }

    return { user: result.user, accessToken };
  } catch (error: any) {
    // If the user closed the popup window or clicked cancel, handle gracefully without throwing an unhandled exception
    if (
      error?.code === "auth/popup-closed-by-user" ||
      error?.message?.includes("auth/popup-closed-by-user")
    ) {
      console.info("Google Sign-in was cancelled by user (popup closed).");
      return null;
    }

    if (
      error?.code === "auth/popup-blocked" ||
      error?.message?.includes("auth/popup-blocked")
    ) {
      console.warn("Google Sign-in popup was blocked by browser. Please allow popups for this site.");
      throw new Error("Popup blocked by browser. Please allow popups and try again.");
    }

    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const googleLogout = async () => {
  try {
    await signOut(auth);
  } finally {
    cachedAccessToken = null;
    try {
      await fetch("/api/auth/google/session", {
        method: "DELETE",
      });
    } catch (e) {
      // ignore
    }
  }
};
