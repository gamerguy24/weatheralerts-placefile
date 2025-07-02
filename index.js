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
        placefile += 'Color: 255 0 0\n\n';

        if (result.feed && result.feed.entry) {
            for (const entry of result.feed.entry) {
                try {
                    const title = entry.title[0].replace(/;/g, ',');
                    const polygon = entry['cap:polygon']?.[0] || entry['georss:polygon']?.[0];
                    const point = entry['georss:point']?.[0] || entry['cap:point']?.[0];

                    console.log(`Processing alert: ${title}`);
                    console.log('Polygon data:', polygon);
                    console.log('Point data:', point);

                    if (polygon) {
                        const points = polygon.trim().split(/\s+/);
                        const coordinates = [];
                        
                        for (let i = 0; i < points.length; i += 2) {
                            if (points[i] && points[i + 1]) {
                                coordinates.push([
                                    parseFloat(points[i]).toFixed(4),
                                    parseFloat(points[i + 1]).toFixed(4)
                                ]);
                            }
                        }

                        if (coordinates.length > 2) {
                            // Close the polygon by adding the first point again
                            coordinates.push(coordinates[0]);
                            
                            // Add the warning polygon
                            placefile += `Line: ${coordinates.map(([lat, lon]) => `${lat}, ${lon}`).join(', ')}\n`;
                            placefile += 'Line: 2, 0, 255, 0, 0\n';
                            placefile += 'Fill: 255, 0, 0, 64\n';  // More transparent fill
                            placefile += 'Threshold: 999\n\n';

                            // Add centered label
                            const centerLat = coordinates.reduce((sum, [lat]) => sum + parseFloat(lat), 0) / coordinates.length;
                            const centerLon = coordinates.reduce((sum, [,lon]) => sum + parseFloat(lon), 0) / coordinates.length;
                            
                            placefile += `Object: ${centerLat}/${centerLon}\n`;
                            placefile += 'Threshold: 999\n';
                            placefile += 'Icon: 1\n';
                            placefile += `Text: ${title}\n\n`;
                        }
                    } else if (point) {
                        const [lat, lon] = point.split(' ').map(coord => parseFloat(coord).toFixed(4));
                        placefile += `Object: ${lat}/${lon}\n`;
                        placefile += 'Threshold: 999\n';
                        placefile += 'Icon: 1\n';
                        placefile += `Text: ${title}\n\n`;
                    }
                } catch (entryError) {
                    console.error('Error processing entry:', entryError);
                    continue;
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
