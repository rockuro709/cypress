pipeline {
    agent {
        kubernetes {
            yaml '''
apiVersion: v1
kind: Pod
spec:
  containers:
  # 1. Контейнер для сборки образов
  - name: kaniko
    image: gcr.io/kaniko-project/executor:debug
    command: ["sleep", "99d"]
    volumeMounts:
    - name: docker-config
      mountPath: /kaniko/.docker/
  # 2. Контейнер для общения с кластером (деплой)
  - name: kubectl
    image: roffe/kubectl:latest
    command: ["sleep", "99d"]
  # 3. Контейнер для запуска тестов
  - name: cypress
    image: cypress/included:13.6.0
    command: ["sleep", "99d"]
  volumes:
  - name: docker-config
    secret:
      secretName: docker-credentials
      items:
        - key: .dockerconfigjson
          path: config.json
'''
        }
    }
    
    stages {
        stage('Checkout App Repo') {
            steps {
                // Твой репозиторий с тестами Дженкинс скачивает сам по умолчанию.
                // А вот код приложения нам нужно скачать отдельно в папку 'app-source'
                dir('app-source') {
                    git branch: 'main', url: 'https://github.com/pavel-kazlou-innowise/titanic.git'
                }
            }
        }
        
        stage('Build and Push Images (Kaniko)') {
            steps {
                container('kaniko') {
                    // Собираем Auth
                    sh '''
                    /kaniko/executor --context `pwd`/app-source/auth_service \
                    --dockerfile `pwd`/app-source/auth_service/Dockerfile \
                    --destination antontratsevskii/titanic-auth:v1
                    '''
                    // Собираем Passenger
                    sh '''
                    /kaniko/executor --context `pwd`/app-source/passenger_service \
                    --dockerfile `pwd`/app-source/passenger_service/Dockerfile \
                    --destination antontratsevskii/titanic-passenger:v1
                    '''
                    // Собираем Stats
                    sh '''
                    /kaniko/executor --context `pwd`/app-source/statistics_service \
                    --dockerfile `pwd`/app-source/statistics_service/Dockerfile \
                    --destination antontratsevskii/titanic-stats:v1
                    '''
                    // Собираем Gateway
                    sh '''
                    /kaniko/executor --context `pwd`/app-source/api_gateway \
                    --dockerfile `pwd`/app-source/api_gateway/Dockerfile \
                    --destination antontratsevskii/titanic-gateway:v1
                    '''
                }
            }
        }
        
        stage('Deploy to Kubernetes') {
            steps {
                container('kubectl') {
                    sh 'kubectl apply -f k8s/main.yml'
                    
                    echo 'Waiting for all deployments to be ready...'
                    // Эта команда будет ждать до 2 минут, пока поды реально не запустятся
                    sh 'kubectl rollout status deployment/gateway-deployment --timeout=120s'
                    sh 'kubectl rollout status deployment/auth-deployment --timeout=120s'
                    
                    // Небольшой запас, чтобы само приложение внутри контейнера успело прогреться
                    sh 'sleep 15'
                }
            }
        }
        
        stage('Run Cypress Tests') {
            steps {
                container('cypress') {
                    // Устанавливаем зависимости и запускаем тесты
                    sh 'npm ci'
                    sh 'npx cypress run'
                }
            }
        }
    }
    
    post {
        always {
            // Просто сразу обращаемся к контейнеру
            container('kubectl') {
                echo 'Cleaning up Kubernetes resources...'
                sh 'kubectl delete -f k8s/main.yml --ignore-not-found=true'
            }
        }
    }
}