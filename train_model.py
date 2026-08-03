import os
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score

def generate_synthetic_data(n_samples=5000, fraud_ratio=0.15, random_seed=42):
    np.random.seed(random_seed)
    n_fraud = int(n_samples * fraud_ratio)
    n_genuine = n_samples - n_fraud

    # Feature definitions:
    # 1. amount (float)
    # 2. hour (int, 0-23)
    # 3. is_new_device (int, 0 or 1)
    # 4. location_risk (float, 0.0 to 1.0)
    # 5. velocity_1h (int, number of transactions in last hour)
    # 6. cardholder_age (int)

    # --- Genuine Transactions ---
    # Amount: mostly low to moderate, average $45, std dev $35
    amount_gen = np.random.normal(loc=45.0, scale=35.0, size=n_genuine)
    amount_gen = np.clip(amount_gen, 1.5, 450.0)

    # Hour: mostly daytime, peak around 14 (2 PM), std dev 4 hours
    hour_gen = np.random.normal(loc=14.0, scale=4.0, size=n_genuine)
    hour_gen = np.round(hour_gen).astype(int) % 24

    # is_new_device: mostly old devices (95% trusted, 5% new)
    new_device_gen = np.random.choice([0, 1], p=[0.95, 0.05], size=n_genuine)

    # location_risk: low risk, average 0.12, std dev 0.06
    loc_risk_gen = np.random.normal(loc=0.12, scale=0.06, size=n_genuine)
    loc_risk_gen = np.clip(loc_risk_gen, 0.0, 1.0)

    # velocity_1h: mostly 1 transaction, sometimes 2, rarely 3
    velocity_gen = np.random.choice([1, 2, 3], p=[0.85, 0.12, 0.03], size=n_genuine)

    # cardholder_age: normal distribution around 43 years, std dev 12
    age_gen = np.random.normal(loc=43.0, scale=12.0, size=n_genuine)
    age_gen = np.clip(age_gen, 18, 85).astype(int)

    df_genuine = pd.DataFrame({
        'amount': amount_gen,
        'hour': hour_gen,
        'is_new_device': new_device_gen,
        'location_risk': loc_risk_gen,
        'velocity_1h': velocity_gen,
        'cardholder_age': age_gen,
        'is_fraud': 0
    })

    # --- Fraudulent Transactions ---
    # Amount: higher amounts, average $320, std dev $180
    amount_fraud = np.random.normal(loc=320.0, scale=180.0, size=n_fraud)
    amount_fraud = np.clip(amount_fraud, 15.0, 1500.0)

    # Hour: mostly late night/early morning, peak around 3 AM, std dev 2.5 hours
    hour_fraud = np.random.normal(loc=3.0, scale=2.5, size=n_fraud)
    hour_fraud = np.round(hour_fraud).astype(int) % 24

    # is_new_device: mostly new devices (70% new device, 30% old device)
    new_device_fraud = np.random.choice([0, 1], p=[0.30, 0.70], size=n_fraud)

    # location_risk: higher risk locations, average 0.68, std dev 0.18
    loc_risk_fraud = np.random.normal(loc=0.68, scale=0.18, size=n_fraud)
    loc_risk_fraud = np.clip(loc_risk_fraud, 0.0, 1.0)

    # velocity_1h: high velocity, average 4.2 transactions per hour
    velocity_fraud = np.random.normal(loc=4.2, scale=1.2, size=n_fraud)
    velocity_fraud = np.clip(np.round(velocity_fraud), 1, 10).astype(int)

    # cardholder_age: younger average age, average 35 years
    age_fraud = np.random.normal(loc=35.0, scale=13.0, size=n_fraud)
    age_fraud = np.clip(age_fraud, 18, 85).astype(int)

    df_fraud = pd.DataFrame({
        'amount': amount_fraud,
        'hour': hour_fraud,
        'is_new_device': new_device_fraud,
        'location_risk': loc_risk_fraud,
        'velocity_1h': velocity_fraud,
        'cardholder_age': age_fraud,
        'is_fraud': 1
    })

    # Combine datasets
    df = pd.concat([df_genuine, df_fraud], ignore_index=True)
    # Shuffle
    df = df.sample(frac=1.0, random_state=random_seed).reset_index(drop=True)
    return df

def train():
    print("Generating synthetic payment transactions data...")
    df = generate_synthetic_data(n_samples=6000, fraud_ratio=0.15)
    
    # Feature columns and target column
    feature_cols = ['amount', 'hour', 'is_new_device', 'location_risk', 'velocity_1h', 'cardholder_age']
    X = df[feature_cols]
    y = df['is_fraud']

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    print("Fitting features scaler...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    print("Training Random Forest classifier...")
    # Initialize Random Forest
    rf = RandomForestClassifier(n_estimators=120, max_depth=10, random_state=42, class_weight='balanced')
    rf.fit(X_train_scaled, y_train)

    # Evaluate the model
    y_pred = rf.predict(X_test_scaled)
    acc = accuracy_score(y_test, y_pred)
    print(f"\nModel Evaluation Metrics:")
    print(f"Accuracy: {acc * 100:.2f}%")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    # Calculate statistics for genuine transactions (for explainability mapping)
    genuine_df = df[df['is_fraud'] == 0]
    genuine_stats = {
        'means': genuine_df[feature_cols].mean().to_dict(),
        'stds': genuine_df[feature_cols].std().to_dict(),
        'feature_importances': dict(zip(feature_cols, rf.feature_importances_.tolist())),
        'accuracy': float(acc)
    }

    # Save artifact structures
    print("Saving model, scaler, and stats...")
    joblib.dump(rf, 'fraud_model.joblib')
    joblib.dump(scaler, 'scaler.joblib')
    joblib.dump(genuine_stats, 'model_meta.joblib')
    
    print("Training completed successfully! Files saved: fraud_model.joblib, scaler.joblib, model_meta.joblib")

if __name__ == '__main__':
    train()
