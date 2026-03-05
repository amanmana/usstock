import fs from 'fs';
const envStr = fs.readFileSync('./.env', 'utf-8');
const env = {};
envStr.split('\n').filter(Boolean).forEach(l => {
    if (l.includes('=')) {
        const [k, ...v] = l.split('=');
        env[k.trim()] = v.join('=').trim().replace(/['"]/g, '');
    }
});
process.env.SUPABASE_URL = env.VITE_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const { handler } = await import('./netlify/functions/computeScreener.js');
async function run() {
    console.log("Triggering computeScreener...");
    const res = await handler({}, {});
    console.log(res);
}
run().catch(console.error);
