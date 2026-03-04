import axios from 'axios';

/**
 * Fetch SPUS ETF holdings from Yahoo Finance.
 * SPUS = SP Funds S&P 500 Sharia Industry Exclusions ETF
 * Falls back to a hardcoded list of well-known Shariah S&P 500 components.
 */
export const handler = async () => {
    try {
        // Try to fetch SPUS holdings from Yahoo Finance
        let holdings = [];
        try {
            const url = 'https://query1.finance.yahoo.com/v1/finance/quoteType/SPUS?formatted=false&lang=en-US&region=US';
            // Actually fetch top holdings via ETF profile
            const holdingsUrl = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary/SPUS?modules=topHoldings';
            const { data } = await axios.get(holdingsUrl, {
                timeout: 8000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const topHoldings = data?.quoteSummary?.result?.[0]?.topHoldings?.holdings || [];
            if (topHoldings.length > 0) {
                holdings = topHoldings.map(h => ({
                    symbol: h.symbol,
                    name: h.holdingName || h.symbol
                }));
            }
        } catch (e) {
            console.log('Yahoo ETF holdings fetch failed, using whitelist fallback');
        }

        // Fallback: Comprehensive Shariah whitelist (SPUS-aligned)
        if (holdings.length === 0) {
            holdings = [
                // Technology
                { symbol: 'AAPL', name: 'Apple Inc.' },
                { symbol: 'MSFT', name: 'Microsoft Corporation' },
                { symbol: 'NVDA', name: 'NVIDIA Corporation' },
                { symbol: 'GOOGL', name: 'Alphabet Inc. (Class A)' },
                { symbol: 'GOOG', name: 'Alphabet Inc. (Class C)' },
                { symbol: 'AVGO', name: 'Broadcom Inc.' },
                { symbol: 'META', name: 'Meta Platforms Inc.' },
                { symbol: 'TSLA', name: 'Tesla Inc.' },
                { symbol: 'AMZN', name: 'Amazon.com Inc.' },
                { symbol: 'ADBE', name: 'Adobe Inc.' },
                { symbol: 'CRM', name: 'Salesforce Inc.' },
                { symbol: 'AMD', name: 'Advanced Micro Devices' },
                { symbol: 'TXN', name: 'Texas Instruments' },
                { symbol: 'CSCO', name: 'Cisco Systems' },
                { symbol: 'ORCL', name: 'Oracle Corporation' },
                { symbol: 'NFLX', name: 'Netflix Inc.' },
                { symbol: 'QCOM', name: 'Qualcomm Inc.' },
                { symbol: 'INTC', name: 'Intel Corporation' },
                { symbol: 'MU', name: 'Micron Technology' },
                { symbol: 'AMAT', name: 'Applied Materials' },
                { symbol: 'LRCX', name: 'Lam Research' },
                { symbol: 'ADI', name: 'Analog Devices' },
                { symbol: 'PANW', name: 'Palo Alto Networks' },
                { symbol: 'SNPS', name: 'Synopsys Inc.' },
                { symbol: 'CDNS', name: 'Cadence Design Systems' },
                { symbol: 'KLAC', name: 'KLA Corporation' },
                { symbol: 'NOW', name: 'ServiceNow Inc.' },
                { symbol: 'WDAY', name: 'Workday Inc.' },
                { symbol: 'CRWD', name: 'CrowdStrike Holdings' },
                { symbol: 'DDOG', name: 'Datadog Inc.' },
                { symbol: 'NET', name: 'Cloudflare Inc.' },
                { symbol: 'ZS', name: 'Zscaler Inc.' },
                { symbol: 'OKTA', name: 'Okta Inc.' },
                { symbol: 'MDB', name: 'MongoDB Inc.' },
                { symbol: 'TEAM', name: 'Atlassian Corporation' },
                { symbol: 'ANET', name: 'Arista Networks' },
                { symbol: 'MCHP', name: 'Microchip Technology' },
                { symbol: 'ON', name: 'ON Semiconductor' },
                { symbol: 'STX', name: 'Seagate Technology' },
                { symbol: 'WDC', name: 'Western Digital' },
                // Health Care
                { symbol: 'LLY', name: 'Eli Lilly and Company' },
                { symbol: 'JNJ', name: 'Johnson & Johnson' },
                { symbol: 'MRK', name: 'Merck & Co.' },
                { symbol: 'PFE', name: 'Pfizer Inc.' },
                { symbol: 'ABBV', name: 'AbbVie Inc.' },
                { symbol: 'ABT', name: 'Abbott Laboratories' },
                { symbol: 'TMO', name: 'Thermo Fisher Scientific' },
                { symbol: 'DHR', name: 'Danaher Corporation' },
                { symbol: 'AMGN', name: 'Amgen Inc.' },
                { symbol: 'ISRG', name: 'Intuitive Surgical' },
                { symbol: 'VRTX', name: 'Vertex Pharmaceuticals' },
                { symbol: 'REGN', name: 'Regeneron Pharmaceuticals' },
                { symbol: 'GILD', name: 'Gilead Sciences' },
                { symbol: 'ZTS', name: 'Zoetis Inc.' },
                { symbol: 'BSX', name: 'Boston Scientific' },
                { symbol: 'SYK', name: 'Stryker Corporation' },
                { symbol: 'EW', name: 'Edwards Lifesciences' },
                { symbol: 'IDXX', name: 'IDEXX Laboratories' },
                { symbol: 'A', name: 'Agilent Technologies' },
                // Energy
                { symbol: 'XOM', name: 'Exxon Mobil Corporation' },
                { symbol: 'CVX', name: 'Chevron Corporation' },
                { symbol: 'COP', name: 'ConocoPhillips' },
                { symbol: 'EOG', name: 'EOG Resources' },
                { symbol: 'SLB', name: 'SLB (Schlumberger)' },
                { symbol: 'MPC', name: 'Marathon Petroleum' },
                { symbol: 'VLO', name: 'Valero Energy' },
                { symbol: 'PSX', name: 'Phillips 66' },
                { symbol: 'OXY', name: 'Occidental Petroleum' },
                { symbol: 'HAL', name: 'Halliburton Company' },
                { symbol: 'DVN', name: 'Devon Energy' },
                { symbol: 'HES', name: 'Hess Corporation' },
                { symbol: 'MRO', name: 'Marathon Oil' },
                // Industrials
                { symbol: 'CAT', name: 'Caterpillar Inc.' },
                { symbol: 'HON', name: 'Honeywell International' },
                { symbol: 'GE', name: 'GE Aerospace' },
                { symbol: 'DE', name: 'Deere & Company' },
                { symbol: 'LMT', name: 'Lockheed Martin' },
                { symbol: 'RTX', name: 'RTX Corporation' },
                { symbol: 'MMM', name: '3M Company' },
                { symbol: 'FAST', name: 'Fastenal Company' },
                { symbol: 'UPS', name: 'United Parcel Service' },
                { symbol: 'FDX', name: 'FedEx Corporation' },
                { symbol: 'CSX', name: 'CSX Corporation' },
                { symbol: 'NSC', name: 'Norfolk Southern' },
                { symbol: 'UNP', name: 'Union Pacific Corporation' },
                { symbol: 'ETN', name: 'Eaton Corporation' },
                { symbol: 'EMR', name: 'Emerson Electric' },
                { symbol: 'ITW', name: 'Illinois Tool Works' },
                { symbol: 'PH', name: 'Parker Hannifin' },
                { symbol: 'PCAR', name: 'PACCAR Inc.' },
                { symbol: 'TDG', name: 'TransDigm Group' },
                // Materials
                { symbol: 'LIN', name: 'Linde plc' },
                { symbol: 'APD', name: 'Air Products and Chemicals' },
                { symbol: 'SHW', name: 'Sherwin-Williams' },
                { symbol: 'ECL', name: 'Ecolab Inc.' },
                { symbol: 'NEM', name: 'Newmont Corporation' },
                { symbol: 'FCX', name: 'Freeport-McMoRan' },
                { symbol: 'ALB', name: 'Albemarle Corporation' },
                { symbol: 'MLM', name: 'Martin Marietta Materials' },
                { symbol: 'VMC', name: 'Vulcan Materials' },
                { symbol: 'NUE', name: 'Nucor Corporation' },
                // Consumer
                { symbol: 'NKE', name: 'Nike Inc.' },
                { symbol: 'AMZN', name: 'Amazon.com Inc.' },
                { symbol: 'TJX', name: 'TJX Companies' },
                { symbol: 'LULU', name: 'Lululemon Athletica' },
                { symbol: 'LOW', name: 'Lowe\'s Companies' },
                { symbol: 'HD', name: 'Home Depot' },
                { symbol: 'ORLY', name: 'O\'Reilly Automotive' },
                { symbol: 'AZO', name: 'AutoZone Inc.' },
                // Shariah ETFs
                { symbol: 'SPUS', name: 'SP Funds S&P 500 Sharia ETF' },
                { symbol: 'HLAL', name: 'Wahed FTSE USA Shariah ETF' },
                { symbol: 'SPRE', name: 'SP Funds S&P Global REIT Sharia ETF' },
            ];
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, holdings, source: holdings.length > 0 ? 'yahoo' : 'whitelist' })
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
