from flask import Flask, render_template, request, jsonify
import requests
import json
import os
app = Flask(__name__)

# Zastąp poniższe wartości własnymi danymi webhooka Discord
webhook_url = 'https://discord.com/api/webhooks/1196836715751559309/nx4khP3SRCltZDLoFpy1hvVp69QKjCfiqPgPnqBOPTSor3LZQwuCXQdo0xLIZePIJN7V'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/send', methods=['POST'])
def send_message():
    username = request.form.get('username')
    discord = request.form.get('discord')
    label = request.form.get('label')
    wiek = request.form.get('wiek')
    warunki = request.form.get('warunki')
    mix = request.form.get('mix')

    # Tworzenie payloadu do wysłania na Discorda
    payload = {
        'content': f'**Użytkownik:** {username}\n**Discord:** {discord}\n**Label/Kanał:** {label}\n**Wiek:** {wiek}\n**Warunki nagrywania:** {warunki}\n**Umiejętność mix/mastering:** {mix}'
    }

    # Wysłanie danych na Discorda za pomocą webhooka
    requests.post(webhook_url, data=json.dumps(payload), headers={'Content-Type': 'application/json'})

    return 'Dane wysłane na Discorda.'



app.run(host='0.0.0.0', port=8080)