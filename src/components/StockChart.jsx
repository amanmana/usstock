import React, { useMemo } from 'react';

/**
 * Custom SVG Stock Chart
 * @param {Array} data - Array of { date, close, volume }
 */
const StockChart = ({ data }) => {
    if (!data || data.length < 2) return (
        <div className="h-48 flex items-center justify-center bg-surfaceHighlight/30 rounded-lg border border-border italic text-gray-500 text-xs">
            Data sejarah tidak mencukupi untuk carta.
        </div>
    );

    // Calculate MAs
    const dataWithMA = useMemo(() => {
        return data.map((d, i) => {
            const ma20 = i >= 19 ? data.slice(i - 19, i + 1).reduce((acc, curr) => acc + curr.close, 0) / 20 : null;
            const ma50 = i >= 49 ? data.slice(i - 49, i + 1).reduce((acc, curr) => acc + curr.close, 0) / 50 : null;
            return { ...d, ma20, ma50 };
        });
    }, [data]);

    // Scaling Logic
    const margin = { top: 10, right: 10, bottom: 20, left: 40 };
    const width = 400; // Aspect ratio base
    const height = 200;

    const prices = data.map(d => d.close);
    const minP = Math.min(...prices) * 0.98;
    const maxP = Math.max(...prices) * 1.02;
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

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Price History (100D)</h3>
                <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-0.5 bg-white"></span> <span className="text-gray-400">Price</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-0.5 bg-blue-500"></span> <span className="text-blue-500">MA20</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-0.5 bg-purple-500"></span> <span className="text-purple-500">MA50</span>
                    </div>
                </div>
            </div>

            <div className="relative bg-surfaceHighlight/20 rounded-lg border border-border p-2">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
                    {/* Grid Lines (simplified) */}
                    {[0, 0.5, 1].map(v => {
                        const y = margin.top + v * (height - margin.top - margin.bottom);
                        const priceLabel = maxP - v * range;
                        return (
                            <g key={v}>
                                <line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="currentColor" strokeWidth="1" strokeDasharray="2,4" className="text-border/40" />
                                <text x={margin.left - 5} y={y + 3} textAnchor="end" className="fill-gray-600 text-[10px] font-mono">{priceLabel.toFixed(2)}</text>
                            </g>
                        );
                    })}

                    {/* MA Lines */}
                    {ma50Path && <path d={ma50Path} fill="none" stroke="#A855F7" strokeWidth="1.5" strokeLinejoin="round" className="opacity-60" />}
                    {ma20Path && <path d={ma20Path} fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinejoin="round" className="opacity-80" />}

                    {/* Main Price Line */}
                    <path d={pricePath} fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />

                    {/* Shadow Area under price (gradient would be better but keeping it simple) */}
                    {/* No area for now to keep it clean */}
                </svg>
            </div>
        </div>
    );
};

export default StockChart;
