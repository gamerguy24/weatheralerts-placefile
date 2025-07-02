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
    const parser = new xml2js.Parser({
        explicitArray: true,
        mergeAttrs: false,
        xmlns: true,
        trim: true
    });
    try {
        const result = await parser.parseStringPromise(xmlData);
        console.log('Number of entries:', result.feed?.entry?.length || 0);
        
        let placefile = 'Title: NWS Weather Alerts\n';
        placefile += 'Refresh: 2\n';
        placefile += 'Color: 255 0 0\n';
        placefile += 'Font: 1, 11, 1, "Arial"\n\n';

        if (result.feed && result.feed.entry) {
            for (const entry of result.feed.entry) {
                try {
                    // Debug log the entry structure
                    console.log('Processing entry:', JSON.stringify(entry['title'], null, 2));
                    
                    // Safely get the title
                    const title = entry.title?.[0]?._?.toString() || 
                                entry.title?.[0]?.toString() || 
                                'Unknown Alert';
                    const safeTitle = title.replace(/[;]/g, ',');
                    
                    let polygon = entry['cap:polygon']?.[0] || entry['georss:polygon']?.[0];
                    
                    if (polygon) {
                        const points = polygon.trim().split(/\s+/);
                        const coordinates = [];
                        
                        for (let i = 0; i < points.length; i += 2) {
                            if (points[i] && points[i + 1]) {
                                coordinates.push([points[i], points[i + 1]]);
                            }
                        }

                        if (coordinates.length > 2) {
                            // Close the polygon
                            if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
                                coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
                                coordinates.push(coordinates[0]);
                            }
                            
                            // Add polygon
                            placefile += `Line: ${coordinates.map(([lat, lon]) => `${lat}, ${lon}`).join(', ')}\n`;
                            placefile += 'Line: 3, 0, 255, 0, 0\n';
                            placefile += 'Fill: 255, 0, 0, 32\n';
                            placefile += 'Threshold: 999\n\n';

                            // Add label
                            const centerLat = coordinates.reduce((sum, [lat]) => sum + parseFloat(lat), 0) / coordinates.length;
                            const centerLon = coordinates.reduce((sum, [,lon]) => sum + parseFloat(lon), 0) / coordinates.length;
                            
                            placefile += `Object: ${centerLat}/${centerLon}\n`;
                            placefile += 'Threshold: 999\n';
                            placefile += 'Icon: 1\n';
                            placefile += `TextBackground: 200, 0, 0, 128\n`;
                            placefile += `Text: ${safeTitle}\n\n`;
                        }
                    }
                } catch (entryError) {
                    console.error('Error processing entry:', entryError);
                    continue;
                }
            }
        }

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
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please try a different port.`);
        process.exit(1);
    } else {
        console.error('Server error:', err);
    }
});
