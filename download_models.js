import fs from 'fs';
import path from 'path';
import https from 'https';

const MODELS_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const TARGET_DIR = path.join(process.cwd(), 'public', 'models');

const files = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1'
];

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function downloadFile(fileUrl, dest) {
    return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(dest);
        
        const download = (url) => {
            https.get(url, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    return download(response.headers.location);
                }
                
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                    return;
                }

                response.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    const stats = fs.statSync(dest);
                    if (stats.size < 1000) {
                        reject(new Error(`File too small (${stats.size} bytes).`));
                    } else {
                        resolve();
                    }
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => {});
                reject(err);
            });
        };
        
        download(fileUrl);
    });
}

async function run() {
    console.log('Starting original repo model downloads...');
    for (const file of files) {
        const dest = path.join(TARGET_DIR, file);
        try {
            await downloadFile(MODELS_URL + file, dest);
            console.log(`✅ Downloaded: ${file} (${fs.statSync(dest).size} bytes)`);
        } catch (err) {
            console.error(`❌ Error downloading ${file}: ${err.message}`);
        }
    }
    console.log('Done.');
}

run();
