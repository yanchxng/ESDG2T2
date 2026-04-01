# ESDG2T2 - MediLink

## How to Run the Project

This project consists of a microservices backend managed by Docker Compose and a React frontend.

### Prerequisites
- Docker and Docker Compose
- Node.js and npm

### 1. Start the Backend Services
The backend is composed of several microservices, a PostgreSQL database, and RabbitMQ. You can run all of them together using Docker Compose.

Open a terminal in the root directory and run:
```bash
docker-compose up --build
```
This will build and start all the necessary backend containers.

### 2. Start the Frontend
The frontend is a React application built with Vite.

Open a second terminal, navigate to the `frontend` directory, install the dependencies, and start the development server:
```bash
cd frontend
npm install
npm run dev
```
The frontend should now be running and accessible via your browser (typically at `http://localhost:5173`).

