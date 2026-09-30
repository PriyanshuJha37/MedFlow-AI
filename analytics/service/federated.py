import numpy as np
from typing import List, Dict, Tuple
import random


# BRICS countries with synthetic healthcare data characteristics
BRICS_COUNTRIES = {
    "India": {"population": 1400000000, "base_demand": 1000, "seasonality": 0.3},
    "Brazil": {"population": 215000000, "base_demand": 150, "seasonality": 0.4},
    "Russia": {"population": 144000000, "base_demand": 100, "seasonality": 0.2},
    "China": {"population": 1400000000, "base_demand": 1200, "seasonality": 0.25},
    "South Africa": {"population": 60000000, "base_demand": 50, "seasonality": 0.35},
}


class FederatedLearningService:
    def __init__(self):
        self.global_weights = None
        self.global_bias = 0.0
        self.current_round = 0
        self.local_models = {}
        self._initialize_global_model()

    def _initialize_global_model(self):
        """Initialize global model with random weights"""
        self.global_weights = np.random.randn(5).tolist()  # 5 features
        self.global_bias = random.uniform(-1, 1)

    def generate_synthetic_data(self, country: str, n_samples: int = 100) -> Tuple[np.ndarray, np.ndarray]:
        """Generate synthetic healthcare data for a country"""
        country_config = BRICS_COUNTRIES.get(country, BRICS_COUNTRIES["India"])
        
        X = np.random.randn(n_samples, 5)
        
        # Create target with country-specific patterns
        base = country_config["base_demand"]
        seasonality = country_config["seasonality"]
        
        # Linear combination with noise
        true_weights = np.array([0.5, -0.3, 0.8, 0.2, -0.1])
        y = (X @ true_weights * 10 + base + 
             np.sin(X[:, 0] * seasonality * 10) * 50 + 
             np.random.randn(n_samples) * 20)
        
        return X, y

    def train_local_model(self, country: str, epochs: int = 10, learning_rate: float = 0.01) -> Dict:
        """Train a local model on country-specific synthetic data"""
        X, y = self.generate_synthetic_data(country, n_samples=200)
        
        # Initialize with global model if available
        if self.global_weights is not None:
            weights = np.array(self.global_weights.copy())
            bias = self.global_bias
        else:
            weights = np.random.randn(5)
            bias = random.uniform(-1, 1)
        
        # Simple gradient descent
        n_samples = X.shape[0]
        for epoch in range(epochs):
            predictions = X @ weights + bias
            error = predictions - y
            gradient = (2 / n_samples) * (X.T @ error)
            bias_gradient = (2 / n_samples) * np.sum(error)
            
            weights -= learning_rate * gradient
            bias -= learning_rate * bias_gradient
        
        # Calculate final loss
        final_loss = np.mean((X @ weights + bias - y) ** 2)
        
        # Store local model
        self.local_models[country] = {
            "country": country,
            "weights": weights.tolist(),
            "bias": float(bias),
            "loss": float(final_loss),
            "samples": n_samples
        }
        
        return self.local_models[country]

    def aggregate_models(self, updates: List[Dict], strategy: str = "fedavg") -> Dict:
        """Aggregate local model updates into a global model"""
        if not updates:
            return {
                "globalWeights": self.global_weights,
                "globalBias": self.global_bias,
                "participatingCountries": [],
                "totalSamples": 0,
                "round": self.current_round
            }
        
        if strategy == "fedavg":
            total_samples = sum(update["samples"] for update in updates)
            
            if total_samples == 0:
                return {
                    "globalWeights": self.global_weights,
                    "globalBias": self.global_bias,
                    "participatingCountries": [],
                    "totalSamples": 0,
                    "round": self.current_round
                }
            
            # Weighted average of weights and bias
            weighted_weights = np.zeros_like(np.array(self.global_weights))
            weighted_bias = 0.0
            
            for update in updates:
                weight = update["samples"] / total_samples
                weighted_weights += weight * np.array(update["weights"])
                weighted_bias += weight * update["bias"]
            
            self.global_weights = weighted_weights.tolist()
            self.global_bias = float(weighted_bias)
            self.current_round += 1
            
            participating_countries = [update["country"] for update in updates]
            
            return {
                "globalWeights": self.global_weights,
                "globalBias": self.global_bias,
                "participatingCountries": participating_countries,
                "totalSamples": total_samples,
                "round": self.current_round
            }
        
        # Default: simple average
        avg_weights = np.mean([np.array(u["weights"]) for u in updates], axis=0)
        avg_bias = np.mean([u["bias"] for u in updates])
        
        self.global_weights = avg_weights.tolist()
        self.global_bias = float(avg_bias)
        self.current_round += 1
        
        return {
            "globalWeights": self.global_weights,
            "globalBias": self.global_bias,
            "participatingCountries": [u["country"] for u in updates],
            "totalSamples": sum(u["samples"] for u in updates),
            "round": self.current_round
        }

    def predict(self, features: List[float], use_global_model: bool = True, country: str = None) -> Dict:
        """Make prediction using global or local model"""
        features_array = np.array(features)
        
        if use_global_model or country is None or country not in self.local_models:
            if self.global_weights is None:
                return {"prediction": 0.0, "modelType": "uninitialized", "country": None}
            
            prediction = float(features_array @ np.array(self.global_weights) + self.global_bias)
            return {
                "prediction": prediction,
                "modelType": "global",
                "country": None
            }
        else:
            local_model = self.local_models[country]
            prediction = float(features_array @ np.array(local_model["weights"]) + local_model["bias"])
            return {
                "prediction": prediction,
                "modelType": "local",
                "country": country
            }

    def get_country_nodes(self) -> List[Dict]:
        """Get information about all country nodes"""
        nodes = []
        for country, config in BRICS_COUNTRIES.items():
            nodes.append({
                "country": country,
                "dataPoints": config["population"] // 10000,  # Scaled down for demo
                "features": ["temperature", "humidity", "population_density", "seasonal_factor", "historical_demand"]
            })
        return nodes

    def get_status(self) -> Dict:
        """Get current federated learning status"""
        return {
            "round": self.current_round,
            "globalWeights": self.global_weights,
            "globalBias": self.global_bias,
            "participatingCountries": list(self.local_models.keys()),
            "localModels": self.local_models
        }


# Global service instance
federated_service = FederatedLearningService()
