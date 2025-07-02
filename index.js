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
    const result = await parser.parseStringPromise(xmlData);
    
    let placefile = 'Title: NWS Weather Alerts\n';
    placefile += 'Refresh: 5\n';
    placefile += 'Color: 255 255 255\n\n';

    if (result.feed && result.feed.entry) {
        for (const entry of result.feed.entry) {
            if (entry['cap:point']) {
                const coordinates = entry['cap:point'][0].split(' ');
                const lat = coordinates[0];
                const lon = coordinates[1];
                const title = entry.title[0].replace(/;/g, ',');

                placefile += `Object: ${lat}/${lon}\n`;
                placefile += 'Threshold: 999\n';
                placefile += 'Icon: 1\n';
                placefile += `Text: ${title}\n\n`;
            }
        }
    }

    return placefile;
}

app.get('/alerts.txt', async (req, res) => {
    const xmlData = await fetchAlerts();
    if (!xmlData) {
        res.setHeader('Cache-Control', 'no-cache');
        return res.status(503).send('Error fetching weather alerts - service temporarily unavailable');
    }

    const placefile = await generatePlacefile(xmlData);
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(placefile);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
