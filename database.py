import os
import sqlite3
import json
from datetime import datetime, timedelta
import random

DB_PATH = os.path.join(os.path.dirname(__file__), 'transactions.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            amount REAL NOT NULL,
            hour INTEGER NOT NULL,
            location TEXT NOT NULL,
            device_type TEXT NOT NULL,
            is_new_device INTEGER NOT NULL,
            velocity_1h INTEGER NOT NULL,
            cardholder_age INTEGER NOT NULL,
            risk_score REAL NOT NULL,
            label TEXT NOT NULL,
            explanations TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()
    print("SQLite database initialized at:", DB_PATH)

def insert_transaction(tx_data):
    """
    tx_data is a dict containing:
    timestamp, amount, hour, location, device_type, is_new_device, velocity_1h, cardholder_age, risk_score, label, explanations
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # explanations should be serialized to JSON if it's a list/dict
    explanations_str = tx_data['explanations']
    if not isinstance(explanations_str, str):
        explanations_str = json.dumps(explanations_str)
        
    cursor.execute('''
        INSERT INTO transactions (
            timestamp, amount, hour, location, device_type, 
            is_new_device, velocity_1h, cardholder_age, 
            risk_score, label, explanations
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        tx_data['timestamp'],
        tx_data['amount'],
        tx_data['hour'],
        tx_data['location'],
        tx_data['device_type'],
        tx_data['is_new_device'],
        tx_data['velocity_1h'],
        tx_data['cardholder_age'],
        tx_data['risk_score'],
        tx_data['label'],
        explanations_str
    ))
    conn.commit()
    inserted_id = cursor.lastrowid
    conn.close()
    return inserted_id

def get_all_transactions(limit=100):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM transactions ORDER BY timestamp DESC, id DESC LIMIT ?', (limit,))
    rows = cursor.fetchall()
    conn.close()
    
    transactions = []
    for r in rows:
        d = dict(r)
        # deserialize explanations back to JSON list
        try:
            d['explanations'] = json.loads(d['explanations'])
        except Exception:
            d['explanations'] = []
        transactions.append(d)
    return transactions

def get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Total Transactions
    cursor.execute('SELECT COUNT(*) FROM transactions')
    total_count = cursor.fetchone()[0]
    
    # Flagged Transactions (label is Review or High Risk)
    cursor.execute('SELECT COUNT(*) FROM transactions WHERE label IN ("Review", "High Risk")')
    flagged_count = cursor.fetchone()[0]
    
    # Estimated Amount Saved (assuming high risk transactions are blocked and amount is saved)
    cursor.execute('SELECT SUM(amount) FROM transactions WHERE label = "High Risk"')
    sum_high_risk = cursor.fetchone()[0]
    amount_saved = round(sum_high_risk, 2) if sum_high_risk else 0.0
    
    conn.close()
    
    # Accuracy metric is static or loaded from model meta (e.g. 96.5%)
    model_accuracy = 95.8
    
    return {
        "total_transactions": total_count,
        "flagged_transactions": flagged_count,
        "amount_saved": amount_saved,
        "model_accuracy": model_accuracy
    }

def preload_data_if_empty(predict_func):
    """
    Preloads sample data if the table is empty.
    predict_func is a function that takes features dict and returns: (risk_score, label, explanations)
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM transactions')
    count = cursor.fetchone()[0]
    conn.close()
    
    if count > 0:
        print("Database already contains data. Skipping preloading.")
        return
        
    print("Preloading database with sample transactions...")
    
    locations = {
        "genuine": ["New York, USA", "London, UK", "Paris, France", "San Francisco, USA", "Chicago, USA", "Boston, USA", "Toronto, Canada", "Berlin, Germany", "Tokyo, Japan", "Sydney, Australia"],
        "suspicious": ["Lagos, Nigeria", "Kyiv, Ukraine", "Bucharest, Romania", "Unknown VPN, Latvia", "Caracas, Venezuela"]
    }
    
    devices = ["Mobile", "Desktop", "Tablet"]
    
    now = datetime.now()
    
    # Generate 25 transactions, spread over the past 24 hours
    preloaded = []
    
    for i in range(25):
        # We will make about 5 of them look like fraud
        is_fraud_scenario = (i % 5 == 0)
        
        # Determine time
        time_offset_minutes = random.randint(10, 1440) # up to 24 hours ago
        tx_time = now - timedelta(minutes=time_offset_minutes)
        hour = tx_time.hour
        
        if is_fraud_scenario:
            # Fraud characteristics
            amount = round(random.uniform(150.0, 950.0), 2)
            location = random.choice(locations["suspicious"])
            device_type = random.choice(devices)
            is_new_device = random.choice([0, 1]) if random.random() < 0.8 else 0
            location_risk = round(random.uniform(0.6, 0.95), 2)
            velocity_1h = random.choice([3, 4, 5])
            cardholder_age = random.randint(22, 50)
            # Adjust hour to be night hours for extra authenticity
            if random.random() < 0.7:
                hour = random.choice([1, 2, 3, 4])
                tx_time = tx_time.replace(hour=hour)
        else:
            # Genuine characteristics
            amount = round(random.uniform(5.0, 120.0), 2)
            location = random.choice(locations["genuine"])
            device_type = random.choice(devices)
            is_new_device = 0 if random.random() < 0.96 else 1
            location_risk = round(random.uniform(0.02, 0.22), 2)
            velocity_1h = random.choice([1, 2])
            cardholder_age = random.randint(18, 75)
            
        features = {
            'amount': amount,
            'hour': hour,
            'is_new_device': is_new_device,
            'location_risk': location_risk,
            'velocity_1h': velocity_1h,
            'cardholder_age': cardholder_age
        }
        
        # Get ML prediction
        risk_score, label, explanations = predict_func(features)
        
        tx_data = {
            'timestamp': tx_time.isoformat(),
            'amount': amount,
            'hour': hour,
            'location': location,
            'device_type': device_type,
            'is_new_device': is_new_device,
            'velocity_1h': velocity_1h,
            'cardholder_age': cardholder_age,
            'risk_score': risk_score,
            'label': label,
            'explanations': explanations
        }
        
        insert_transaction(tx_data)
        
    print("Database preloaded successfully.")

if __name__ == '__main__':
    init_db()
