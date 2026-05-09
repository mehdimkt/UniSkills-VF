#!/bin/bash

# Démarrer le backend Python en arrière-plan
if [ "$NODE_ENV" = "production" ]; then
    gunicorn main:app --bind 0.0.0.0:5051 --workers 2 --timeout 120 &
else
    python3 main.py &
fi

# Démarrer le serveur Node.js (qui sert le frontend et proxy)
npm run start