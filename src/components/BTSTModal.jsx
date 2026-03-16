import React, { useState } from 'react';
import { X, CheckCircle2, ShoppingCart, TrendingUp, AlertTriangle, ArrowRight, Zap, Target, BarChart3, Clock, DollarSign } from 'lucide-react';

const BTSTModal = ({ stock, isOwned, onClose }) => {
    const [isSaving, setIsSaving] = useState(false);

    if (!stock) return null;

    const handleMarkOwned = async () => {
        try {
            setIsSaving(true);
            const response = await fetch('/.netlify/functions/savePosition', {
                method: 'POST',
                body: JSON.stringify({
                    ticker: stock.ticker,
                    entryPrice: stock.close,
                    quantity: 0, // Simplified
                    type: 'BTST'
                })
            });
            if (response.ok) {
                onClose();
            }
        } catch (err) {
            alert('Ralat semasa menyimpan.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleMarkSold = async () => {
        try {
            setIsSaving(true);
            const response = await fetch('/.netlify/functions/removePosition', {
                method: 'POST',
                body: JSON.stringify({ ticker: stock.ticker })
            });
            if (response.ok) {
                onClose();
            }
        } catch (err) {
            alert('Ralat semasa membuang.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className={`
                relative w-full max-w-xl bg-[#0f0f12] border border-white/10 rounded-[32px] shadow-2xl overflow-hidden
                ${isOwned ? 'ring-1 ring-emerald-500/20 shadow-emerald-500/5' : 'ring-1 ring-indigo-500/20 shadow-indigo-500/5'}
            `}>
                {/* Header Section */}
                <div className={`p-8 pb-6 bg-gradient-to-b ${isOwned ? 'from-emerald-950/20' : 'from-indigo-950/20'} to-transparent`}>
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 ${isOwned ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'}`}>
                                    {isOwned ? <ShoppingCart className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                                    {isOwned ? 'Pegangan BTST' : 'Calon BTST'}
                                </div>
                                <div className="bg-white/5 text-gray-400 px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest border border-white/5">
                                    SCORE {stock.score}/9
                                </div>
                            </div>
                            <h2 className="text-3xl font-black tracking-tighter uppercase leading-tight">{stock.company}</h2>
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-1">{stock.ticker}</p>
                        </div>
                        <button 
                            onClick={onClose}
                            className="bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white p-3 rounded-2xl transition-all active:scale-90"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-6">
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                            <div className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                <DollarSign className="w-3 h-3" />
                                Harga
                            </div>
                            <div className="text-xl font-black tracking-tighter">RM {stock.close.toFixed(3)}</div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                            <div className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                <TrendingUp className="w-3 h-3" />
                                Perubahan
                            </div>
                            <div className={`text-xl font-black tracking-tighter ${stock.changePercent > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {stock.changePercent > 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                            <div className="text-gray-500 text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                <BarChart3 className="w-3 h-3" />
                                RVOL
                            </div>
                            <div className="text-xl font-black tracking-tighter">{stock.rvol}x</div>
                        </div>
                    </div>
                </div>

                <div className="p-8 pt-0 space-y-8">
                    {/* Why this stock? */}
                    <div>
                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <Target className="w-3.5 h-3.5" />
                            BTST Rationale
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {stock.reasons.map((reason, i) => (
                                <div key={i} className="flex items-center gap-2 bg-[#1a1a20] border border-white/10 px-4 py-2.5 rounded-2xl">
                                    <CheckCircle2 className={`w-4 h-4 ${isOwned ? 'text-emerald-500' : 'text-indigo-500'}`} />
                                    <span className="text-xs font-bold text-gray-300">{reason}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Action Guideline */}
                    <div className={`rounded-[24px] p-5 border ${isOwned ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-indigo-500/5 border-indigo-500/10'}`}>
                        <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl ${isOwned ? 'bg-emerald-500/20 text-emerald-500' : 'bg-indigo-500/20 text-indigo-500'}`}>
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <h5 className={`text-xs font-black uppercase tracking-widest mb-1 ${isOwned ? 'text-emerald-500' : 'text-indigo-500'}`}>
                                    {isOwned ? 'STRATEGI JUAL (MORNING)' : 'STRATEGI BELI (AFTERNOON)'}
                                </h5>
                                <p className="text-xs font-medium text-gray-400 leading-relaxed">
                                    {isOwned 
                                        ? 'Fokus untuk exit sebelum jam 10:30 AM esok pagi. Pantau opening gap dan kekuatan volume pagi.' 
                                        : 'Saham ini mempunyai momentum penutupan yang kuat. Masuk sebelum 4:55 PM untuk strategi Buy Today Sell Tomorrow.'
                                    }
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex gap-4 pt-4">
                        <button 
                            onClick={onClose}
                            className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-widest py-4 rounded-2xl transition-all border border-white/5 active:scale-95"
                        >
                            Batal
                        </button>
                        {isOwned ? (
                            <button 
                                onClick={handleMarkSold}
                                disabled={isSaving}
                                className="flex-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest py-4 px-8 rounded-2xl transition-all shadow-lg shadow-rose-900/20 active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? 'Menyimpan...' : 'Tandakan Jual'}
                            </button>
                        ) : (
                            <button 
                                onClick={handleMarkOwned}
                                disabled={isSaving}
                                className="flex-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest py-4 px-8 rounded-2xl transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? 'Menyimpan...' : (
                                    <>
                                        Tandakan Milik (Owned)
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BTSTModal;
