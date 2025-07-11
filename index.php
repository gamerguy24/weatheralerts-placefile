<?php
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html>
<head>
    <title>Weather Alerts Placefile</title>
    <style>
        body { 
            font-family: Arial, sans-serif;
            margin: 20px;
            background: #f0f0f0;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 { color: #d32f2f; }
        .alert {
            padding: 10px;
            background: #ffebee;
            border-left: 4px solid #d32f2f;
            margin: 10px 0;
        }
        code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>NWS Weather Alerts Placefile</h1>
        <div class="alert">
            <h3>GRLevel3 Placefile URL:</h3>
            <code><?php echo $_SERVER['REQUEST_SCHEME'] . '://' . $_SERVER['HTTP_HOST']; ?>/alerts.php</code>
        </div>
        <div>
            <h3>Instructions:</h3>
            <ol>
                <li>Open GRLevel3</li>
                <li>Go to Views > Overlays</li>
                <li>Click Add</li>
                <li>Enter the URL above</li>
                <li>Click OK</li>
            </ol>
        </div>
        <div>
            <h3>Features:</h3>
            <ul>
                <li>Real-time NWS weather alerts</li>
                <li>Auto-updates every 2 minutes</li>
                <li>Alert icons at warning locations</li>
                <li>Alert text and descriptions</li>
            </ul>
        </div>
    </div>
</body>
</html>
