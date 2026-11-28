# Trainer architecture

- Trainer Android sessions own BLE, control acknowledgements, timers and local recovery in a connectedDevice foreground service; the WebView only renders/persists confirmed results, because screen wake locks and notifications alone cannot sustain locked-screen collection.
- Trainer rows remain a single Cykeltrainer cardio entry classified as cycling; save through the existing completion writer and compact WorkoutSeries, never duplicate a Cykling row or mix indoor speed records with outdoor records.
- FTMS targets require advertised capabilities and device ranges; await Control Point indications, bound HR adjustments and lower power on missing HR/cadence, because target control must fail safely rather than silently simulate support.
