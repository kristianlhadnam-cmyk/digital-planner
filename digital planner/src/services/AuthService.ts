import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
  updateProfile,
} from 'firebase/auth';
import { auth } from './firebase';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export const signUp = async (
  email: string,
  password: string,
  displayName: string
): Promise<AuthUser> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    // Update profile with display name
    if (userCredential.user && displayName) {
      await updateProfile(userCredential.user, { displayName });
    }

    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      displayName: displayName || null,
    };
  } catch (error: any) {
    console.error('Sign up error:', error);
    throw new Error(parseAuthError(error.code));
  }
};

export const signIn = async (
  email: string,
  password: string
): Promise<AuthUser> => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );
    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      displayName: userCredential.user.displayName,
    };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw new Error(parseAuthError(error.code));
  }
};

export const logOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

export const resetPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error: any) {
    console.error('Reset password error:', error);
    throw new Error(parseAuthError(error.code));
  }
};

export const getCurrentUser = (): AuthUser | null => {
  const user = auth.currentUser;
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  };
};

export const subscribeToAuthChanges = (
  callback: (user: AuthUser | null) => void
) => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      callback({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });
    } else {
      callback(null);
    }
  });
};

const parseAuthError = (code: string): string => {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Try logging in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign in is not enabled.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection.';
    default:
      return 'An error occurred. Please try again.';
  }
};
