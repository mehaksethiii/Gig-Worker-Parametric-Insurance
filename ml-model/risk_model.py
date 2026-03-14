import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import pickle
import json

class RiskAssessmentModel:
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.city_encoder = LabelEncoder()
        self.risk_encoder = LabelEncoder()
        
    def prepare_training_data(self):
        """Generate synthetic training data for demo"""
        cities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 
                  'Kolkata', 'Pun