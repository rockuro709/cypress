pipeline {
    agent {
        kubernetes {
            yaml '''
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: cleanup-tool
    image: curlimages/curl:latest
    command: ["sleep", "99d"]
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
    image: dtzar/helm-kubectl:latest
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
                    sh "/kaniko/executor --context `pwd`/app-source/auth_service --dockerfile `pwd`/app-source/auth_service/Dockerfile --destination antontratsevskii/titanic-auth:${env.BUILD_NUMBER}"
                }
                container('kaniko-passenger') {
                    sh "/kaniko/executor --context `pwd`/app-source/passenger_service --dockerfile `pwd`/app-source/passenger_service/Dockerfile --destination antontratsevskii/titanic-passenger:${env.BUILD_NUMBER}"
                }
                container('kaniko-stats') {
                    sh "/kaniko/executor --context `pwd`/app-source/statistics_service --dockerfile `pwd`/app-source/statistics_service/Dockerfile --destination antontratsevskii/titanic-stats:${env.BUILD_NUMBER}"
                }
                container('kaniko-gateway') {
                    sh "/kaniko/executor --context `pwd`/app-source/api_gateway --dockerfile `pwd`/app-source/api_gateway/Dockerfile --destination antontratsevskii/titanic-gateway:${env.BUILD_NUMBER}"
                }
            }
        }
        
        stage('Deploy to Kubernetes (Helm)') {
            steps {
                container('kubectl') {
                    sh """
                        helm upgrade --install titanic-release ./charts/titanic \
                        --namespace jenkins \
                        --set image.tag=${env.BUILD_NUMBER} \
                        --wait
                    """
                }
            }
        }
        
        stage('Run Cypress Tests') {
            steps {
                container('cypress') {
                    sh '''
                        npm install
                        CYPRESS_BASE_URL=http://gateway-service:8000 npx cypress run --browser electron --env allure=true --config video=false,screenshotOnRunFailure=false
                    '''
                }
            }
        }

        stage('Cleanup Docker Hub Tags') {
            when {
                expression { currentBuild.currentResult == 'SUCCESS' }
            }
            steps {
                container('cleanup-tool') {
                    withCredentials([string(credentialsId: 'DOCKER_HUB_TOKEN', variable: 'PAT')]) {
                        script {
                            def repos = ['titanic-auth', 'titanic-passenger', 'titanic-stats', 'titanic-gateway']
                            def username = 'antontratsevskii'
                            
                            def jwt = sh(
                                script: """
                                    curl -s -H "Content-Type: application/json" -X POST \
                                    -d '{"username": "${username}", "password": "'"\$PAT"'"}' \
                                    https://hub.docker.com/v2/users/login/ | sed -e 's/.*"token":"\\([^"]*\\)".*/\\1/'
                                """,
                                returnStdout: true
                            ).trim()

                            if (!jwt || jwt.contains("login")) {
                                error "Failed to obtain JWT token. Check if DOCKER_HUB_TOKEN is correct."
                            }

                            repos.each { repoName ->
                                echo "Processing repository: ${repoName}"
                                sh """
                                    TAGS=\$(curl -s -H "Authorization: JWT ${jwt}" "https://hub.docker.com/v2/repositories/${username}/${repoName}/tags/?page_size=100" | grep -oP '"name":\\s*"\\K[^"]+')
                                    
                                    COUNT=0
                                    for TAG in \$TAGS; do
                                        COUNT=\$((COUNT+1))
                                        if [ \$COUNT -le 8 ]; then
                                            echo "Keeping tag: \$TAG"
                                        else
                                            echo "Deleting old tag: \$TAG"
                                            curl -s -X DELETE -H "Authorization: JWT ${jwt}" "https://hub.docker.com/v2/repositories/${username}/${repoName}/tags/\$TAG/"
                                        fi
                                    done
                                """
                            }
                        }
                    }
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
                    
                    echo 'Fetching Allure history from previous build...'
                    try {
                        copyArtifacts(
                            projectName: env.JOB_NAME,     
                            selector: lastCompleted(),    
                            filter: 'allure-report/history/**', 
                            optional: true                 
                        )
                        
                        sh '''
                            if [ -d "allure-report/history" ]; then
                                echo "History found! Copying to allure-results..."
                                cp -a allure-report/history allure-results/
                            else
                                echo "No history found. Skipping."
                            fi
                        '''
                    } catch (Exception e) {
                        echo "Warning: Failed to copy history. (Check if Copy Artifact plugin is installed): ${e.getMessage()}"
                    }

                    echo "Generating Allure report..."
                    sh 'npx allure-commandline generate allure-results --clean -o allure-report'
                }
            }
            
            archiveArtifacts artifacts: 'allure-report/**', allowEmptyArchive: true
            
            publishHTML(target: [
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'allure-report',
                reportFiles: 'index.html',
                reportName: '📊 Allure Report'
            ])
            
            container('kubectl') {
                echo 'Cleaning up environment via Helm...'
                sh 'helm uninstall titanic-release --namespace jenkins || true'
            }
        }
    }
}