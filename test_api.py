import requests

url = 'http://127.0.0.1:8000/predict-fraud'
payload = {
    'amount': 1500.0,
    'location': 'Unknown VPN, Latvia',
    'device_type': 'Mobile',
    'is_new_device': 1,
    'velocity_1h': 5,
    'cardholder_age': 25
}

print("Sending POST request to /predict-fraud...")
try:
    response = requests.post(url, json=payload)
    print("Status Code:", response.status_code)
    if response.status_code == 200:
        data = response.json()
        print("\nPrediction Result:")
        print(f"Risk Score: {data['risk_score']}%")
        print(f"Label: {data['label']}")
        print("\nExplanations:")
        for exp in data['explanations']:
            print(f"- {exp['name']}: {exp['value']} | Contribution: {exp['percentage']}% ({exp['status']})")
    else:
        print("Response:", response.text)
except Exception as e:
    print("Error:", e)
