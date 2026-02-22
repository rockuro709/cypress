# 🎯 Project Roadmap & Improvements

### Infrastructure & Orchestration
- [ ] **Helm Integration**: Migrating from static YAML files to Helm Charts for better environment management.
- [ ] **Namespaces**: Isolate test environments by deploying each build to a unique Kubernetes Namespace.
* [ ] **Network Policies**: Implement K8s NetworkPolicies to secure service-to-service communication.

### Build & Security
- [ ] **Vulnerability Scanning**: Integrate **Trivy** to scan Docker images before pushing to the registry.
- [ ] **Kaniko Caching**: Enable layer caching in Kaniko to reduce build times for Python dependencies.

### Testing & Optimization
- [ ] **Parallel Execution**: Split Cypress tests into multiple pods for faster execution.
- [ ] **Notification System**: Add Slack or Telegram webhooks to notify the team of build failures.
- [ ] **Smoke Suite**: Define a subset of critical tests to run before the full E2E suite.
