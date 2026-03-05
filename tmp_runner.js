import fs from 'fs';

const env = fs.readFileSync('./.env', 'utf-8');
env.split('\n').forEach(line => {
    if (line && line.includes('=')) {
        const [key, ...rest] = line.split('=');
        process.env[key.trim()] = rest.join('=').trim();
    }
});

import('./tmp_trigger.js');
