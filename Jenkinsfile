pipeline {
    agent {
        kubernetes {
            yaml '''
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: kaniko-auth
    image: gcr.io/kaniko-project/executor:debug
    command: ["sleep", "99d"]
    volumeMounts:
    - name: docker-config
      mountPath: /kaniko/.docker/
  - name: kaniko-passenger
    image: gcr.io/kaniko-project/executor:debug
    command: ["sleep", "99d"]
    volumeMounts:
    - name: docker-config
      mountPath: /kaniko/.docker/
  - name: kaniko-stats
    image: gcr.io/kaniko-project/executor:debug
    command: ["sleep", "99d"]
    volumeMounts:
    - name: docker-config
      mountPath: /kaniko/.docker/
  - name: kaniko-gateway
    image: gcr.io/kaniko-project/executor:debug
    command: ["sleep", "99d"]
    volumeMounts:
    - name: docker-config
      mountPath: /kaniko/.docker/
  - name: kubectl
    image: roffe/kubectl:latest
    command: ["sleep", "99d"]
  - name: cypress
    image: cypress/included:13.6.0
    command: ["sleep", "99d"]
    resources:
      requests:
        memory: "2Gi"  
        cpu: "1000m"
      limits:
        memory: "2Gi"
        cpu: "1000m"
  - name: allure-gen
    image: timbru31/java-node:11-18
    command: ["sleep", "99d"]
    volumeMounts:
    - mountPath: /home/jenkins/agent
      name: workspace-volume
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
                dir('app-source') {
                    git branch: 'main', url: 'https://github.com/pavel-kazlou-innowise/titanic.git'
                }
            }
        }
        
        stage('Build and Push Images (Kaniko)') {
            steps {
                container('kaniko-auth') {
                    sh '/kaniko/executor --context `pwd`/app-source/auth_service --dockerfile `pwd`/app-source/auth_service/Dockerfile --destination antontratsevskii/titanic-auth:v1'
                }
                container('kaniko-passenger') {
                    sh '/kaniko/executor --context `pwd`/app-source/passenger_service --dockerfile `pwd`/app-source/passenger_service/Dockerfile --destination antontratsevskii/titanic-passenger:v1'
                }
                container('kaniko-stats') {
                    sh '/kaniko/executor --context `pwd`/app-source/statistics_service --dockerfile `pwd`/app-source/statistics_service/Dockerfile --destination antontratsevskii/titanic-stats:v1'
                }
                container('kaniko-gateway') {
                    sh '/kaniko/executor --context `pwd`/app-source/api_gateway --dockerfile `pwd`/app-source/api_gateway/Dockerfile --destination antontratsevskii/titanic-gateway:v1'
                }
            }
        }
        
        stage('Deploy to Kubernetes') {
            steps {
                container('kubectl') {
                    sh 'kubectl apply -f k8s/main.yml'
                    echo 'Waiting for gateway...'
                    sh 'kubectl rollout status deployment/gateway-deployment'
                }
            }
        }
        
        stage('Run Cypress Tests') {
            steps {
                container('cypress') {
                    sh '''
                        npm install
                        CYPRESS_BASE_URL=http://gateway:8000 npx cypress run --browser electron --env allure=true --config video=false,screenshotOnRunFailure=false
                    '''
                }
            }
        }
    }
    
    post {
        always {
            container('allure-gen') {
                script {
                    echo 'Checking allure-results directory...'
                    sh 'ls -la allure-results || true'
                    
                    echo "Generating Allure report..."
                    sh 'npx allure-commandline generate allure-results --clean -o allure-report'
                }
            }
            
            archiveArtifacts artifacts: 'allure-report/**', allowEmptyArchive: true
            
            container('kubectl') {
                echo 'Cleaning up Kubernetes resources...'
                sh 'kubectl delete -f k8s/main.yml --ignore-not-found=true'
            }
        }
    }
}