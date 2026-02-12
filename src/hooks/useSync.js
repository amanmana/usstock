import { useState, useCallback } from 'react';
import axios from 'axios';

// API Endpoints
const API_URL = '/.netlify/functions';

export function useSync() {
    const [status, setStatus] = useState('idle'); // 'idle', 'running', 'computing', 'complete', 'error'
    const [progress, setProgress] = useState(0); // Scraped count
    const [total, setTotal] = useState(0);
    const [messages, setMessages] = useState([]);

    const log = (msg) => setMessages(prev => [...prev.slice(-4), msg]);

    const startSync = async () => {
        try {
            if (status === 'running') return;

            setStatus('running');
            setProgress(0);
            setMessages([]);
            log('Starting Sync Job...');

            // 1. Start Job
            const { data: job } = await axios.post(`${API_URL}/syncStart`);

            if (job.status === 'exists') {
                log('Job already exists, resuming...');
                // Optional: handle resume logic via syncStatus check
            }

            const jobId = job.jobId;
            const totalTickers = job.total || 300;
            setTotal(totalTickers);

            // 2. Loop batches
            let processed = job.processed_count || 0;
            const BATCH_SIZE = 25; // As per requirement
            // Need to handle resuming correctly if job existed

            // If job existed, check status first
            if (job.status === 'exists') {
                const { data: statusData } = await axios.get(`${API_URL}/syncStatus?jobId=${jobId}`);
                processed = statusData.processed_count || 0;
                // If done, just skip to compute
                if (statusData.status === 'done') {
                    log('Sync already done. Running compute...');
                    setStatus('computing');
                    await runCompute();
                    setStatus('complete');
                    return;
                }
            }

            while (processed < totalTickers) {
                log(`Syncing batch from offset ${processed}...`);

                try {
                    const { data: batchRes } = await axios.post(`${API_URL}/syncBatch`, {
                        jobId,
                        offset: processed,
                        limit: BATCH_SIZE
                    });

                    if (batchRes.status === 'complete' || (batchRes.processed === 0 && processed > 0)) {
                        break; // Done
                    }

                    const batchCount = batchRes.processed || 0;
                    processed += batchCount;
                    setProgress(processed);

                    // Small delay to be polite
                    await new Promise(r => setTimeout(r, 500));

                } catch (err) {
                    log(`Batch failed: ${err.message}. Retrying...`);
                    await new Promise(r => setTimeout(r, 2000));
                    // Retry loop or abort? For now retry indef.
                }
            }

            log('Scraping complete. Computing...');
            setStatus('computing');

            // 3. Compute Screener
            await runCompute();

            setStatus('complete');
            log('Sync Complete!');

        } catch (err) {
            console.error(err);
            setStatus('error');
            log(`Error: ${err.message || 'Unknown error'}`);
        }
    };

    const runCompute = async () => {
        try {
            const { data } = await axios.post(`${API_URL}/computeScreener`);
            log(`Computed ${data.count} results.`);
        } catch (err) {
            throw new Error('Compute failed: ' + err.message);
        }
    };

    return { startSync, status, progress, total, messages };
}
