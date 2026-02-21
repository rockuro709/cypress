pipeline {
    agent any // Запускаем на любой доступной ноде Jenkins

    environment {
        // Указываем репозиторий приложения
        APP_REPO = 'https://github.com/pavel-kazlou-innowise/titanic.git'
    }

    stages {
        stage('Checkout App Repo') {
            steps {
                // Jenkins автоматически скачивает твой репо (cypress) в корень.
                // А код приложения мы скачаем в отдельную папку 'app-source'
                dir('app-source') {
                    git url: "${APP_REPO}", branch: 'main'
                }
            }
        }

        stage('Build Docker Images') {
            steps {
                // Заходим в папку с приложением и собираем образы
                dir('app-source') {
                    bat 'docker build -t titanic-auth:v1 ./auth_service'
                    bat 'docker build -t titanic-passenger:v1 ./passenger_service'
                    bat 'docker build -t titanic-stats:v1 ./statistics_service'
                    bat 'docker build -t titanic-gateway:v1 ./api_gateway'
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                // Файл k8s/main.yml лежит в твоем репозитории, применяем его
                bat 'kubectl apply -f k8s/main.yml'
                
                // Даем подам время на запуск (можно заменить на умный wait)
                sleep time: 30, unit: 'SECONDS'
            }
        }

        stage('Run Cypress Tests') {
            steps {
                // Устанавливаем зависимости Cypress и запускаем тесты
                // (Предполагается, что тесты стучатся на localhost:8000)
                bat 'npm ci'
                bat 'npx cypress run'
            }
        }
    }

    post {
        always {
            // Этот блок выполнится ВСЕГДА: и если тесты прошли, и если упали.
            // Убираем за собой мусор в Kubernetes.
            echo 'Cleaning up Kubernetes resources...'
            bat 'kubectl delete -f k8s/main.yml --ignore-not-found=true'
        }
    }
}