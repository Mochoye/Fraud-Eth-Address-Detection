import sys
import json
import joblib
import numpy as np
from predictor import LightGBMPredictor
import sys

try:
    # Load model and encoder
    model = joblib.load("lightgbm_predictor.pkl")
    encoder = joblib.load("encoder.pkl")

    # Read input JSON from stdin
    input_data = json.load(sys.stdin)

    # Define expected numeric feature names (excluding the categorical one)
    numeric_feature_names = [
        "avg_min_between_sent_tnx",
        "avg_min_between_received_tnx",
        "time_diff_between_first_last",
        "sent_tnx",
        "received_tnx",
        "number_of_created_contracts",
        "unique_received_from_addresses",
        "unique_sent_to_addresses",
        "min_value_received",
        "max_value_received",
        "avg_value_received",
        "min_value_sent",
        "max_value_sent",
        "avg_value_sent",
        "total_transactions",
        "total_ether_sent",
        "total_ether_received",
        "total_ether_sent_contracts",
        "total_ether_balance",
        "total_erc20_txns",
        "erc20_total_ether_received",
        "erc20_total_ether_sent",
        "erc20_total_ether_sent_contracts",
        "erc20_uniq_sent_addr",
        "erc20_uniq_rec_addr",
        "erc20_uniq_sent_addr_1",
        "erc20_uniq_rec_contract_addr",
        "erc20_min_val_rec",
        "erc20_max_val_rec",
        "erc20_avg_val_rec",
        "erc20_min_val_sent",
        "erc20_max_val_sent",
        "erc20_avg_val_sent",
        "erc20_uniq_sent_token_name",
        "erc20_uniq_rec_token_name"
    ]

    # Validate input and construct numeric array
    missing = [f for f in numeric_feature_names if f not in input_data]
    if missing:
        raise ValueError(f"Missing required numeric features: {missing}")

    numeric_values = [input_data[f] for f in numeric_feature_names]
    numeric_array = np.array(numeric_values).reshape(1, -1)

    # Transform categorical
    token_type = input_data.get("erc20_most_rec_token_type", "")
    encoded_array = encoder.transform([[token_type]])  # already 2D

    # Combine numeric and categorical features
    X = np.hstack([numeric_array, encoded_array])

    # Predict
    labels, probs = model.predict_and_proba(X)

    # Output clean JSON only
    print(json.dumps({
        "prediction": int(labels[0]),
        "probabilities": [float(p) for p in probs[0]]
    }))

except Exception as e:
    import traceback
    sys.stderr.write("Prediction error:\n" + traceback.format_exc())
    print(json.dumps({
        "error": "Prediction failed",
        "message": str(e)
    }))
    sys.exit(1)