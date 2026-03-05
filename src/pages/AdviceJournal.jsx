import React from 'react';
import {
    ArrowLeft,
    Book,
    ShieldCheck,
    TrendingUp,
    Zap,
    Scale,
    Layers,
    History,
    ChevronRight,
    Award
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdviceJournal = () => {
    const navigate = useNavigate();

    const sections = [
        {
            id: 'survival',
            title: 'Pengurusan Modal',
            subtitle: 'Survival First',
            icon: <ShieldCheck className="w-5 h-5" />,
            color: 'emerald',
            content: [
                'Falsafah: "Untung itu penting, tetapi menjaga modal (survival) adalah jauh lebih utama dalam jangka panjang."',
                'Max Risk: Sentiasa tentukan berapa modal (RM/USD) yang anda sanggup rugi sebelum masuk satu trade. Pasaran boleh jadi gila, tapi risiko anda mesti terkawal.'
            ]
        },
        {
            id: 'rebound',
            title: 'Strategi Rebound',
            subtitle: 'Buy Low, Sell High',
            icon: <Zap className="w-5 h-5" />,
            color: 'blue',
            content: [
                'Skor Rebound: Cari 7.0 ke atas. Ini bermakna saham sudah "sejuk" dan sedia untuk melantun (pullback sihat).',
                'RSI: Pastikan antara 35-45. Elakkan RSI bawah 25 (saham sedang "freefall") kecuali anda sangat mahir.',
                'Timing: Set Buy Limit pada harga Support untuk risiko terendah.'
            ]
        },
        {
            id: 'momentum',
            title: 'Strategi Momentum',
            subtitle: 'Buy High, Sell Higher',
            icon: <TrendingUp className="w-5 h-5" />,
            color: 'orange',
            content: [
                'Skor Momentum: Cari 8.0 ke atas. Ini adalah saham yang paling "hot" di pasaran.',
                'Volume: Pastikan volume harian melebihi 2x ganda purata volume (Avg Vol). Ini bukti kehadiran "Shark".',
                'Breakout: Masuk bila harga pecah Resistance 1 (R1) dengan volume tinggi.'
            ]
        },
        {
            id: 'alignment',
            title: 'Trend Confirmation',
            subtitle: '3-Dot Alignment',
            icon: <Layers className="w-5 h-5" />,
            color: 'purple',
            content: [
                'Weekly (Gajah): Arah aliran besar mingguan. Mesti Hijau untuk ketenangan.',
                'Daily (Harimau): Trend utama harian. Menentukan arah harga jangka pendek.',
                '15M (Kancil): Timing kemasukan. Guna untuk cari "dip" atau breakout pantas.',
                'Tip: Peluang paling "solid" adalah bila anda nampak 3/3 Hijau.'
            ]
        },
        {
            id: 'exit-strategy',
            title: 'Exit & TP Dilema',
            subtitle: 'Mastering the Sell',
            icon: <Scale className="w-5 h-5" />,
            color: 'red',
            content: [
                'Level Sistem vs Peribadi: Level sistem adalah psikologi pasaran, My Plan adalah keselamatan akaun anda. Utamakan pelan sendiri.',
                'Strategi 50/50: Jika sampai TP tapi sistem masih HOLD, jual 50% untuk kunci profit, baki 50% "ride" dengan Trailing Stop.'
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-[#0a0a0c] text-text-primary font-sans p-6 md:p-12 pb-32">
            <div className="max-w-4xl mx-auto">
                {/* Back Button */}
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-12 group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Kembali ke Dashboard
                </button>

                {/* Header Section */}
                <div className="relative mb-20">
                    <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/10 blur-[100px] rounded-full pointer-events-none"></div>
                    <div className="flex items-center gap-6 mb-6">
                        <div className="p-4 bg-gradient-to-br from-primary/30 to-primary/5 rounded-[2rem] border border-primary/20 shadow-2xl shadow-primary/10">
                            <Book className="w-10 h-10 text-primary" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black tracking-[0.3em] text-primary uppercase">Elite Trading Journal</span>
                                <Award className="w-3 h-3 text-primary" />
                            </div>
                            <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white uppercase italic leading-none">
                                Buku <span className="text-primary italic">Strategi</span>
                            </h1>
                        </div>
                    </div>
                    <p className="text-lg text-gray-400 max-w-2xl leading-relaxed italic border-l-2 border-primary/30 pl-6 py-2">
                        "Setiap entry adalah perniagaan. Setiap exit adalah keputusan. Setiap jurnal adalah kebijaksanaan."
                    </p>
                </div>

                {/* Journal Content */}
                <div className="space-y-12">
                    {sections.map((section, idx) => (
                        <div key={section.id} className="relative group animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ animationDelay: `${idx * 150}ms` }}>
                            <div className="flex items-start gap-6">
                                {/* Timeline UI */}
                                <div className="hidden md:flex flex-col items-center pt-2">
                                    <div className={`w-10 h-10 rounded-full bg-${section.color}-500/10 border border-${section.color}-500/30 flex items-center justify-center text-${section.color}-400 shadow-lg shadow-${section.color}-500/5`}>
                                        {section.icon}
                                    </div>
                                    <div className="w-px h-full bg-gradient-to-b from-gray-800 to-transparent min-h-[100px] mt-4 opacity-30"></div>
                                </div>

                                {/* Card Content */}
                                <div className="flex-1">
                                    <div className="mb-4">
                                        <h3 className="text-xl font-black text-white uppercase tracking-tight mb-1 group-hover:text-primary transition-colors">
                                            {section.title}
                                        </h3>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{section.subtitle}</p>
                                    </div>

                                    <div className="bg-surface/40 hover:bg-surface/60 border border-white/5 p-8 rounded-3xl backdrop-blur-md transition-all duration-500 hover:border-primary/20 hover:translate-x-1 group-hover:shadow-[20px_20px_60px_-15px_rgba(0,0,0,0.5)]">
                                        <ul className="space-y-6">
                                            {section.content.map((item, i) => (
                                                <li key={i} className="flex gap-4 group/item">
                                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0 group-hover/item:scale-150 group-hover/item:bg-primary transition-all"></div>
                                                    <p className="text-gray-300 leading-relaxed font-medium">
                                                        {item.split(':').map((part, pidx) => (
                                                            pidx === 0 ? <span key={pidx} className="text-white font-bold block mb-1 uppercase text-xs tracking-wide">{part}</span> : <span key={pidx} className="opacity-80">{part}</span>
                                                        ))}
                                                    </p>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* End of Scroll Note */}
                <div className="mt-32 text-center relative">
                    <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full scale-50 opacity-50"></div>
                    <History className="w-12 h-12 text-gray-800 mx-auto mb-6" />
                    <h4 className="text-xl font-black text-white uppercase italic tracking-tighter mb-4">Hidup Bersama Pasaran</h4>
                    <p className="text-sm text-gray-500 max-w-lg mx-auto leading-relaxed">
                        Dokumen ini akan terus dikemaskini mengikut peredaran masa dan kebijaksanaan yang kita lalui bersama. Kekal berdisiplin.
                    </p>
                    <div className="mt-10 flex items-center justify-center gap-2 text-primary font-bold text-[10px] tracking-widest uppercase">
                        <span className="h-px w-12 bg-primary/20"></span>
                        Trusted by amanmana
                        <span className="h-px w-12 bg-primary/20"></span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdviceJournal;
