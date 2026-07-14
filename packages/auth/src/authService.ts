import { supabase } from './supabaseClient';
import { useAuthStore } from './useAuthStore';

export interface WhitelistResult {
    ok: boolean;
    errorMsg?: string;
}

export async function verifyWhitelistAndSetUser(
    session: { user?: { email?: string } } | null,
    opts?: { skipDelay?: boolean }
): Promise<WhitelistResult> {
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) return { ok: false, errorMsg: 'No email in session.' };

    if (!opts?.skipDelay) {
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const { data, error } = await supabase
        .from('whitelist')
        .select('*')
        .ilike('email', email)
        .single();

    if (error || !data) {
        console.error('Whitelist verification failed for email:', email, 'Error:', error);
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
