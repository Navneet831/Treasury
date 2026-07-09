import { supabase } from './supabaseClient';
import { useAuthStore } from './useAuthStore';

/**
 * Authenticates the user with an OAuth provider.
 * This function dynamically resolves the redirect URL to support 
 * both local development (127.0.0.1) and Vercel production seamlessly.
 */
export const signInWithProvider = async (provider: 'google' | 'github' | 'apple') => {
  // window.location.origin dynamically captures the current environment.
  // Locally: http://127.0.0.1:8000
  // Vercel: https://your-project-domain.vercel.app
  const redirectUrl = `${window.location.origin}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider,
    options: {
      redirectTo: redirectUrl,
    },
  });

  if (error) {
    console.error('Authentication Error:', error.message);
    throw error;
  }

  return data;
};

// If you are using Magic Links or OTP, apply the same logic:
export const signInWithEmail = async (email: string) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  
  if (error) throw error;
  return data;
};

export interface WhitelistResult {
    ok: boolean;
    errorMsg?: string;
}

/**
 * Verifies if the authenticated user's email exists in the whitelist.
 * If verified, it updates the auth store with the user data and features.
 * Otherwise, it signs the user out and sets an error message.
 */
export async function verifyWhitelistAndSetUser(
    session: { user?: { email?: string } } | null,
    opts?: { skipDelay?: boolean }
): Promise<WhitelistResult> {
    const email = session?.user?.email;
    if (!email) return { ok: false, errorMsg: 'No email in session.' };

    if (!opts?.skipDelay) {
        // Adding a slight delay can help mitigate race conditions right after login
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const { data, error } = await supabase
        .from('whitelist')
        .select('*')
        .ilike('email', email)
        .single();

    if (error || !data) {
        await supabase.auth.signOut();
        const msg = `ACCESS DENIED. The email address (${email}) could not be verified.`;
        useAuthStore.getState().setAuthError(msg);
        return { ok: false, errorMsg: msg };
    }

    const features: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(data)) {
        if (key !== 'email' && typeof value === 'boolean') {
            features[key] = value as boolean;
        }
    }

    const { setUser, setAuthenticated } = useAuthStore.getState();
    setUser({ email, features });
    setAuthenticated(true);
    return { ok: true };
}

// ... keep your existing signOut and session methods below ...
