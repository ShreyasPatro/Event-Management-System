import flask
from flask import request, jsonify
import joblib
import pandas as pd
import numpy as np
import os
from datetime import datetime

# --- Configuration ---
# Assuming the model files were saved in the same directory
MODEL_PATH = 'ml-model/feasibility_model.joblib'
PREPROCESSOR_PATH = 'ml-model/preprocessor.joblib'

# --- Initialization ---
app = flask.Flask(__name__)
app.config["DEBUG"] = True

# Global variables for the model and preprocessor
model = None
preprocessor = None

def load_model_assets():
    """Loads the trained model and the ColumnTransformer from disk."""
    global model, preprocessor
    try:
        # Load from the correct path relative to the script execution (or use absolute path)
        model = joblib.load(MODEL_PATH)
        preprocessor = joblib.load(PREPROCESSOR_PATH)
        print("ML Assets loaded successfully.")
    except Exception as e:
        print(f"Error loading ML assets: {e}")
        # Terminate if assets are missing, as the API cannot function
        exit(1)

@app.route('/predict_feasibility', methods=['POST'])
def predict_feasibility():
    """
    Accepts JSON data for a proposal and returns a feasibility score (0.0 to 1.0).
    Input structure: { "category": "Cultural", "budget": 50000, "footfall": 350 }
    """
    if not request.json:
        return jsonify({"error": "Missing JSON data in request body"}), 400

    required_keys = ['category', 'budget', 'footfall']
    if not all(key in request.json for key in required_keys):
        return jsonify({"error": "Missing one or more required fields: category, budget, footfall"}), 400

    try:
        data = request.json
        
        # 1. Create a DataFrame from the input data
        # IMPORTANT: The column names must match the names used during model training
        input_data = pd.DataFrame({
            'event_category': [data['category']],
            'budget': [data['budget']],
            'footfall': [data['footfall']]
        })

        # 2. Preprocess the input data
        # This transforms categorical data (category) into the format the model expects
        processed_data = preprocessor.transform(input_data)
        
        # 3. Make Prediction
        # We use predict_proba to get the probability of success (class 1)
        # This probability is the "feasibility score"
        probabilities = model.predict_proba(processed_data)
        
        # The score is the probability of the positive class (index 1)
        feasibility_score = float(probabilities[0][1])

        # 4. Return the result
        return jsonify({
            "score": round(feasibility_score, 4),
            "prediction_time": datetime.now().isoformat()
        })

    except Exception as e:
        print(f"Prediction failed: {e}")
        return jsonify({"error": f"Prediction processing failed: {e}"}), 500

# Load assets before running the app
if __name__ == '__main__':
    load_model_assets()
    # Start the Flask API on a different port than the Node.js server (5000)
    app.run(host='0.0.0.0', port=5001)