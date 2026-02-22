const { defineConfig } = require("cypress");
const { allureCypress } = require("allure-cypress/reporter");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:8000",
    setupNodeEvents(on, config) {
      // Инициализация Allure
      allureCypress(on, config, {
        resultsDir: "allure-results",
      });

      // ХУК ДЛЯ СТАБИЛЬНОСТИ В KUBERNETES/DOCKER
      on("before:browser:launch", (browser = {}, launchOptions) => {
        // Если запускается Chrome или Electron (Chromium-based)
        if (browser.family === "chromium" && browser.name !== "electron") {
          launchOptions.args.push("--no-sandbox");
          launchOptions.args.push("--disable-dev-shm-usage");
          launchOptions.args.push("--disable-gpu");
        }

        // Для Electron настройки задаются чуть иначе
        if (browser.name === "electron") {
          launchOptions.preferences.width = 1280;
          launchOptions.preferences.height = 720;
        }

        return launchOptions;
      });

      return config;
    },
  },
});
