const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const app = express();
const port = process.env.PORT || 3000;

async function fetchAlerts(retries = 3) {
    const timeout = 30000; // 30 seconds timeout
    
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get('https://api.weather.gov/alerts/active.atom', {
                headers: {
                    'User-Agent': '(WeatherAlertPlacefile, contact@example.com)',
                    'Accept': 'application/atom+xml'
                },
                timeout: timeout,
                validateStatus: status => status < 500 // Only retry on 5xx errors
            });
            return response.data;
        } catch (error) {
            if (i === retries - 1) {
                console.error('Error fetching alerts:', error.message);
                return null;
            }
            // Wait 2 seconds before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log(`Retrying request... (${i + 1}/${retries})`);
        }
    }
}

async function generatePlacefile(xmlData) {
    const parser = new xml2js.Parser();
    try {
        const result = await parser.parseStringPromise(xmlData);
        console.log('Number of entries:', result.feed?.entry?.length || 0);
        
        let placefile = 'Title: NWS Weather Alerts\n';
        placefile += 'Refresh: 2\n';
        placefile += 'Color: 255 0 0\n';

        if (result.feed && result.feed.entry) {
            for (const entry of result.feed.entry) {
                const polygon = entry['cap:polygon']?.[0];
                const point = entry['georss:point']?.[0] || entry['cap:point']?.[0];
                const title = entry.title[0].replace(/;/g, ',');

                if (polygon) {
                    // Handle polygon data
                    const points = polygon.split(' ');
                    const coordinates = [];
                    
                    // Convert points to coordinate pairs
                    for (let i = 0; i < points.length; i += 2) {
                        if (points[i] && points[i + 1]) {
                            coordinates.push([points[i], points[i + 1]]);
                        }
                    }

                    if (coordinates.length > 2) {
                        // Add the warning polygon
                        placefile += `Line: ${coordinates.map(([lat, lon]) => `${lat}, ${lon}`).join(', ')}\n`;
                        placefile += 'Line: 2, 0, 255, 0, 0\n';  // Red outline
                        placefile += 'Fill: 255, 0, 0, 128\n';   // Semi-transparent red fill
                        placefile += 'Threshold: 999\n\n';

                        // Add a label at the first point
                        placefile += `Object: ${coordinates[0][0]}/${coordinates[0][1]}\n`;
                        placefile += 'Threshold: 999\n';
                        placefile += 'Icon: 1\n';
                        placefile += `Text: ${title}\n\n`;
                    }
                } else if (point) {
                    // Fallback to point if no polygon exists
                    const [lat, lon] = point.split(' ');
                    placefile += `Object: ${lat}/${lon}\n`;
                    placefile += 'Threshold: 999\n';
                    placefile += 'Icon: 1\n';
                    placefile += `Text: ${title}\n\n`;
                }
            }
        }

        console.log('Generated placefile length:', placefile.length);
        return placefile;
    } catch (error) {
        console.error('Error parsing XML:', error);
        throw error;
    }
}

app.get('/alerts.txt', async (req, res) => {
    try {
        const xmlData = await fetchAlerts();
        if (!xmlData) {
            res.setHeader('Cache-Control', 'no-cache');
            return res.status(503).send('Error fetching weather alerts - service temporarily unavailable');
        }

        console.log('Received XML data length:', xmlData.length);
        const placefile = await generatePlacefile(xmlData);
        
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Cache-Control', 'public, max-age=120');
        res.send(placefile);
    } catch (error) {
        console.error('Error generating placefile:', error);
        res.status(500).send('Error generating placefile');
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
