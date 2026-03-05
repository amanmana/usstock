
const desc = "MALAYSIA MARINE AND HEAVY ENG - (5186) (MHB)";
const descMatch = desc.match(/^(.+?)\s+-\s+\(([^)]+)\)\s+(?:\(([^)]+)\))?$/);
if (descMatch) {
    const [, rawName, parsedCode, shortName] = descMatch;
    const companyName = rawName.trim();
    const tickerCode = parsedCode.trim();
    const tickerShort = shortName?.trim() || tickerCode;
    const tickerFull = `${tickerShort}.KL`;

    const TICKER_OVERRIDES = {
        'MHB.KL': { tc: '5186', cn: 'MALAYSIA MARINE AND HEAVY ENG' },
        'KSL.KL': { tc: '5038', cn: 'KSL HOLDINGS BHD' }
    };

    const finalTickerCode = TICKER_OVERRIDES[tickerFull]?.tc || tickerCode;
    const finalCompanyName = TICKER_OVERRIDES[tickerFull]?.cn || companyName;

    console.log({
        tickerFull,
        tickerShort,
        tickerCode,
        finalTickerCode,
        finalCompanyName
    });
} else {
    console.log("No match");
}
