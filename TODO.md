## 📝 Roadmap & TODO

* [ ] **Setup Validation**: Perform a clean "from scratch" deployment on a fresh machine following the **Local Reproduction Guide** to ensure 100% reproducibility.
* [ ] **Pipeline Optimization**: Audit the source code and test suites to identify and eliminate arbitrary `sleep` commands, replacing them with dynamic polling or proper synchronization logic.
* [ ] **Collaborator Verification**: Validate the **Zero-Local-Setup** model by pushing test code from a secondary workstation and triggering the pipeline without installing local infrastructure.
* [ ] **AI Integration**: Implement **Google Gemini API** integration to automatically analyze Allure reports and provide root-cause analysis for test failures.
* [ ] **Test Suite Expansion**: Significantly increase E2E and integration test coverage to validate complex edge cases across all microservices.
* [ ] **Test Architecture Refactoring**: Decouple the monolithic `api.cy.ts` into a layered architecture, implementing **Page Object Model (POM)**, dedicated **Service Layers**, and externalized **Test Data** management for better maintainability.
* [ ] **Full-Stack Evolution**: Develop a modern **Frontend** for the Titanic application to transition it from a collection of APIs into a complete, user-facing web experience.
* [ ] **Code Documentation (Optional)**: Conduct a comprehensive documentation pass, adding detailed comments to complex logic blocks within the pipeline and test framework.
