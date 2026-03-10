import React, { useMemo } from 'react';

/**
 * Custom SVG Stock Chart with Trade Plan Overlays
 * @param {Array} data - Array of { date, close, volume }
 * @param {Object} plan - Trade plan object with levels { trade: { tp1, stopLoss, trailingStop } }
 * @param {Boolean} showLines - Whether to show TP/SL/TS lines
 * @param {String} title - Custom title for the card
 */
const StockChart = ({ data, plan, showLines = false, title = "Price History (100D)" }) => {
    if (!data || data.length < 2) return (
        <div className="h-48 flex items-center justify-center bg-surfaceHighlight/30 rounded-lg border border-border italic text-gray-500 text-xs">
            Data sejarah tidak mencukupi untuk carta.
        </div>
    );

    // Calculate MAs (only for Daily view typically)
    const dataWithMA = useMemo(() => {
        return data.map((d, i) => {
            const ma20 = i >= 19 ? data.slice(i - 19, i + 1).reduce((acc, curr) => acc + curr.close, 0) / 20 : null;
            const ma50 = i >= 49 ? data.slice(i - 49, i + 1).reduce((acc, curr) => acc + curr.close, 0) / 50 : null;
            return { ...d, ma20, ma50 };
        });
    }, [data]);

    // Scaling Logic
    const margin = { top: 20, right: 60, bottom: 20, left: 40 };
    const width = 400; // Aspect ratio base
    const height = 200;

    const prices = data.map(d => d.close);

    // Include plan levels in scaling if showLines is on
    const levels = [];
    if (showLines && plan?.trade) {
        if (plan.trade.tp1) levels.push(plan.trade.tp1);
        if (plan.trade.stopLoss) levels.push(plan.trade.stopLoss);
        if (plan.trade.trailingStop) levels.push(plan.trade.trailingStop);
        if (plan.trade.queuePrice) levels.push(plan.trade.queuePrice);
    }

    const allYValues = [...prices, ...levels];
    const minP = Math.min(...allYValues) * 0.98;
    const maxP = Math.max(...allYValues) * 1.02;
    const range = maxP - minP;

    const getX = (i) => margin.left + (i / (data.length - 1)) * (width - margin.left - margin.right);
    const getY = (val) => margin.top + (1 - (val - minP) / range) * (height - margin.top - margin.bottom);

    // Build paths
    const pricePath = dataWithMA.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.close)}`).join(' ');
    const ma20Path = dataWithMA
        .filter(d => d.ma20 !== null)
        .map((d, i, arr) => `${i === 0 ? 'M' : 'L'} ${getX(data.length - arr.length + i)} ${getY(d.ma20)}`)
        .join(' ');
    const ma50Path = dataWithMA
        .filter(d => d.ma50 !== null)
        .map((d, i, arr) => `${i === 0 ? 'M' : 'L'} ${getX(data.length - arr.length + i)} ${getY(d.ma50)}`)
        .join(' ');

    const tradeLevels = [
        { label: 'TP', value: plan?.trade?.tp1, color: '#10b981', dash: '3,3' },
        { label: 'RR 2.0', value: plan?.trade?.queuePrice, color: '#60a5fa', dash: '4,4' },
        { label: 'SL', value: plan?.trade?.stopLoss, color: '#ef4444', dash: '2,2' },
        { label: 'TS', value: plan?.trade?.trailingStop, color: '#6366f1', dash: '3,3' }
    ].filter(l => l.value);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{title}</h3>
                <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-wider">
                    {!showLines && (
                        <>
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-0.5 bg-white"></span> <span className="text-gray-400">Price</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-0.5 bg-blue-500"></span> <span className="text-blue-500">MA20</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-0.5 bg-purple-500"></span> <span className="text-purple-500">MA50</span>
                            </div>
                        </>
                    )}
                    {showLines && (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-0.5">
                                <span className="text-emerald-400">TP</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                                <span className="text-blue-400">RR</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                                <span className="text-red-400">SL</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                                <span className="text-indigo-400">TS</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="relative bg-surfaceHighlight/20 rounded-lg border border-border p-2 overflow-hidden">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
                    {/* Grid Lines */}
                    {[0, 0.5, 1].map(v => {
                        const y = margin.top + v * (height - margin.top - margin.bottom);
                        const priceLabel = maxP - v * range;
                        return (
                            <g key={v}>
                                <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,4" className="text-border/20" />
                                <text x={margin.left - 5} y={y + 3} textAnchor="end" className="fill-gray-600 text-[8px] font-mono">{priceLabel.toFixed(2)}</text>
                            </g>
                        );
                    })}

                    {/* Trade Plan Lines (Bottom Layer) */}
                    {showLines && tradeLevels.map((lvl, idx) => {
                        const y = getY(lvl.value);
                        return (
                            <g key={idx}>
                                <line
                                    x1={margin.left}
                                    y1={y}
                                    x2={width - margin.right}
                                    y2={y}
                                    stroke={lvl.color}
                                    strokeWidth="1"
                                    strokeDasharray={lvl.dash}
                                    className="opacity-60"
                                />
                                <rect
                                    x={width - margin.right + 2}
                                    y={y - 6}
                                    width="35"
                                    height="12"
                                    rx="2"
                                    fill={lvl.color}
                                    className="opacity-20"
                                />
                                <text
                                    x={width - margin.right + 4}
                                    y={y + 3}
                                    className="text-[7px] font-black"
                                    fill={lvl.color}
                                >
                                    {lvl.label} {lvl.value.toFixed(2)}
                                </text>
                            </g>
                        );
                    })}

                    {/* MA Lines */}
                    {!showLines && ma50Path && <path d={ma50Path} fill="none" stroke="#A855F7" strokeWidth="1" strokeLinejoin="round" className="opacity-40" />}
                    {!showLines && ma20Path && <path d={ma20Path} fill="none" stroke="#3B82F6" strokeWidth="1" strokeLinejoin="round" className="opacity-60" />}

                    {/* Main Price Line */}
                    <path d={pricePath} fill="none" stroke="white" strokeWidth="1.5" strokeLinejoin="round" className="opacity-90" />

                    {/* X-Axis Labels (Time/Date) */}
                    {(() => {
                        const first = data[0];
                        const last = data[data.length - 1];
                        const midIdx = Math.floor(data.length / 2);
                        const mid = data[midIdx];

                        const formatDate = (item) => {
                            if (!item) return "";
                            const d = new Date(item.date || item.timestamp * 1000);
                            if (isNaN(d.getTime())) return "";

                            // Check if it's intraday data (typically has timestamps or same-day dates)
                            const isIntraday = !!item.timestamp;

                            if (isIntraday) {
                                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                            }
                            return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
                        };

                        return (
                            <g className="fill-gray-500 text-[7px] font-bold uppercase tracking-tighter">
                                <text x={margin.left} y={height - 2} textAnchor="start">{formatDate(first)}</text>
                                <text x={margin.left + (width - margin.left - margin.right) / 2} y={height - 2} textAnchor="middle">{formatDate(mid)}</text>
                                <text x={width - margin.right} y={height - 2} textAnchor="end">{formatDate(last)}</text>
                            </g>
                        );
                    })()}
                </svg>
            </div>
        </div>
    );
};

export default StockChart;
