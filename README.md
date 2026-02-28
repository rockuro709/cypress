🚢 Titanic Microservices: Cloud-Native E2E Orchestration
📖 Project Overview
This project serves as an advanced Engineering Sandbox designed to explore and master the synergy between modern E2E testing frameworks, automated CI/CD pipelines, and cloud-native orchestration.

The core mission is to transition from traditional "localhost" testing to a Cloud-First approach. In this environment, a microservices-based application is fully containerized, dynamically deployed via Helm, and validated through automated scripts—all running within a Kubernetes cluster.

Why this architecture?
Infrastructure as Code (IaC): We replace manual setup with automated Helm templates that manage 4 separate microservices simultaneously.

DevOps Synergy: The pipeline doesn't just run tests; it builds production-ready images using Kaniko and manages the full application lifecycle.

Resource Reliability: By running within Kubernetes, we can strictly define environment needs—such as granting the Cypress runner 2Gi of RAM—ensuring that tests remain stable and immune to local machine resource fluctuations.

Cloud Portability: While this project can be run on a local machine (via Docker Desktop), its architecture is strictly cloud-agnostic. By simply changing the context to a remote VPS or a managed cloud provider (like AWS EKS or Google GKE), the entire ecosystem migrates seamlessly without changing a single line of code.

---

## 🛠 Tech Stack

* **Microservices**: 4 Python (FastAPI) services (Auth, Passenger, Stats, API Gateway).
* **Orchestration**: Kubernetes.
* **CI/CD**: Jenkins Declarative Pipeline.
* **Security-First Building**: [Kaniko](https://github.com/GoogleContainerTools/kaniko) for building Docker images inside K8s without needing a dangerous Docker socket.
* **End-to-End Testing**: Cypress (TypeScript).
* **Advanced Reporting**: Allure Report with persistent history and trend tracking.

---

## 🚀 Step-by-Step Setup Guide

Follow these instructions to replicate the entire environment on your local machine.

### 1. Environment Preparation

1. **Install Docker Desktop**: Download and install it from [docker.com](https://www.docker.com/).
2. **Enable Kubernetes**:
* Open Docker Desktop Settings.
* Go to **Kubernetes** tab.
* Check **Enable Kubernetes** and click **Apply & Restart**.


3. **Install kubectl**: Ensure you have the command-line tool by running `kubectl version` in your terminal.

### 2. Infrastructure Setup

1. **Create Namespace**:
```powershell
kubectl create namespace jenkins

```


2. **Configure Docker Credentials**:
Jenkins needs permission to push images to your Docker Hub. Create a K8s secret:
```powershell
kubectl create secret generic docker-credentials `
  --from-file=.dockerconfigjson=$HOME/.docker/config.json `
  --type=kubernetes.io/dockerconfigjson -n jenkins

```



### 3. Deploy & Access Jenkins

1. **Deploy Jenkins**: Apply your Jenkins manifests (assumes you have a `jenkins.yml`).
2. **Establish Connection**:
Open a **PowerShell** window and keep it running:
```powershell
kubectl --namespace jenkins port-forward svc/my-jenkins 8080:8080

```


*Note: If Jenkins restarts, this connection will drop and must be restarted*.
3. **Login**: Open `http://localhost:8080` in your browser.

### 4. Jenkins Configuration

1. **Install Plugins**: Go to *Manage Jenkins -> Plugins* and install:
* `Kubernetes`
* `HTML Publisher`
* `Copy Artifact`


2. **Global Tools**: Go to *Manage Jenkins -> Tools*. Add an Allure Commandline tool named **`allure`**.

---

## 🏗 Pipeline Logic

The `Jenkinsfile` automates the following:

1. **Checkout**: Pulls the application code and test suite.
2. **Kaniko Build**: Builds the images and tags them (e.g., `titanic-auth:v1`).
3. **K8s Deploy**: Applies `k8s/main.yml` and waits for the `gateway` to be ready.
4. **Cypress Execution**: Runs the tests using `--env allure=true` to generate raw data.
5. **Allure Reporting**:
* Uses `Copy Artifact` to pull history from the previous build.
* Generates a fresh HTML report with `npx allure-commandline`.
* Publishes the report to the Jenkins UI via `htmlPublisher`.



---

Old version of README:
# 🚢 Titanic Microservices: CI/CD Pipeline with Cypress & Allure

A production-ready automation project demonstrating the full lifecycle of a microservices application within a Kubernetes cluster. This project covers everything from container image building to automated API testing and persistent reporting.

## 🛠 Tech Stack

* **Application**: Python (FastAPI) microservices.
* **CI/CD**: Jenkins Declarative Pipeline (Dynamic Kubernetes Agents).
* **Containerization**: [Kaniko](https://github.com/GoogleContainerTools/kaniko) (Building Docker images inside K8s without root privileges).
* **Orchestration**: Kubernetes (Deployments & Services).
* **Testing**: Cypress (TypeScript) for E2E API Validation.
* **Reporting**: Allure Report (Custom implementation with history and trends).

## 🚀 Pipeline Architecture

The pipeline is organized into several critical stages to ensure stability:
1.  **Checkout SCM**: Clones the application and testing repositories.
2.  **Build & Push (Kaniko)**: Builds 4 separate microservice images and pushes them to Docker Hub.
3.  **Deploy to K8s**: Deploys the infrastructure using `kubectl apply`.
4.  **Cypress Tests**: Runs tests in a dedicated container with **2Gi RAM** to prevent memory crashes.
5.  **Post Actions (Allure Reporting)**: 
    * Validates `allure-results` existence.
    * Fetches history from previous builds using the `Copy Artifact` plugin.
    * Generates a static HTML report using `npx allure-commandline`.
    * Publishes the report via `htmlPublisher`.

![Jenkins Pipeline View](path/to/image_216000.png)
*Pipeline execution overview with 100% success rate.*

## 📊 Testing Insights

The Allure integration provides:
* **Trend Analysis**: Visual tracking of test stability over time.
* **Detailed Execution**: Step-by-step API request/response logs.
* **History**: Persistent results across multiple builds.

![Allure Dashboard](path/to/image_215ffb.png)

## 🔧 Prerequisites

1.  **Kubernetes Secrets**: Create a `docker-credentials` secret with your Docker Hub auth.
2.  **Jenkins Plugins**: Ensure `Kubernetes`, `HTML Publisher`, and `Copy Artifact` are installed.
3.  **Memory**: Ensure your K8s node has at least 4GB of free RAM to support the Cypress browser.
