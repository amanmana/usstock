import React from 'react';
import {
    ArrowLeft,
    ClipboardCheck,
    TrendingUp,
    Activity,
    Target,
    ShieldAlert,
    BarChart2,
    CheckCircle2,
    Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Import assets
import dashboardImg from '../assets/sop/dashboard.png';
import modalTopImg from '../assets/sop/modal_top.png';
import modalBottomImg from '../assets/sop/modal_bottom.png';

const SOP = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background text-text-primary font-sans p-6 md:p-12 pb-32">
            <div className="max-w-5xl mx-auto">
                {/* Back Button */}
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-10 group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Kembali ke Dashboard
                </button>

                {/* Header */}
                <div className="mb-16">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-primary/20 rounded-2xl">
                            <ClipboardCheck className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-white uppercase italic">
                            SOP <span className="text-primary">Trading</span> Harian
                        </h1>
                    </div>
                    <p className="text-xl text-gray-400 max-w-2xl leading-relaxed">
                        Ikuti langkah sistematik ini setiap pagi untuk mengekalkan disiplin dan memaksimumkan profit sebagai Swing Trader.
                    </p>
                </div>

                {/* Main Content */}
                <div className="space-y-24">

                    {/* SCENARIO A */}
                    <Section
                        id="scenario-a"
                        title="Senario A: Mencari Peluang (Tiada Holding)"
                        icon={<TrendingUp className="w-6 h-6 text-emerald-400" />}
                        badge="MARKET SCANNING"
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                            <div className="space-y-8">
                                <StepNumber
                                    number="1"
                                    title="Pilih Strategi & Skor"
                                    desc="Buka Dashboard dan pilih tab Rebound atau Momentum. Fokus pada kaunter dengan Skor 8.0 ke atas."
                                />
                                <StepNumber
                                    number="2"
                                    title="Semak Pelan Swing"
                                    desc="Lihat bahagian 'Pelan Dagangan Swing'. Kenal pasti harga Entry Trigger, Target Price (TP), dan Stop Loss (SL)."
                                />
                                <StepNumber
                                    number="3"
                                    title="Kira Risk Management"
                                    desc="Gunakan kalkulator di modal. Masukkan 'Max Risk (RM)' anda untuk mendapatkan kuantiti lot yang tepat."
                                />
                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mt-6 flex items-start gap-3">
                                    <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-emerald-100 italic">
                                        Tip: Jangan beli jika RR Ratio kurang daripada 1.5. Cari setup A+ dengan RR 2.0 ke atas.
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                                    <img src={dashboardImg} alt="Dashboard Tabs" className="w-full" />
                                </div>
                                <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                                    <img src={modalBottomImg} alt="Setup & Plan" className="w-full" />
                                </div>
                            </div>
                        </div>
                    </Section>

                    {/* SCENARIO B */}
                    <Section
                        id="scenario-b"
                        title="Senario B: Mengurus Portfolio (Ada Holding)"
                        icon={<Activity className="w-6 h-6 text-blue-400" />}
                        badge="MONITORING & EXIT"
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                            <div className="order-2 lg:order-1 space-y-4">
                                <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                                    <img src={modalTopImg} alt="Monitoring Indicators" className="w-full" />
                                </div>
                            </div>
                            <div className="order-1 lg:order-2 space-y-8">
                                <StepNumber
                                    number="1"
                                    title="Monitor Lampu Isyarat"
                                    desc="Lihat Traffic Lights (15m, 1D, 1W). Jika 3/3 Hijau, trend sangat kuat. Jika Lampu 15m Merah, harga telah bocor paras sokongan 4-jam—bersedia untuk strategi 'Lock Profit'."
                                />
                                <StepNumber
                                    number="2"
                                    title="Pantau Untung/Rugi RM"
                                    desc="Kolum 'Untung/Rugi' menunjukkan nilai tepat dalam RM. Ini membantu anda membuat keputusan berdasarkan angka sebenar, bukan sekadar peratusan."
                                />
                                <StepNumber
                                    number="3"
                                    title="Ikut Nasihat Automatik"
                                    desc="Sistem akan keluarkan kotak amaran MERAH berlabel 'JUAL SEKARANG' jika harga mencecah Stop Loss atau Target Profit. Ikut tanpa ragu-ragu."
                                />
                                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl mt-6 flex items-start gap-3">
                                    <Target className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-blue-100 italic">
                                        Peringatan: Jika kena Stop Loss, keluar serta merta. Survival lebih penting daripada ego.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Section>

                </div>

                {/* Final Motivation */}
                <div className="mt-32 p-10 bg-gradient-to-br from-primary/10 to-surfaceHighlight/30 border border-primary/20 rounded-[2.5rem] text-center backdrop-blur-md relative overflow-hidden group">
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                    <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-6" />
                    <h3 className="text-2xl font-black text-white mb-3 italic uppercase">Trading Adalah Bisnes</h3>
                    <p className="text-gray-400 max-w-xl mx-auto leading-relaxed">
                        SOP ini adalah kunci kepada konsistensi anda. Jangan paksa trade jika tiada signal. Biarkan sistem berkerja untuk anda.
                    </p>
                </div>
            </div>
        </div>
    );
};

const Section = ({ title, icon, badge, children, id }) => (
    <div id={id} className="scroll-mt-24">
        <div className="flex flex-col gap-2 mb-8">
            <span className="text-[10px] font-black tracking-[0.3em] text-primary uppercase">{badge}</span>
            <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 shadow-lg">
                    {icon}
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">{title}</h2>
            </div>
        </div>
        <div className="bg-surface/40 border border-border p-8 md:p-12 rounded-[2.5rem] backdrop-blur-sm shadow-2xl relative">
            {children}
        </div>
    </div>
);

const StepNumber = ({ number, title, desc }) => (
    <div className="flex gap-6 items-start group">
        <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0 font-black text-lg border border-primary/30 group-hover:bg-primary group-hover:text-white transition-all duration-300">
            {number}
        </div>
        <div>
            <h4 className="text-lg font-bold text-white mb-1 group-hover:text-primary transition-colors">{title}</h4>
            <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
        </div>
    </div>
);

export default SOP;
