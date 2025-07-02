<?php
header('Content-Type: text/plain');
header('Cache-Control: public, max-age=120');

function fetchAlerts() {
    $opts = [
        'http' => [
            'method' => 'GET',
            'header' => [
                'User-Agent: (WeatherAlertPlacefile, contact@example.com)',
                'Accept: application/atom+xml'
            ],
            'timeout' => 30
        ]
    ];
    $context = stream_context_create($opts);
    $response = @file_get_contents('https://api.weather.gov/alerts/active.atom', false, $context);
    
    if ($response === false) {
        return null;
    }
    
    return $response;
}

function generatePlacefile($xmlData) {
    $xml = simplexml_load_string($xmlData);
    if ($xml === false) {
        return "Error parsing XML";
    }

    $placefile = "Title: NWS Weather Alerts\n";
    $placefile .= "Refresh: 2\n";
    $placefile .= "Color: 255 0 0\n";
    $placefile .= "Font: 1, 11, 1, \"Arial\"\n\n";

    $xml->registerXPathNamespace('cap', 'urn:oasis:names:tc:emergency:cap:1.1');
    $xml->registerXPathNamespace('georss', 'http://www.georss.org/georss');

    foreach ($xml->entry as $entry) {
        $title = str_replace(';', ',', (string)$entry->title);
        $points = $entry->xpath('.//cap:point');
        
        if (empty($points)) {
            $points = $entry->xpath('.//georss:point');
        }

        if (!empty($points)) {
            foreach ($points as $point) {
                $coords = explode(' ', trim((string)$point));
                if (count($coords) == 2) {
                    $placefile .= "Object: {$coords[0]}/{$coords[1]}\n";
                    $placefile .= "Threshold: 999\n";
                    $placefile .= "Icon: 1\n";
                    $placefile .= "TextBackground: 200, 0, 0, 128\n";
                    $placefile .= "Text: $title\n\n";
                }
            }
        }
    }

    return $placefile;
}

$xmlData = fetchAlerts();
if ($xmlData === null) {
    http_response_code(503);
    echo "Error fetching weather alerts - service temporarily unavailable";
    exit;
}

echo generatePlacefile($xmlData);
