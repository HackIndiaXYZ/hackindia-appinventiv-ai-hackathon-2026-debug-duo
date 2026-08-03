import os
import sys
import json
import numpy as np
from datetime import datetime
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import database

# Initialize FastAPI App
app = FastAPI(title="AI Fraud Detection Engine API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify front-end domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model files
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'fraud_model.joblib')
SCALER_PATH = os.path.join(BASE_DIR, 'scaler.joblib')
META_PATH = os.path.join(BASE_DIR, 'model_meta.joblib')

model = None
scaler = None
model_meta = None

def load_ml_components():
    global model, scaler, model_meta
    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH) and os.path.exists(META_PATH):
        try:
            model = joblib.load(MODEL_PATH)
            scaler = joblib.load(SCALER_PATH)
            model_meta = joblib.load(META_PATH)
            print("ML model, scaler, and metadata loaded successfully.")
        except Exception as e:
            print(f"Error loading model files: {e}")
    else:
        print("ML model files not found. They will be trained when the engine starts if needed.")

# Initialize SQLite database
database.init_db()

# Load components
load_ml_components()

class TransactionRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Transaction amount in dollars")
    hour: int = Field(default=None, ge=0, le=23, description="Hour of the transaction (0-23)")
    location: str = Field(..., description="Transaction location name (e.g. 'New York, USA')")
    device_type: str = Field(..., description="Device used ('Mobile', 'Desktop', 'Tablet')")
    is_new_device: int = Field(..., ge=0, le=1, description="Is the device new? (1 for yes, 0 for no)")
    velocity_1h: int = Field(..., ge=1, description="Transactions in the last hour")
    cardholder_age: int = Field(..., ge=18, le=100, description="Age of the cardholder")
    location_risk: float = Field(default=None, ge=0.0, le=1.0, description="Risk factor of location")

def compute_explanations(features, risk_score):
    if not model_meta:
        return []
    
    means = model_meta['means']
    stds = model_meta['stds']
    importances = model_meta['feature_importances']
    
    raw_contributions = {}
    
    # Amount deviation
    std_val = stds['amount'] if stds['amount'] > 0 else 1.0
    amount_dev = max(0.0, (features['amount'] - means['amount']) / std_val)
    raw_contributions['amount'] = amount_dev * importances['amount']
    
    # Hour deviation (late night: 23, 0, 1, 2, 3, 4, 5)
    is_odd_hour = 1 if features['hour'] in [23, 0, 1, 2, 3, 4, 5] else 0
    raw_contributions['hour'] = is_odd_hour * importances['hour'] * 2.5
    
    # New Device status
    raw_contributions['is_new_device'] = features['is_new_device'] * importances['is_new_device'] * 2.0
    
    # Location Risk level
    raw_contributions['location_risk'] = features['location_risk'] * importances['location_risk'] * 2.2
    
    # Transaction velocity deviation
    velocity_dev = max(0.0, (features['velocity_1h'] - 1.0) / 2.0)
    raw_contributions['velocity_1h'] = velocity_dev * importances['velocity_1h'] * 1.5
    
    # Cardholder age profile deviation
    age_dev = max(0.0, (means['cardholder_age'] - features['cardholder_age']) / (stds['cardholder_age'] if stds['cardholder_age'] > 0 else 1.0))
    raw_contributions['cardholder_age'] = age_dev * importances['cardholder_age']
    
    total_raw = sum(raw_contributions.values())
    
    feature_mappings = {
        'amount': ('Transaction Amount', lambda v: f"${v:,.2f}"),
        'hour': ('Transaction Time', lambda v: f"{v:02d}:00"),
        'is_new_device': ('Device Status', lambda v: "New/Unrecognized Device" if v == 1 else "Trusted Device"),
        'location_risk': ('Location Risk Level', lambda v: f"Location Risk: {v:.2f}"),
        'velocity_1h': ('Hourly Transaction Volume', lambda v: f"{v} txn/hour"),
        'cardholder_age': ('Cardholder Age Profile', lambda v: f"{v} years old")
    }
    
    explanations = []
    for feat, raw_val in raw_contributions.items():
        name, formatter = feature_mappings[feat]
        percentage = round((raw_val / total_raw * 100), 1) if total_raw > 0 else 0.0
        
        # Status assignment
        status = "Normal"
        val = features[feat]
        if feat == 'amount':
            if val > means['amount'] + 3 * stds['amount']:
                status = "Critical"
            elif val > means['amount'] + 1.5 * stds['amount']:
                status = "Warning"
        elif feat == 'hour':
            if val in [1, 2, 3, 4]:
                status = "Critical"
            elif val in [0, 5, 23]:
                status = "Warning"
        elif feat == 'is_new_device' and val == 1:
            status = "Warning"
        elif feat == 'location_risk':
            if val > 0.6:
                status = "Critical"
            elif val > 0.3:
                status = "Warning"
        elif feat == 'velocity_1h':
            if val >= 4:
                status = "Critical"
            elif val >= 3:
                status = "Warning"
        elif feat == 'cardholder_age':
            if val < 21:
                status = "Warning"
                
        explanations.append({
            "feature": feat,
            "name": name,
            "value": formatter(val),
            "percentage": percentage,
            "status": status,
            "raw_score": round(min(100.0, raw_val * 400), 1)
        })
        
    explanations = sorted(explanations, key=lambda x: x['percentage'], reverse=True)
    return explanations

def run_prediction(features_dict):
    """Runs ML prediction on feature dictionary, returns (score, label, explanations)."""
    global model, scaler
    
    # Reload model if it was trained after startup
    if model is None:
        load_ml_components()
        
    if model is None or scaler is None:
        # Fallback heuristic if ML model files are missing
        print("ML model files not available. Using heuristic rules.")
        risk_score = 10.0
        if features_dict['amount'] > 300: risk_score += 30
        if features_dict['is_new_device'] == 1: risk_score += 25
        if features_dict['location_risk'] > 0.5: risk_score += 25
        if features_dict['velocity_1h'] >= 3: risk_score += 20
        if features_dict['hour'] in [1, 2, 3, 4]: risk_score += 15
        risk_score = min(99.0, risk_score)
        
        label = "Safe"
        if risk_score >= 75.0: label = "High Risk"
        elif risk_score >= 35.0: label = "Review"
        
        explanations = [
            {"feature": "amount", "name": "Transaction Amount", "value": f"${features_dict['amount']:.2f}", "percentage": 40.0, "status": "Warning" if features_dict['amount'] > 200 else "Normal", "raw_score": 40.0},
            {"feature": "is_new_device", "name": "Device Status", "value": "New Device" if features_dict['is_new_device'] else "Trusted Device", "percentage": 30.0, "status": "Warning" if features_dict['is_new_device'] else "Normal", "raw_score": 30.0},
            {"feature": "location_risk", "name": "Location Risk Level", "value": f"Risk Index: {features_dict['location_risk']:.2f}", "percentage": 30.0, "status": "Warning" if features_dict['location_risk'] > 0.5 else "Normal", "raw_score": 30.0}
        ]
        return round(risk_score, 1), label, explanations
        
    # Standard Scikit-Learn Prediction pipeline
    import pandas as pd
    ordered_features = pd.DataFrame([{
        'amount': features_dict['amount'],
        'hour': features_dict['hour'],
        'is_new_device': features_dict['is_new_device'],
        'location_risk': features_dict['location_risk'],
        'velocity_1h': features_dict['velocity_1h'],
        'cardholder_age': features_dict['cardholder_age']
    }])
    
    scaled_feats = scaler.transform(ordered_features)
    prob_fraud = model.predict_proba(scaled_feats)[0][1]
    
    risk_score = round(prob_fraud * 100, 1)
    
    if risk_score >= 75.0:
        label = "High Risk"
    elif risk_score >= 35.0:
        label = "Review"
    else:
        label = "Safe"
        
    explanations = compute_explanations(features_dict, risk_score)
    return risk_score, label, explanations

@app.post("/predict-fraud")
def predict_fraud(payload: TransactionRequest):
    # Set current hour if not specified
    hour = payload.hour if payload.hour is not None else datetime.now().hour
    
    # Auto-assign location risk level if not specified
    loc_risk = payload.location_risk
    if loc_risk is None:
        location_lower = payload.location.lower()
        if "ukraine" in location_lower or "latvia" in location_lower or "vpn" in location_lower or "venezuela" in location_lower or "nigeria" in location_lower:
            loc_risk = 0.75
        elif "chicago" in location_lower or "detroit" in location_lower:
            loc_risk = 0.35
        else:
            loc_risk = 0.08  # Default low risk
            
    features = {
        'amount': payload.amount,
        'hour': hour,
        'is_new_device': payload.is_new_device,
        'location_risk': loc_risk,
        'velocity_1h': payload.velocity_1h,
        'cardholder_age': payload.cardholder_age
    }
    
    risk_score, label, explanations = run_prediction(features)
    
    tx_record = {
        'timestamp': datetime.now().isoformat(),
        'amount': payload.amount,
        'hour': hour,
        'location': payload.location,
        'device_type': payload.device_type,
        'is_new_device': payload.is_new_device,
        'velocity_1h': payload.velocity_1h,
        'cardholder_age': payload.cardholder_age,
        'risk_score': risk_score,
        'label': label,
        'explanations': explanations
    }
    
    # Save transaction in SQLite db
    db_id = database.insert_transaction(tx_record)
    tx_record['id'] = db_id
    
    return tx_record

@app.get("/transactions")
def get_transactions(limit: int = 50):
    return database.get_all_transactions(limit=limit)

@app.get("/stats")
def get_dashboard_stats():
    stats = database.get_stats()
    # Pull accuracy from model if loaded
    if model_meta:
        stats['model_accuracy'] = round(model_meta['accuracy'] * 100, 1)
    return stats

@app.post("/preload")
def trigger_preload():
    # Helper endpoint to populate initial DB data
    database.preload_data_if_empty(lambda f: run_prediction(f))
    return {"message": "Preload checked/executed."}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
