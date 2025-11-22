import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.compose import ColumnTransformer
from sklearn.metrics import accuracy_score, classification_report
import joblib
import numpy as np

# Define the file path for the dataset
# --- FIX: Change DATA_PATH to reference the file in its own directory ---
DATA_PATH = 'ml-model/event_data.csv' 
# Assuming you have downloaded the Kaggle data and renamed it to event_data.csv

def train_and_save_model():
    """
    Loads data, preprocesses features, trains a Logistic Regression model, 
    and saves the model and the preprocessor (ColumnTransformer).
    """
    
    # --- MAPPING THE KAGGLE COLUMNS TO YOUR APPLICATION COLUMNS ---
    # **FINAL FIXED MAPPING** based on the debug output: ['Event Type', 'Attendees', 'Expenses', 'Success']
    KAGGLE_CATEGORY_COL = 'Event Type'       
    KAGGLE_BUDGET_COL = 'Expenses'      # REMOVED '#' AND SPACE
    KAGGLE_FOOTFALL_COL = 'Attendees'    # REMOVED '#' AND SPACE
    KAGGLE_TARGET_COL = 'Success' 

    try:
        # 1. Load Data
        print(f"Loading data from {DATA_PATH}...")
        df = pd.read_csv(DATA_PATH)
        
        # --- REMOVED TEMPORARY DEBUG LINE ---
        
        # 1.1. Rename columns to match your required input for consistency
        df = df.rename(columns={
            KAGGLE_CATEGORY_COL: 'event_category',
            KAGGLE_BUDGET_COL: 'budget',
            KAGGLE_FOOTFALL_COL: 'footfall',
            KAGGLE_TARGET_COL: 'approved'
        })

        # Drop rows where critical data is missing (simple cleanup)
        df.dropna(subset=['event_category', 'budget', 'footfall', 'approved'], inplace=True)
        
        # Ensure 'approved' is an integer (0 or 1)
        df['approved'] = df['approved'].astype(int)

        # Define features (X) and target (y)
        X = df[['event_category', 'budget', 'footfall']]
        y = df['approved']

        # 2. Preprocessing Setup
        # Identify categorical and numerical columns
        categorical_features = ['event_category']
        numerical_features = ['budget', 'footfall']

        # Create a preprocessor (ColumnTransformer) to handle different feature types
        preprocessor = ColumnTransformer(
            transformers=[
                ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), categorical_features),
                ('num', 'passthrough', numerical_features)
            ],
            remainder='drop' 
        )

        # 3. Train/Test Split
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        # 4. Apply Preprocessing and Train Model
        print("Training model...")
        
        X_train_processed = preprocessor.fit_transform(X_train)
        
        model = LogisticRegression(random_state=42, solver='liblinear') 
        
        model.fit(X_train_processed, y_train)

        # 5. Evaluation
        X_test_processed = preprocessor.transform(X_test)
        y_pred = model.predict(X_test_processed)
        
        print("\n--- Model Evaluation ---")
        print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
        print(classification_report(y_test, y_pred, zero_division=0))
        print("------------------------\n")
        
        # 6. Save Model and Preprocessor
        joblib.dump(model, 'ml-model/feasibility_model.joblib')
        joblib.dump(preprocessor, 'ml-model/preprocessor.joblib')
        print("Model and preprocessor saved successfully in ml-model/ directory.")

    except FileNotFoundError:
        print(f"ERROR: Dataset not found at '{DATA_PATH}'.")
        print("Please ensure your Kaggle data is named 'event_data.csv' and is in the 'ml-model/' directory.")
    except KeyError as e:
        # This error handling now correctly identifies which original column was missing
        print(f"ERROR: Column {e} not found in the dataset. Please adjust the column names in the script (KAGGLE_..._COL variables).")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    train_and_save_model()