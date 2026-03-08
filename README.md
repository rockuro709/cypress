# 🚢 Titanic Microservices: Cloud-Native E2E Orchestration

## 📖 Project Overview

This project serves as an advanced **Engineering Sandbox** designed to explore and master the synergy between modern E2E testing frameworks, automated CI/CD pipelines, and cloud-native orchestration.

The core mission is to transition from traditional "localhost" testing to a **Cloud-First approach**. In this environment, a microservices-based application is fully containerized, dynamically deployed via Helm, and validated through automated scripts - all running within a Kubernetes cluster.

### Why this architecture?

* **Infrastructure as Code (IaC)**: We replace manual setup with automated Helm templates that manage 4 separate microservices simultaneously.
* **DevOps Synergy**: The pipeline doesn't just run tests; it builds production-ready images using **Kaniko** and manages the full application lifecycle.
* **Resource Reliability**: By running within Kubernetes, we can strictly define environment needs - such as granting the Cypress runner **2Gi of RAM** - ensuring that tests remain stable and immune to local machine resource fluctuations.
* **Cloud Portability**: While this project can be run on a local machine (via Docker Desktop), its architecture is strictly **cloud-agnostic**. By simply changing the context to a remote VPS or a managed cloud provider (like AWS EKS or Google GKE), the entire ecosystem migrates seamlessly without changing a single line of code.

---

## ⚙️ Automated Pipeline Lifecycle (How it Works)

This project implements a fully automated, end-to-end workflow. Once a developer pushes new code or tests, the following sequence is triggered:

1. **Trigger & SCM Sync**: The process begins by clicking **"Build Now"** in Jenkins. The pipeline immediately performs a dual checkout, pulling the latest microservices source code from the [App Repository](https://github.com/pavel-kazlou-innowise/titanic) and the test suites from the [Automation Repository](https://github.com/rockuro709/cypress).
2. **Containerization (Kaniko)**: Jenkins initiates the **Build and Push** stage. Using **Kaniko**, the system builds Docker images for all four microservices (Auth, Passenger, Stats, Gateway) directly within the Kubernetes cluster and pushes them to **Docker Hub** with unique build-specific tags.
3. **Cloud-Native Orchestration (Helm)**: The **Deploy** stage uses **Helm v3** to template Kubernetes manifests. It dynamically injects the new image tags and deploys the entire application stack into a dedicated namespace, ensuring proper **Service Discovery** via internal DNS (e.g., `http://gateway-service:8000`).
4. **Automated Validation (Cypress)**: Once the environment is ready, a specialized **Cypress pod** is launched to run the E2E API test suites against the deployed services.
5. **Analytics & Reporting (Allure)**: After test execution, the **allure-gen** container processes the results, fetches historical data from previous runs, and generates a comprehensive **Allure Report** with trend visualizations.
6. **Environment Decommissioning**: To maintain a "Zero-Waste" infrastructure, the `post-build` stage executes a **Helm uninstall**, completely removing the application pods and services from the cluster.
7. **Registry Pruning**: Finally, the pipeline connects to the **Docker Hub API** to delete obsolete image tags, keeping only the 8 most recent versions to optimize cloud storage and maintain registry hygiene.

---

### 🛠 Full Technology Stack Reference

#### 1. Application Layer (The "Titanic" App)

* **Language**: Python.
* **Framework**: FastAPI.
* **Architecture**: Microservices (Auth, Passenger, Statistics, API Gateway).
* **App Repository**: [pavel-kazlou-innowise/titanic](https://github.com/pavel-kazlou-innowise/titanic) (The target for our CI/CD pipeline).

#### 2. Infrastructure & Orchestration

* **Orchestrator**: **Kubernetes (K8s)** - manages the lifecycle of the services and test agents.
* **Local Cluster**: **Docker Desktop** (with K8s enabled) - the environment where the project is developed and verified.
* **Infrastructure as Code (IaC)**: **Helm v3** is used to template Kubernetes manifests and manage the entire microservices stack as a single, versioned deployment unit.

#### 3. CI/CD Pipeline (The Automation Engine)

* **CI/CD Tool**: **Jenkins** (Declarative Pipeline).
* **Build Tool**: **Kaniko** - securely builds and pushes Docker images to Docker Hub directly from the K8s cluster.
* **Agent Management**: **Kubernetes Plugin** for Jenkins - dynamically spins up pods to execute build stages.
* **Image Registry**: **Docker Hub** - stores built microservice images (e.g., `titanic-auth:51`).

#### 4. Automated Testing Framework

* **Framework**: **Cypress**.
* **Language**: **TypeScript (TS)**.
* **Environment**: **Node.js** (runtime) and **npm** (package management).

#### 5. Quality Assurance & Reporting

* **Reporting Engine**: **Allure Report 2**.
* **History Tracking**: **Copy Artifact Plugin** - allows Allure to display trends and historical data across multiple builds.
* **Reporting Tooling**: `allure-commandline` (via `npx`).

#### 6. Essential Tools & CLI

* **`kubectl`**: Kubernetes command-line tool.
* **`helm`**: Helm CLI for managing charts.
* **Git**: Version control for both the app and the test infrastructure.

---

# 🚀 Local Reproduction Guide

## 📋 Prerequisites

1. **Docker Desktop**: [Download and install](https://www.docker.com/products/docker-desktop/).
2. **Enable Kubernetes**:
* Go to **Settings** -> **Kubernetes**.
* Check **Enable Kubernetes** and click **Apply & Restart**.


3. **CLI Tools**: Ensure `kubectl` and `helm` are installed and available in your terminal.

---

## 🛠 Step 1: Infrastructure & Registry Security

### 1. Create the Namespace

Isolate the CI/CD environment from the rest of the cluster:

```powershell
kubectl create namespace jenkins

```

### 2. Configure Docker Hub Secret

To allow **Kaniko** to push images and the **Cleanup Stage** to manage your registry, create the registry secret using your credentials (username, Personal Access Token, and email):

```powershell
kubectl create secret docker-registry docker-credentials `
  --docker-server=https://index.docker.io/v1/ `
  --docker-username=<YOUR_USERNAME> `
  --docker-password=<YOUR_ACCESS_TOKEN> `
  --docker-email=<YOUR_EMAIL> `
  -n jenkins

```

---

## 🏗 Step 2: Accessing Jenkins

### 1. Ensure Jenkins is Running

Verify that the Jenkins controller is active in your cluster:

```powershell
kubectl get pods -n jenkins

```

### 2. Establish the Tunnel (Port Forwarding)

Because Jenkins runs inside the cluster, use the following command to access the web interface from your browser:

```powershell
kubectl --namespace jenkins port-forward svc/my-jenkins 8080:8080 --address 0.0.0.0

```

* **Access URL**: [http://localhost:8080](https://www.google.com/search?q=http://localhost:8080)
* **Important**: Keep this terminal window open; closing it will drop the connection to Jenkins.

---

## ⚙️ Step 3: Jenkins Final Configuration

### 1. Required Plugins

Install the following via *Manage Jenkins -> Plugins* to support the pipeline and custom reporting:

* **Kubernetes**: Powers dynamic build agents.
* **HTML Publisher**: Essential for viewing the Allure Report index.
* **Copy Artifact**: Required to fetch history from previous builds for the reporting "Trend" chart.

### 2. Secure Credentials for Cleanup

To enable automated Docker Hub tag pruning:

1. Go to *Manage Jenkins -> Credentials -> (global) -> Add Credentials*.
2. **Kind**: Secret text.
3. **Secret**: Your Docker Hub Personal Access Token (PAT).
4. **ID**: `DOCKER_HUB_TOKEN`.

---

## 🚢 Step 4: Run the Pipeline

1. Create a new **Pipeline** job.
2. In **Pipeline Definition**, choose **Pipeline script from SCM**.
3. **Repository URL**: `https://github.com/rockuro709/cypress`.
4. Click **Build Now**.

---

## 📊 Custom Allure Reporting Workaround

Since the standard Allure plugin is bypassed, the pipeline uses a custom `post { always { ... } }` logic to generate reports manually:

1. **allure-gen Container**: Runs inside a Java/Node environment (`timbru31/java-node`).
2. **History Injection**: The `copyArtifacts` plugin pulls `allure-report/history/**` from the last completed build into the current workspace.
3. **CLI Generation**: Runs `npx allure-commandline generate` to build a static HTML report.
4. **Publication**: The `publishHTML` plugin renders the report directly in the Jenkins UI sidebar as **"📊 Allure Report"**.

---

## 🧹 Step 5: Storage Maintenance

While the cloud registry is cleaned via API, local image layers may accumulate in Docker Desktop. To optimize local disk space, run:

```powershell
docker image prune -a -f --filter "until=48h"

```

*This removes build artifacts older than 48 hours*.

---

## ☁️ Shared Private Cloud Model

One of the primary advantages of this architecture is its **"Zero-Local-Setup"** requirement for other team members. This machine functions as a **self-hosted cloud provider**, allowing other QA engineers to utilize the full power of the infrastructure without installing Docker, Kubernetes, or Helm on their own workstations.

---
