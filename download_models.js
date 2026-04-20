import fs from 'fs';
import path from 'path';
import https from 'https';

const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const TARGET_DIR = path.join(process.cwd(), 'public', 'models');

const manifests = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'face_landmark_68_model-weights_manifest.json',
  'face_recognition_model-weights_manifest.json'
];

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) return fetchJson(res.headers.location).then(resolve).catch(reject);
            if (res.statusCode !== 200) return reject(new Error(`Status ${res.statusCode} for ${url}`));
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(dest);
        const download = (targetUrl) => {
            https.get(targetUrl, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) return download(res.headers.location);
                if (res.statusCode !== 200) return reject(new Error(`Status ${res.statusCode} for ${targetUrl}`));
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve(fs.statSync(dest).size);
                });
            }).on('error', reject);
        };
        download(url);
    });
}

async function run() {
    console.log('Starting full multi-shard model download...');
    try {
        for (const manifest of manifests) {
            const manifestPath = path.join(TARGET_DIR, manifest);
            console.log(`\nProcessing ${manifest}...`);
            
            // 1. Download/Refresh manifest
            const data = await fetchJson(BASE_URL + manifest);
            fs.writeFileSync(manifestPath, JSON.stringify(data));
            console.log(`  ✅ Manifest updated`);

            // 2. Extract Shards
            const shards = data.flatMap(m => m.paths);
            console.log(`  Found shards: ${shards.join(', ')}`);

            for (const shard of shards) {
                const shardPath = path.join(TARGET_DIR, shard);
                const size = await downloadFile(BASE_URL + shard, shardPath);
                console.log(`  ✅ Downloaded shard: ${shard} (${size} bytes)`);
            }
        }
        console.log('\nAll models and shards downloaded successfully!');
    } catch (err) {
        console.error('\n❌ Fatal error:', err.message);
    }
}

run();
