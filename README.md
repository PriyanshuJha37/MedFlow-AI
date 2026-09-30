# MedFlow - Healthcare Supply Chain Management System

## Overview

MedFlow is a comprehensive healthcare supply chain management system designed for Primary Health Centers (PHCs). It provides real-time monitoring, analytics, and decision support for medicine inventory, bed management, staff attendance, patient footfall, and emergency response. The system is built with a microservices architecture and includes a federated learning component for cross-border AI collaboration under the BRICS Resilience framework.

## Architecture

MedFlow follows a three-tier microservices architecture:

### 1. Analytics Service (Python/FastAPI)
- **Port**: 8000
- **Purpose**: Machine learning and analytics engine
- **Features**:
  - Demand forecasting
  - Stock-out risk prediction
  - Anomaly detection
  - Transfer recommendations
  - **Federated Learning** (BRICS AI collaboration)

### 2. Backend API (Node.js/Express/TypeScript)
- **Port**: 3000
- **Purpose**: REST API and business logic
- **Database**: PostgreSQL (via Prisma ORM)
- **Features**:
  - Authentication & authorization (JWT)
  - Role-based access control (Admin, PHC Staff)
  - Data aggregation across PHCs
  - Proxy to analytics service
  - Real-time dashboard data

### 3. Frontend (React/TypeScript/Vite)
- **Port**: 5173
- **Purpose**: User interface
- **Features**:
  - Admin dashboard with cross-PHC monitoring
  - Staff dashboard for individual PHC operations
  - Interactive maps (Leaflet)
  - Real-time alerts and suggestions
  - Responsive design with TailwindCSS

## Core Features

### Medicine Tracking
- Real-time inventory monitoring across all PHCs
- Stock-out alerts and risk assessment
- Medicine transfer recommendations between PHCs
- Historical consumption tracking

### Bed Management
- Bed occupancy tracking
- Real-time availability status
- Capacity planning and alerts

### Staff Management
- Attendance tracking
- On-duty staff monitoring
- Staff deployment optimization

### Patient Footfall
- Daily patient visit tracking
- Trend analysis and forecasting
- Peak hour identification

### Emergency Response
- Real-time emergency event logging
- Priority-based response coordination
- Resource allocation during emergencies

### Analytics & Forecasting
- Demand prediction using time-series models
- Anomaly detection in consumption patterns
- Transfer optimization recommendations
- Dengue outbreak simulation

## Federated AI - BRICS Resilience

### What is Federated Learning?

Federated Learning is a privacy-preserving machine learning approach where multiple parties train models on their local data without sharing the raw data. Instead, only model updates (weights/parameters) are shared with a central aggregator, which combines them into a shared global model.

### Why Federated Learning for Healthcare?

In healthcare, data privacy and sovereignty are critical:
- **Patient Privacy**: Sensitive patient data never leaves the country
- **Data Sovereignty**: Each country maintains control over its healthcare data
- **Regulatory Compliance**: Meets HIPAA, GDPR, and local data protection laws
- **Collaboration**: Enables cross-border AI collaboration without data sharing

### BRICS Federated Learning Implementation

#### Country Nodes
The system simulates 5 BRICS country nodes, each with synthetic healthcare data:
- **India**: 1.4B population, high base demand, moderate seasonality
- **Brazil**: 215M population, medium base demand, high seasonality
- **Russia**: 144M population, low base demand, low seasonality
- **China**: 1.4B population, very high base demand, moderate seasonality
- **South Africa**: 60M population, low base demand, high seasonality

#### Workflow

1. **Local Training**
   - Each country trains a model on its own healthcare data
   - Training happens locally - data never leaves the country
   - Model learns country-specific patterns (seasonality, population factors)

2. **Model Updates**
   - After training, each country sends only model parameters:
     - Weights (5 feature weights)
     - Bias
     - Number of training samples
     - Loss value
   - No raw patient data is transmitted

3. **Aggregation (FedAvg)**
   - Central aggregator receives updates from all countries
   - Uses Federated Averaging (FedAvg) algorithm:
     - Weighted average based on sample size
     - Larger countries have proportionally more influence
     - Creates a shared global model

4. **Global Model**
   - Combined model incorporates learnings from all countries
   - More robust and generalizable than any single country's model
   - Can be used for predictions across all participating countries

5. **Prediction**
   - Use global model to predict healthcare demand
   - Input features: temperature, humidity, population density, seasonal factor, historical demand
   - Output: Predicted demand for medicines/resources

#### Technical Implementation

**Analytics Service (`analytics/service/federated.py`)**:
- `FederatedLearningService` class manages the federated learning process
- `generate_synthetic_data()`: Creates country-specific synthetic healthcare data
- `train_local_model()`: Trains local model using gradient descent
- `aggregate_models()`: Implements FedAvg aggregation
- `predict()`: Makes predictions using global or local models

**API Endpoints**:
- `GET /federated/nodes`: Get information about all country nodes
- `POST /federated/train-local`: Train local model for a specific country
- `POST /federated/aggregate`: Aggregate local updates into global model
- `POST /federated/predict`: Make predictions using the global model
- `GET /federated/status`: Get current federated learning status

**Admin Dashboard (`frontend/src/pages/admin/FederatedLearning.tsx`)**:
- Visual interface for federated learning operations
- Train individual countries or all at once
- Monitor training progress and model metrics
- Aggregate models with one click
- Make predictions using the global model
- View global model weights and status

### Real-World Application

In a real BRICS healthcare scenario:
1. India trains on Indian patient data (stays in India)
2. Brazil trains on Brazilian patient data (stays in Brazil)
3. Russia, China, South Africa do the same
4. They share only model improvements (not data)
5. The combined model helps predict:
   - Disease outbreaks across regions
   - Medicine demand surges
   - Resource allocation needs
6. No sensitive patient data ever crosses borders

### Benefits for BRICS Resilience

- **Cross-Border Collaboration**: Enables AI collaboration without data sharing
- **Data Sovereignty**: Each country maintains control over its healthcare data
- **Improved Models**: Combined insights create more accurate predictions
- **Privacy Preservation**: Patient data remains local and private
- **Regulatory Compliance**: Meets international data protection standards

## How to Run

### Prerequisites
- Node.js 18+
- Python 3.9+
- PostgreSQL database

### Setup

1. **Install Dependencies**
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd frontend
   npm install

   # Analytics
   cd analytics
   pip install -r requirements.txt
   ```

2. **Configure Database**
   ```bash
   cd backend
   npx prisma generate
   npx prisma db push
   npm run seed
   ```

3. **Start Services**

   **Terminal 1 - Analytics Service**:
   ```bash
   cd analytics
   python main.py
   ```

   **Terminal 2 - Backend API**:
   ```bash
   cd backend
   npm run dev
   ```

   **Terminal 3 - Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

4. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - Analytics Service: http://localhost:8000

5. **Login Credentials**
   - Admin: username `admin`, password `admin123`
   - Staff: username `staff`, password `staff123`

## Project Structure

```
filebhai/
├── analytics/                 # Python/FastAPI analytics service
│   ├── main.py               # FastAPI app with endpoints
│   ├── models.py             # Pydantic models (including federated learning)
│   ├── service/
│   │   └── federated.py      # Federated learning implementation
│   └── requirements.txt
├── backend/                  # Node.js/Express backend API
│   ├── src/
│   │   ├── config.ts         # Configuration (analytics URL, etc.)
│   │   ├── index.ts          # Express app entry point
│   │   ├── routes/
│   │   │   ├── federated.ts  # Federated learning proxy routes
│   │   │   ├── admin/        # Admin dashboard routes
│   │   │   └── staff/        # Staff routes
│   │   └── prisma.ts         # Prisma client
│   └── prisma/
│       └── schema.prisma     # Database schema
├── frontend/                 # React/TypeScript frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   │   └── FederatedLearning.tsx  # Federated AI dashboard
│   │   │   └── staff/
│   │   ├── components/
│   │   └── api/
│   └── package.json
└── package.json              # Root package.json
```

## How Our Solution is Different

### 1. Federated Learning Integration
Most healthcare management systems use centralized AI where all data is sent to a cloud server. MedFlow implements federated learning, enabling:
- Privacy-preserving AI collaboration
- Cross-border model training without data sharing
- Compliance with data sovereignty regulations

### 2. BRICS Resilience Framework
Designed specifically for BRICS countries with:
- Multi-country node simulation
- Country-specific data patterns
- Cross-border AI collaboration
- Scalable to real-world deployment

### 3. Real-Time Analytics
Unlike traditional systems that use batch processing, MedFlow provides:
- Real-time inventory monitoring
- Live bed occupancy tracking
- Instant emergency response coordination
- On-demand forecasting

### 4. Comprehensive Supply Chain Management
Most systems focus on one aspect (e.g., just inventory). MedFlow integrates:
- Medicine tracking
- Bed management
- Staff attendance
- Patient footfall
- Emergency response
- Transfer optimization

### 5. Role-Based Access Control
Granular permissions for different user types:
- Admin: Cross-PHC monitoring and management
- Staff: Individual PHC operations
- Secure authentication with JWT

### 6. Simulation Capabilities
Built-in Dengue outbreak simulation for:
- Testing emergency response
- Evaluating resource allocation
- Training staff on crisis management

### 7. Modern Tech Stack
- Microservices architecture for scalability
- TypeScript for type safety
- React for responsive UI
- FastAPI for high-performance analytics
- Prisma for type-safe database access

## Future Enhancements

- Real BRICS country integration with actual healthcare data
- More sophisticated federated learning algorithms (FedProx, Scaffold)
- Blockchain for audit trail of model updates
- Mobile app for field staff
- Integration with national health databases
- AI-powered disease outbreak prediction
- Automated medicine procurement
- Telemedicine integration

## License

This project is developed for the BRICS Resilience hackathon demonstration.
