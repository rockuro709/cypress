import { defineConfig } from "cypress";
import { allureCypress } from "allure-cypress/reporter";

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:8000', // Локальный адрес для ручного запуска
    setupNodeEvents(on, config) {
      // Подключаем Allure плагин
      allureCypress(on, config, {
        resultsDir: "allure-results",
      });
      return config;
    },
  },
});