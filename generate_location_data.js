import fs from 'fs';
import path from 'path';

const dataDir = './src/data';
const countriesPath = path.join(dataDir, 'countries.json');
const indiaPath = path.join(dataDir, 'india_districts.json');
const outputPath = path.join(dataDir, 'locationData.js');

try {
    const countriesRaw = JSON.parse(fs.readFileSync(countriesPath, 'utf8'));
    const indiaRaw = JSON.parse(fs.readFileSync(indiaPath, 'utf8'));

    // Process Indian states and districts into a simpler map
    const indiaDistMap = {};
    indiaRaw.states.forEach(s => {
        indiaDistMap[s.state] = s.districts;
    });

    // Process countries: we only need name and states (name part)
    const countriesProcessed = countriesRaw.map(c => ({
        name: c.name,
        states: c.states.map(s => s.name)
    }));

    const content = `// Generated Location Data
export const countries = ${JSON.stringify(countriesProcessed, null, 2)};

export const indiaDistricts = ${JSON.stringify(indiaDistMap, null, 2)};
`;

    fs.writeFileSync(outputPath, content);
    console.log("locationData.js generated successfully!");

} catch (err) {
    console.error("Error generating locationData.js:", err.message);
}
