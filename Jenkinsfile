pipeline {
    agent any

    environment {
        FRONTEND_IMAGE = "webcup-frontend"
        FRONTEND_PORT = 8690
        DOCKER_TAG      = "latest"

        FTP_HOST        = "tnr1.hodi.host"
        FTP_REMOTE_DIR  = "/public_html"

        DEPLOY_DIR      = "${WORKSPACE}/deploy"
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 20, unit: 'MINUTES')
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Frontend') {
            when {
                branch 'frontend'
            }

            steps {
                sh '''
                    set -eu

                    docker build \
                        --pull \
                        -t "$FRONTEND_IMAGE:$DOCKER_TAG" \
                        -f frontend/Dockerfile .
                '''
            }
        }

        stage('Test Frontend') {
            when {
                branch 'frontend'
            }

            steps {
                sh '''
                    set -eu

                    docker rm -f webcup-frontend-test >/dev/null 2>&1 || true

                    docker run -d \
                        --name webcup-frontend-test \
                        -p 127.0.0.1:${FRONTEND_PORT}:80 \
                        "$FRONTEND_IMAGE:$DOCKER_TAG"

                    for i in 1 2 3 4 5; do
                        if curl -fsS http://127.0.0.1:${FRONTEND_PORT}/ >/dev/null; then
                            echo "Frontend OK"
                            exit 0
                        fi

                        sleep 2
                    done

                    echo "Frontend indisponible"
                    docker logs webcup-frontend-test
                    exit 1
                '''
            }

            post {
                always {
                    sh '''
                        docker rm -f webcup-frontend-test \
                            >/dev/null 2>&1 || true
                    '''
                }
            }
        }

        stage('Extract Build') {
            when {
                branch 'frontend'
            }

            steps {
                sh '''
                    set -eu

                    rm -rf "$DEPLOY_DIR"
                    mkdir -p "$DEPLOY_DIR"

                    docker rm -f webcup-frontend-extract \
                        >/dev/null 2>&1 || true

                    docker create \
                        --name webcup-frontend-extract \
                        "$FRONTEND_IMAGE:$DOCKER_TAG"

                    docker cp \
                        webcup-frontend-extract:/usr/share/nginx/html/. \
                        "$DEPLOY_DIR/"

                    docker rm webcup-frontend-extract

                    echo "Contenu du build :"
                    find "$DEPLOY_DIR" -maxdepth 2 -type f
                '''
            }
        }

        stage('Deploy FTP') {
            when {
                branch 'frontend'
            }

            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'hodi-ftp',
                        usernameVariable: 'FTP_USER',
                        passwordVariable: 'FTP_PASSWORD'
                    )
                ]) {
                    sh '''
                        set -eu

                        echo "=== Déploiement FTP vers Hodi ==="

                        find "$DEPLOY_DIR" -type f | while IFS= read -r FILE
                        do
                            RELATIVE_PATH="${FILE#$DEPLOY_DIR/}"

                            echo "Upload : $RELATIVE_PATH"

                            curl \
                                --fail \
                                --silent \
                                --show-error \
                                --ftp-pasv \
                                --ftp-create-dirs \
                                --connect-timeout 10 \
                                --max-time 120 \
                                --retry 2 \
                                --user "$FTP_USER:$FTP_PASSWORD" \
                                --upload-file "$FILE" \
                                "ftp://$FTP_HOST$FTP_REMOTE_DIR/$RELATIVE_PATH"
                        done

                        echo "✅ Upload FTP terminé"
                    '''
                }
            }
        }

        stage('Verify Production') {
            when {
                branch 'frontend'
            }

            steps {
                sh '''
                    curl -fsS \
                        https://ikomholala.madagascar.webcup.hodi.cloud/ \
                        >/dev/null

                    echo "Frontend Hodi disponible"
                '''
            }
        }
    }

    post {
        success {
            echo "✅ Frontend déployé sur Hodi."
        }

        failure {
            echo "❌ Échec du déploiement frontend."
        }

        always {
            sh '''
                docker rm -f webcup-frontend-test \
                    webcup-frontend-extract \
                    >/dev/null 2>&1 || true

                rm -rf "$DEPLOY_DIR" || true
            '''
        }
    }
}