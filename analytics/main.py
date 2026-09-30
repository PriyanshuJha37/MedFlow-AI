from fastapi import FastAPI
from models import (
    ForecastRequest,
    ForecastResponse,
    StockoutRiskRequest,
    StockoutRiskResponse,
    AnomalyRequest,
    AnomalyResponse,
    RecommendTransfersRequest,
    RecommendTransfersResponse,
    CountryNode,
    LocalModelUpdate,
    FederatedAggregationRequest,
    FederatedAggregationResponse,
    TrainLocalModelRequest,
    TrainLocalModelResponse,
    PredictionRequest,
    PredictionResponse,
)
from service.federated import federated_service

app = FastAPI(title="MedFlow Analytics Service")


@app.get("/health")
def health():
    return {"status": "ok", "service": "medflow-analytics"}


@app.post("/analytics/forecast", response_model=ForecastResponse)
def forecast(req: ForecastRequest):
    return ForecastResponse(
        data=[0.0] * req.horizon,
        upper=[0.0] * req.horizon,
        lower=[0.0] * req.horizon,
        method="placeholder",
        drivers={},
    )


@app.post("/analytics/stockout-risk", response_model=StockoutRiskResponse)
def stockout_risk(req: StockoutRiskRequest):
    return StockoutRiskResponse(
        risks=[],
        summary={"totalItems": len(req.items), "atRisk": 0},
    )


@app.post("/analytics/anomalies", response_model=AnomalyResponse)
def anomalies(req: AnomalyRequest):
    return AnomalyResponse(
        anomalies=[],
        scores=[0.0] * len(req.series),
        threshold=req.sensitivity or 0.95,
    )


@app.post("/analytics/recommend-transfers", response_model=RecommendTransfersResponse)
def recommend_transfers(req: RecommendTransfersRequest):
    return RecommendTransfersResponse(
        recommendations=[],
        savings=0.0,
        summary={"totalItems": len(req.items), "transfers": 0},
    )


# Federated Learning Endpoints
@app.get("/federated/nodes", response_model=list[CountryNode])
def get_country_nodes():
    """Get information about all BRICS country nodes"""
    nodes = federated_service.get_country_nodes()
    return [CountryNode(**node) for node in nodes]


@app.post("/federated/train-local", response_model=TrainLocalModelResponse)
def train_local_model(req: TrainLocalModelRequest):
    """Train a local model on country-specific synthetic data"""
    result = federated_service.train_local_model(req.country, req.epochs, req.learningRate)
    return TrainLocalModelResponse(**result)


@app.post("/federated/aggregate", response_model=FederatedAggregationResponse)
def aggregate_models(req: FederatedAggregationRequest):
    """Aggregate local model updates into a global model"""
    updates_dict = [update.dict() for update in req.updates]
    result = federated_service.aggregate_models(updates_dict, req.strategy)
    return FederatedAggregationResponse(**result)


@app.post("/federated/predict", response_model=PredictionResponse)
def predict(req: PredictionRequest):
    """Make prediction using global or local model"""
    result = federated_service.predict(req.features, req.useGlobalModel)
    return PredictionResponse(**result)


@app.get("/federated/status")
def get_federated_status():
    """Get current federated learning status"""
    return federated_service.get_status()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
