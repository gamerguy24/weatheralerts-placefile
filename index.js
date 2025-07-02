const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const app = express();
const port = process.env.PORT || 3000;

async function fetchAlerts() {
    try {
        const response = await axios.get('https://api.weather.gov/alerts/active.atom', {
            headers: {
                'User-Agent': '(WeatherAlertPlacefile, contact@example.com)'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching alerts:', error);
        return null;
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
        return res.status(500).send('Error fetching alerts');
    }

    const placefile = await generatePlacefile(xmlData);
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(placefile);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
