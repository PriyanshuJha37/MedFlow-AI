from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class ForecastRequest(BaseModel):
    series: List[float]
    horizon: int = 7
    window: int = 7
    phcId: Optional[str] = None
    metric: Optional[str] = None


class ForecastResponse(BaseModel):
    data: List[float]
    upper: List[float]
    lower: List[float]
    method: str
    drivers: Dict[str, Any]


class StockoutRiskRequest(BaseModel):
    items: List[Dict[str, Any]]
    threshold: Optional[float] = 0.8


class StockoutRiskResponse(BaseModel):
    risks: List[Dict[str, Any]]
    summary: Dict[str, Any]


class AnomalyRequest(BaseModel):
    series: List[float]
    sensitivity: Optional[float] = 0.95
    window: Optional[int] = 7


class AnomalyResponse(BaseModel):
    anomalies: List[int]
    scores: List[float]
    threshold: float


class TransferItem(BaseModel):
    itemId: str
    fromLocation: Optional[str] = None
    toLocation: Optional[str] = None
    quantity: Optional[int] = None
    currentStock: Optional[int] = None
    demand: Optional[float] = None


class RecommendTransfersRequest(BaseModel):
    items: List[TransferItem]


class RecommendTransfersResponse(BaseModel):
    recommendations: List[Dict[str, Any]]
    savings: Optional[float] = None
    summary: Dict[str, Any]


# Federated Learning Models
class CountryNode(BaseModel):
    country: str
    dataPoints: int
    features: List[str]


class LocalModelUpdate(BaseModel):
    country: str
    weights: List[float]
    bias: float
    samples: int
    loss: float


class FederatedAggregationRequest(BaseModel):
    updates: List[LocalModelUpdate]
    strategy: str = "fedavg"


class FederatedAggregationResponse(BaseModel):
    globalWeights: List[float]
    globalBias: float
    participatingCountries: List[str]
    totalSamples: int
    round: int


class TrainLocalModelRequest(BaseModel):
    country: str
    epochs: int = 10
    learningRate: float = 0.01


class TrainLocalModelResponse(BaseModel):
    country: str
    weights: List[float]
    bias: float
    loss: float
    samples: int


class PredictionRequest(BaseModel):
    features: List[float]
    useGlobalModel: bool = True


class PredictionResponse(BaseModel):
    prediction: float
    modelType: str
    country: Optional[str] = None
