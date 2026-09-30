import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

interface CountryNode {
  country: string;
  dataPoints: number;
  features: string[];
}

interface LocalModelUpdate {
  country: string;
  weights: number[];
  bias: number;
  samples: number;
  loss: number;
}

interface FederatedStatus {
  round: number;
  globalWeights: number[];
  globalBias: number;
  participatingCountries: string[];
  localModels: Record<string, LocalModelUpdate>;
}

const FederatedLearning: React.FC = () => {
  const [nodes, setNodes] = useState<CountryNode[]>([]);
  const [status, setStatus] = useState<FederatedStatus | null>(null);
  const [training, setTraining] = useState<Record<string, boolean>>({});
  const [aggregating, setAggregating] = useState(false);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [predictionFeatures, setPredictionFeatures] = useState<number[]>([0, 0, 0, 0, 0]);

  const fetchNodes = async () => {
    try {
      const res = await apiClient.get<CountryNode[]>('/federated/nodes');
      setNodes(res.data);
    } catch (error) {
      console.error('Failed to fetch nodes:', error);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await apiClient.get<FederatedStatus>('/federated/status');
      setStatus(res.data);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  };

  useEffect(() => {
    fetchNodes();
    fetchStatus();
  }, []);

  const trainLocalModel = async (country: string) => {
    setTraining(prev => ({ ...prev, [country]: true }));
    try {
      await apiClient.post('/federated/train-local', {
        country,
        epochs: 10,
        learningRate: 0.01,
      });
      await fetchStatus();
    } catch (error) {
      console.error(`Failed to train model for ${country}:`, error);
    } finally {
      setTraining(prev => ({ ...prev, [country]: false }));
    }
  };

  const aggregateModels = async () => {
    if (!status || !status.localModels) return;
    
    setAggregating(true);
    try {
      const updates = Object.values(status.localModels).map(model => ({
        country: model.country,
        weights: model.weights,
        bias: model.bias,
        samples: model.samples,
        loss: model.loss,
      }));
      
      await apiClient.post('/federated/aggregate', {
        updates,
        strategy: 'fedavg',
      });
      await fetchStatus();
    } catch (error) {
      console.error('Failed to aggregate models:', error);
    } finally {
      setAggregating(false);
    }
  };

  const makePrediction = async () => {
    try {
      const res = await apiClient.post('/federated/predict', {
        features: predictionFeatures,
        useGlobalModel: true,
      });
      setPrediction(res.data.prediction);
    } catch (error) {
      console.error('Failed to make prediction:', error);
    }
  };

  const trainAllCountries = async () => {
    for (const node of nodes) {
      await trainLocalModel(node.country);
    }
  };

  const canAggregate = status && status.localModels && Object.keys(status.localModels).length > 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Federated Learning</h1>
        <p className="text-gray-600 mt-1">BRICS Resilience - Cross-country AI model training</p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-500">Current Round</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">{status?.round ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-500">Participating Countries</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">{status?.participatingCountries.length ?? 0}/5</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-500">Global Model Bias</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">{status?.globalBias.toFixed(4) ?? 'N/A'}</p>
        </div>
      </div>

      {/* Country Nodes */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">BRICS Country Nodes</h2>
          <button
            onClick={trainAllCountries}
            disabled={Object.values(training).some(t => t)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
          >
            {Object.values(training).some(t => t) ? 'Training...' : 'Train All Countries'}
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nodes.map((node) => (
            <div key={node.country} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{node.country}</h3>
                {status?.localModels?.[node.country] && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Trained</span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-3">{node.dataPoints.toLocaleString()} data points</p>
              <button
                onClick={() => trainLocalModel(node.country)}
                disabled={training[node.country]}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
              >
                {training[node.country] ? 'Training...' : 'Train Local Model'}
              </button>
              {status?.localModels?.[node.country] && (
                <div className="mt-3 text-xs text-gray-600">
                  <p>Loss: {status.localModels[node.country].loss.toFixed(4)}</p>
                  <p>Samples: {status.localModels[node.country].samples}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Aggregation */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Model Aggregation</h2>
        <p className="text-sm text-gray-600 mb-4">
          Aggregate local model updates from all trained countries into a shared global model using FedAvg.
        </p>
        <button
          onClick={aggregateModels}
          disabled={!canAggregate || aggregating}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          {aggregating ? 'Aggregating...' : 'Aggregate Models'}
        </button>
        {status && status.round > 0 && (
          <p className="text-sm text-gray-600 mt-3">
            Global model has been updated {status.round} time(s).
          </p>
        )}
      </div>

      {/* Prediction */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Make Prediction</h2>
        <p className="text-sm text-gray-600 mb-4">
          Use the global federated model to make predictions on healthcare demand.
        </p>
        <div className="grid grid-cols-5 gap-2 mb-4">
          {predictionFeatures.map((value, index) => (
            <div key={index}>
              <label className="text-xs text-gray-600 block mb-1">Feature {index + 1}</label>
              <input
                type="number"
                value={value}
                onChange={(e) => {
                  const newFeatures = [...predictionFeatures];
                  newFeatures[index] = parseFloat(e.target.value) || 0;
                  setPredictionFeatures(newFeatures);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                step="0.1"
              />
            </div>
          ))}
        </div>
        <button
          onClick={makePrediction}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
        >
          Predict
        </button>
        {prediction !== null && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Predicted Demand:</p>
            <p className="text-2xl font-bold text-gray-900">{prediction.toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* Global Model Info */}
      {status?.globalWeights && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Global Model Weights</h2>
          <div className="grid grid-cols-5 gap-2">
            {status.globalWeights.map((weight, index) => (
              <div key={index} className="text-center p-2 bg-gray-50 rounded">
                <p className="text-xs text-gray-600">W{index}</p>
                <p className="font-semibold text-gray-900">{weight.toFixed(4)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FederatedLearning;
