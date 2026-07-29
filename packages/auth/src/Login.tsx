import React, { useState, useEffect } from 'react';
import { useAuthStore } from './useAuthStore';
import { User, ShieldAlert } from 'lucide-react';
import { supabase } from './supabaseClient';

export interface LoginProps {
    skipIntro?: boolean;
    redirectTo?: string;
}

export const Login: React.FC<LoginProps> = ({ skipIntro = false, redirectTo }) => {
    const { authError, setAuthError } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
    const [showUI, setShowUI] = useState(skipIntro);
    const [typewriterText, setTypewriterText] = useState('');

    const showNotification = (type: 'error' | 'success', msg: string, durationMs = 5000) => {
        setNotification({ type, msg });
        setTimeout(() => setNotification(null), durationMs);
    };

    // Surface auth errors set by App.tsx's centralised auth handler
    useEffect(() => {
        if (authError) {
            showNotification('error', authError);
            setAuthError(null);
            setShowUI(true);
        }
    }, [authError]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const hasCode = params.has('code');
        const hasError = params.has('error');
        const hasHash = window.location.hash.includes('access_token');
        if (window.location.pathname === '/auth/callback' && !hasCode && !hasHash && !hasError) {
            window.history.replaceState({}, document.title, '/');
        }

        // Typewriter
        const words = ['Energy', 'Solar', 'Analytics'];
        let wordIndex = 0, charIndex = 0, isDeleting = false;
        let typeTimer: ReturnType<typeof setTimeout>;
        const typeTick = () => {
            const word = words[wordIndex];
            charIndex += isDeleting ? -1 : 1;
            setTypewriterText(word.substring(0, charIndex));
            let speed = isDeleting ? 60 : 150;
            if (!isDeleting && charIndex === word.length) { speed = 1500; isDeleting = true; }
            else if (isDeleting && charIndex === 0) { isDeleting = false; wordIndex = (wordIndex + 1) % words.length; speed = 500; }
            typeTimer = setTimeout(typeTick, speed);
        };
        typeTimer = setTimeout(typeTick, 150);
        const uiTimer = setTimeout(() => setShowUI(true), 1500);

        return () => {
            clearTimeout(typeTimer);
            clearTimeout(uiTimer);
        };
    }, []);

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectTo ?? (window.location.origin + '/auth/callback'),
                    queryParams: {
                        prompt: 'select_account'
                    }
                }
            });
            if (error) throw error;
        } catch (err: any) {
            showNotification('error', err.message || 'Google sign-in failed.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleMicrosoftLogin = async () => {
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'azure',
                options: {
                    redirectTo: redirectTo ?? (window.location.origin + '/auth/callback'),
                    scopes: 'email openid profile',
                    queryParams: {
                        prompt: 'select_account'
                    }
                }
            });
            if (error) throw error;
        } catch (err: any) {
            showNotification('error', err.message || 'Microsoft sign-in failed.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#05070A] flex flex-col items-center justify-center overflow-hidden font-sans">
            <svg className="hidden">
                <filter id="noiseFilter">
                    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
                </filter>
            </svg>

            {!showUI ? (
                <div className="relative z-20 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                    <div className="mb-4 w-10 h-10 border-[3px] border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-slate-400 text-xs font-medium tracking-widest uppercase animate-pulse mb-8">
                        Establishing Secure Matrix...
                    </p>
                    <button
                        onClick={() => setShowUI(true)}
                        className="group flex items-center gap-3 px-5 py-2.5 bg-slate-900/50 hover:bg-slate-800 border border-slate-800 rounded-xl text-[10px] text-slate-500 hover:text-white font-bold uppercase tracking-[0.2em] transition-all"
                    >
                        <User className="w-3.5 h-3.5 group-hover:text-emerald-500 transition-colors" />
                        Manual Access Login
                    </button>
                </div>
            ) : (
                <div className="relative z-20 w-full max-w-sm animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="relative rounded-3xl p-[1px] overflow-hidden bg-slate-800/30 border border-slate-700/50 shadow-2xl">
                        <div className="relative bg-[#0A0C10]/95 backdrop-blur-2xl rounded-[23px] overflow-hidden p-8">
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ filter: 'url(#noiseFilter)' }} />
                            <div className="relative">
                                {/* Logo + Title */}
                                <div className="text-center mb-8">
                                    <div className="inline-flex items-center justify-center mb-4">
                                        <svg className="w-12 h-12 text-emerald-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M21 3l-18 7 7 4 4 7z" />
                                        </svg>
                                    </div>
                                    <h1 className="text-xl font-bold text-white tracking-tight flex flex-wrap justify-center gap-1.5">
                                        Grew{' '}
                                        <span className="inline-flex items-center">
                                            <span className="text-emerald-500 font-extrabold">{typewriterText}</span>
                                            <span className="ml-0.5 w-[2px] h-5 bg-emerald-500 animate-pulse" />
                                        </span>
                                    </h1>
                                </div>

                                {/* OAuth Buttons */}
                                <form className="space-y-6">
                                    <div className="space-y-3">
                                        <button
                                            type="button"
                                            onClick={handleMicrosoftLogin}
                                            disabled={isLoading}
                                            className="w-full text-xs font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 bg-[#1F1F1F] text-white hover:bg-[#2A2A2A] border border-slate-800 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            <svg className="w-3.5 h-3.5 mr-0.5" viewBox="0 0 23 23">
                                                <rect x="0" y="0" width="11" height="11" fill="#F25022" />
                                                <rect x="12" y="0" width="11" height="11" fill="#7FBA00" />
                                                <rect x="0" y="12" width="11" height="11" fill="#00A4EF" />
                                                <rect x="12" y="12" width="11" height="11" fill="#FFB900" />
                                            </svg>
                                            {isLoading ? 'Redirecting...' : 'Continue with Microsoft'}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleGoogleLogin}
                                            disabled={isLoading}
                                            className="w-full text-xs font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 bg-white text-slate-900 hover:bg-slate-100 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                            </svg>
                                            {isLoading ? 'Redirecting...' : 'Continue with Google'}
                                        </button>
                                    </div>
                                </form>

                                {/* Notification banner */}
                                {notification && (
                                    <div className={`mt-4 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 border ${
                                        notification.type === 'error'
                                            ? 'border-rose-500/50 bg-rose-500/10'
                                            : 'border-emerald-500/50 bg-emerald-500/10'
                                    }`}>
                                        <ShieldAlert className={`w-5 h-5 shrink-0 mt-0.5 ${notification.type === 'error' ? 'text-rose-500' : 'text-emerald-500'}`} />
                                        <p className={`text-[10px] font-medium leading-relaxed ${notification.type === 'error' ? 'text-rose-200' : 'text-emerald-200'}`}>
                                            {notification.msg}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
