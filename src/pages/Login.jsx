import React, { useState } from 'react';
import { Lock, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';

const Login = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        // The password provided by user: durian6447
        // In a real app we might fetch this from an env var or API
        // but for a "Simple Login" as requested, we'll check it here.
        if (password === 'durian6447') {
            onLogin();
        } else {
            setError(true);
            setTimeout(() => setError(false), 2000);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 font-sans">
            {/* Background Decorative Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px]"></div>
            </div>

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="inline-flex p-4 rounded-3xl bg-white/5 border border-white/10 mb-6 shadow-2xl">
                        <Lock className="w-10 h-10 text-primary" />
                    </div>
                    <h1 className="text-4xl font-black tracking-tighter text-white mb-2">
                        B.R.S SCREENER
                    </h1>
                    <p className="text-gray-500 font-medium">Sistem Analisis Saham Peribadi</p>
                </div>

                <div className="bg-[#0c0c0e] border border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-2xl shadow-black/50 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3 ml-1">
                                Sila Masukkan Kata Laluan
                            </label>
                            <div className="relative group">
                                <input
                                    autoFocus
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className={`
                                        w-full bg-white/5 border rounded-2xl py-4 px-6 text-white text-lg font-bold
                                        outline-none transition-all placeholder:text-gray-700
                                        ${error ? 'border-red-500 ring-4 ring-red-500/10' : 'border-white/10 focus:border-primary/50 focus:ring-4 focus:ring-primary/10'}
                                    `}
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity">
                                    <ShieldCheck className={`w-6 h-6 ${error ? 'text-red-500' : 'text-primary'}`} />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-500 text-xs font-bold animate-in zoom-in duration-200 justify-center">
                                <AlertCircle className="w-4 h-4" />
                                Kata laluan salah. Sila cuba lagi.
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-primary/20 active:scale-95 flex items-center justify-center gap-2 group"
                        >
                            Unlock Screener
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-white/5 text-center">
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                            Authorized Access Only &copy; 2026
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
