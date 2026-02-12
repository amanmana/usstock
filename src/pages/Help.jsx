import React from 'react';
import {
    ArrowLeft,
    BookOpen,
    TrendingUp,
    Activity,
    Target,
    ShieldAlert,
    HelpCircle,
    ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const sections = [
    { id: 'rebound-strategy', title: 'Strategi Rebound', desc: 'Cara beli masa harga jatuh (Pullback)', icon: <Activity />, color: 'emerald' },
    { id: 'momentum-strategy', title: 'Strategi Momentum', desc: 'Cara beli masa harga tengah pecah naik.', icon: <TrendingUp />, color: 'orange' },
    { id: 'trade-setup', title: 'Trade Setup', desc: 'Pelan TP, SL dan RRR.', icon: <Target />, color: 'blue' },
    { id: 'mtf-confirmation', title: 'Trend Confirmation', desc: 'Sistem 3-Dot (Alignment).', icon: <Activity />, color: 'purple' },
    { id: 'risk-management', title: 'Risk Management', desc: 'Kalkulator Lot & Sizing.', icon: <ShieldAlert />, color: 'red' },
    { id: 'sr-levels', title: 'Support & Resistance', desc: 'Tahap rintangan dan kekuatan.', icon: <HelpCircle />, color: 'indigo' },
];

const HelpPage = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background text-text-primary font-sans p-6 md:p-12 pb-24">
            <div className="max-w-4xl mx-auto">
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
                            <BookOpen className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-white uppercase italic">
                            Panduan <span className="text-primary">Emas</span> B.R.S
                        </h1>
                    </div>
                    <p className="text-xl text-gray-400 max-w-2xl leading-relaxed">
                        Ketik data dibalik harga. Ketahui cara memaksimumkan potensi Rebound & Momentum untuk profit konsisten.
                    </p>
                </div>

                {/* Dynamic Navigation / TOC */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
                    {sections.map((section, idx) => (
                        <a key={idx} href={`#${section.id}`} className="p-4 bg-surface/40 border border-border rounded-2xl hover:border-primary/50 transition-all group backdrop-blur-sm">
                            <div className="flex items-center gap-4">
                                <div className={`p-2.5 rounded-xl bg-${section.color}-500/10 text-${section.color}-500`}>
                                    {section.icon}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-white group-hover:text-primary transition-colors text-xs">{section.title}</h3>
                                    <p className="text-[10px] text-gray-500 line-clamp-1">{section.desc}</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-primary transition-colors" />
                            </div>
                        </a>
                    ))}
                </div>

                {/* Content Sections */}
                <div className="space-y-24">
                    {/* REBOUND STRATEGY */}
                    <Section
                        id="rebound-strategy"
                        title="Strategi Rebound (Buy Low)"
                        icon={<Activity className="w-6 h-6" />}
                        color="emerald"
                    >
                        <div className="space-y-6">
                            <p className="text-gray-400 leading-relaxed">
                                Strategi ini mencari saham yang sedang **dalam trend menaik** tetapi sedang mengalami **penurunan sementara (pullback)** ke paras sokongan.
                            </p>

                            <div className="bg-emerald-500/5 p-6 rounded-2xl border border-emerald-500/20">
                                <h4 className="text-emerald-400 font-bold mb-4">Cara Maksimumkan Rebound:</h4>
                                <ul className="space-y-4">
                                    <li className="flex gap-3">
                                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 text-xs font-bold">1</div>
                                        <p className="text-sm text-gray-300">Cari skor Rebound **7.0 ke atas**. Ini bermakna saham sudah cukup "sejuk" dan mula menunjukkan tanda melantun.</p>
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 text-xs font-bold">2</div>
                                        <p className="text-sm text-gray-300">Pastikan **RSI di antara 35-45**. Jika RSI terlalu rendah (bawah 25), saham mungkin dalam fasa "jatuh bebas" (freefall) - elakkan.</p>
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 text-xs font-bold">3</div>
                                        <p className="text-sm text-gray-300">Set Buy Limit pada **Support Price** yang diberikan. Ini adalah titik masuk yang paling rendah risikonya.</p>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </Section>

                    {/* MOMENTUM STRATEGY */}
                    <Section
                        id="momentum-strategy"
                        title="Strategi Momentum (Buy High, Sell Higher)"
                        icon={<TrendingUp className="w-6 h-6" />}
                        color="orange"
                    >
                        <div className="space-y-6">
                            <p className="text-gray-400 leading-relaxed">
                                Strategi ini fokus kepada saham yang sedang **meletup (breakout)** dengan volume yang luar biasa. Kita tidak tunggu harga jatuh, kita kejar momentum!
                            </p>

                            <div className="bg-orange-500/5 p-6 rounded-2xl border border-orange-500/20">
                                <h4 className="text-orange-400 font-bold mb-4">Cara Maksimumkan Momentum:</h4>
                                <ul className="space-y-4">
                                    <li className="flex gap-3">
                                        <div className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 text-xs font-bold">1</div>
                                        <p className="text-sm text-gray-300">Cari skor Momentum **8.0 ke atas**. Ini adalah saham yang paling "hot" dalam pasaran sekarang.</p>
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 text-xs font-bold">2</div>
                                        <p className="text-sm text-gray-300">Lihat **Volume**. Jika volume hari ini {'>'} 2x ganda Avg Vol, itu adalah isyarat kemasukan pelabur besar (Shark).</p>
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 text-xs font-bold">3</div>
                                        <p className="text-sm text-gray-300">Strategi masuk: Beli sebaik sahaja harga **pecah Resistance 1 (R1)** dengan volume tinggi.</p>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </Section>

                    {/* MTF CONFIRMATION */}
                    <Section
                        id="mtf-confirmation"
                        title="Trend Confirmation (3-Dot)"
                        icon={<Activity className="w-6 h-6" />}
                        color="purple"
                    >
                        <p className="text-gray-400 mb-6 leading-relaxed">
                            Jangan berdagang secara buta. Gunakan sistem **3-Dot Alignment** untuk memastikan trend jangka panjang dan pendek adalah selari.
                        </p>
                        <div className="space-y-4">
                            <div className="flex gap-4 p-4 bg-surfaceHighlight/20 rounded-xl border border-white/5 items-start">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 font-black text-[10px]">1W</div>
                                <div>
                                    <h5 className="text-white text-xs font-bold mb-1">Weekly (Gajah)</h5>
                                    <p className="text-[11px] text-gray-500 leading-relaxed">Arah aliran besar (Mingguan). Pastikan ia **Hijau** untuk dagangan yang lebih selamat dan tenang.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 p-4 bg-surfaceHighlight/20 rounded-xl border border-white/5 items-start">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 font-black text-[10px]">1D</div>
                                <div>
                                    <h5 className="text-white text-xs font-bold mb-1">Daily (Harimau)</h5>
                                    <p className="text-[11px] text-gray-500 leading-relaxed">Trend utama harian. Menentukan ke mana arah harga akan pergi dalam masa terdekat.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 p-4 bg-surfaceHighlight/20 rounded-xl border border-white/5 items-start">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-300 font-black text-[10px]">15M</div>
                                <div>
                                    <h5 className="text-white text-xs font-bold mb-1">15m (Kancil)</h5>
                                    <p className="text-[11px] text-gray-500 leading-relaxed">Timing kemasukan. Gunakan untuk mencari "dip" atau breakout pantas semasa waktu pasaran.</p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-center">
                            <p className="text-xs font-bold text-indigo-300">💡 Tip Pro: Beli hanya bila anda nampak 3/3 Hijau (Alignment Sempurna)!</p>
                        </div>
                    </Section>

                    {/* RISK MANAGEMENT */}
                    <Section
                        id="risk-management"
                        title="Risk Management & Calculator"
                        icon={<ShieldAlert className="w-6 h-6" />}
                        color="red"
                    >
                        <p className="text-gray-400 mb-6 leading-relaxed">
                            Pelaburan sebenar memerlukan disiplin. Gunakan 🧮 **Risk:Reward Calculator** di bahagian "Manage My Position" untuk menjaga modal dan merancang keuntungan.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="p-4 bg-surfaceHighlight/20 rounded-xl border border-white/5">
                                <h5 className="text-red-400 text-xs font-bold mb-2 uppercase">1. Max Risk (RM)</h5>
                                <p className="text-[11px] text-gray-400 leading-relaxed">Jumlah tunai yang anda sanggup hilang jika terkena Stop Loss. Contoh: RM 50.</p>
                            </div>
                            <div className="p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/10">
                                <h5 className="text-indigo-400 text-xs font-bold mb-2 uppercase">2. Target Price (TP)</h5>
                                <p className="text-[11px] text-gray-400 leading-relaxed">Harga sasaran untuk jual. Sistem guna ini untuk kira potensi untung dalam RM.</p>
                            </div>
                        </div>

                        <div className="bg-surfaceHighlight/10 rounded-2xl p-5 border border-white/5 mb-6">
                            <h5 className="text-white text-xs font-bold mb-4 uppercase tracking-widest">Cara Baca RR Ratio:</h5>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 py-1 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-black text-center">RR 2.0+</div>
                                    <p className="text-[11px] text-gray-400">**Zon A+ (Strong Buy).** Potensi untung 2x ganda lebih besar dari risiko rugi.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-12 py-1 rounded bg-orange-500/20 text-orange-400 text-[9px] font-black text-center">RR 1.0+</div>
                                    <p className="text-[11px] text-gray-400">**Sederhana.** Untung dan rugi hampir sama besar. Perlu analisa tambahan.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-12 py-1 rounded bg-red-500/20 text-red-500 text-[9px] font-black text-center">RR {'<'} 1.0</div>
                                    <p className="text-[11px] text-gray-400">**High Risk (Avoid).** Risiko rugi lebih besar dari potensi untung.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/10 italic text-center">
                            <p className="text-[11px] text-gray-400">"Untung itu penting, tetapi menjaga modal (survival) adalah lebih penting dalam jangka panjang."</p>
                        </div>
                    </Section>

                    {/* TRADE SETUP */}
                    <Section
                        id="trade-setup"
                        title="Trade Setup (TP & SL)"
                        icon={<Target className="w-6 h-6" />}
                        color="blue"
                    >
                        <div className="space-y-6">
                            <p className="text-gray-400 leading-relaxed">
                                Anda mungkin perasan ada **dua set** nilai TP dan SL. Ini perbezaannya:
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
                                    <h5 className="text-indigo-400 font-bold text-xs uppercase mb-2">1. Level Sistem (Kanan)</h5>
                                    <p className="text-[11px] text-gray-400 leading-relaxed">
                                        Dihasilkan secara automatik berdasarkan **Analisa Teknikal** (support/resistance). Ini adalah tahap psikologi pasaran secara umum.
                                    </p>
                                </div>
                                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                                    <h5 className="text-primary font-bold text-xs uppercase mb-2">2. Level Peribadi (Kiri - My Plan)</h5>
                                    <p className="text-[11px] text-gray-400 leading-relaxed">
                                        Dihasilkan berdasarkan **Risk Management** anda sendiri dalam kalkulator. Ia bergantung kepada berapa modal yang anda sanggup rugi.
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                                <p className="text-[11px] text-gray-300 italic">
                                    **Nasihat:** Gunakan Level Sistem sebagai panduan am, tetapi sentiasa utamakan Level Peribadi (My Plan) untuk menjaga modal anda.
                                </p>
                            </div>

                            <p className="text-gray-400 text-sm mt-8 mb-4">
                                Perhatikan **RR Ratio** dalam pelan peribadi anda:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                                    <span className="text-red-400 font-bold text-xs uppercase block mb-1">RR {'<'} 1.0</span>
                                    <p className="text-[11px] text-gray-500 font-medium">Jangan Beli. Risiko rugi lebih besar dari untung.</p>
                                </div>
                                <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                                    <span className="text-orange-400 font-bold text-xs uppercase block mb-1">RR 1.0 - 1.5</span>
                                    <p className="text-[11px] text-gray-500 font-medium">Boleh beli jika anda yakin dengan fundamental syarikat.</p>
                                </div>
                                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                                    <span className="text-emerald-500 font-bold text-xs uppercase block mb-1">RR {'>'} 2.0</span>
                                    <p className="text-[11px] text-gray-500 font-medium">**Zon A+.** Keuntungan potensi adalah 2x risiko. Utamakan ini.</p>
                                </div>
                            </div>
                        </div>
                    </Section>

                    {/* SUPPORT & RESISTANCE */}
                    <Section
                        id="sr-levels"
                        title="Support & Resistance"
                        icon={<HelpCircle className="w-6 h-6" />}
                        color="indigo"
                    >
                        <p className="text-gray-400 mb-6 leading-relaxed text-sm">
                            Sistem mengira paras harga psikologi di mana harga sering berpatah balik.
                        </p>
                        <div className="space-y-4">
                            <div className="p-4 bg-surfaceHighlight/30 rounded-xl border border-border">
                                <span className="text-white font-bold text-xs uppercase tracking-widest block mb-1">Strength: STRONG</span>
                                <p className="text-[11px] text-gray-500 leading-relaxed italic">
                                    Paras "Tembok Besar". Harga sukar pecah dalam sekali cuba. Gunakan sebagai TP atau Entry yang stabil.
                                </p>
                            </div>
                            <div className="p-4 bg-surfaceHighlight/30 rounded-xl border border-border">
                                <span className="text-gray-300 font-bold text-xs uppercase tracking-widest block mb-1">Strength: WEAK</span>
                                <p className="text-[11px] text-gray-500 leading-relaxed italic">
                                    Paras sementara. Harga boleh tembus dengan mudah jika terdapat volume.
                                </p>
                            </div>
                        </div>
                    </Section>
                </div>

                {/* Footer info */}
                <div className="mt-32 p-10 bg-primary/5 border border-primary/20 rounded-[2rem] text-center backdrop-blur-md">
                    <ShieldAlert className="w-10 h-10 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2 italic uppercase">Peringatan Penting</h3>
                    <p className="text-sm text-gray-400 max-w-lg mx-auto leading-relaxed">
                        Data ini adalah untuk membantu analisa anda. **Tiada jaminan 100% untung.** Gunakan teknik pengurusan modal (Position Sizing) yang bijak untuk menjaga modal anda.
                    </p>
                </div>
            </div>
        </div>
    );
};

const Section = ({ title, icon, color, children, id }) => (
    <div id={id} className="scroll-mt-24">
        <div className="flex items-center gap-4 mb-8">
            <div className={`p-3 rounded-2xl bg-${color}-500/10 text-${color}-500 shadow-lg shadow-${color}-500/5`}>
                {icon}
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{title}</h2>
        </div>
        <div className="bg-surface/50 border border-border p-8 rounded-3xl backdrop-blur-sm shadow-xl">
            {children}
        </div>
    </div>
);

export default HelpPage;
