# predictor.py
import numpy as np

class LightGBMPredictor:
    def __init__(self, pipeline):
        self.pipeline = pipeline

    def fit(self, X, y):
        self.pipeline.fit(X, y)

    def predict_and_proba(self, X):
        labels = self.pipeline.predict(X)
        probs = self.pipeline.predict_proba(X)
        probs_rounded = np.round(probs, 4)
        return labels, probs_rounded
