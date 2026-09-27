pipeline {
    agent any

    environment {
        FRONTEND_IMAGE = "webcup-frontend"
        FRONTEND_PORT  = "8690"
        FRONTEND_REMOTE_DIR = "/public_html"
        FRONTEND_DEPLOY_DIR = "${WORKSPACE}/deploy-frontend"

        BACKEND_IMAGE = "webcup-backend"
        BACKEND_REMOTE_DIR = "/webcupbackend"
        BACKEND_DEPLOY_DIR = "${WORKSPACE}/deploy-backend"

        DOCKER_TAG = "latest"
        FTP_HOST = "tnr1.hodi.host"

        FRONTEND_URL = "https://ikomholala.madagascar.webcup.hodi.cloud/"
        BACKEND_HEALTH_URL = "https://ikomholala.madagascar.webcup.hodi.cloud/webcup-backend/health/"
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(
            logRotator(numToKeepStr: '10')
        )
        timeout(
            time: 20,
            unit: 'MINUTES'
        )
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

                    echo "=== Build Frontend ==="

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
                    echo "=== Test Frontend ==="
                    docker rm -f webcup-frontend-test \
                        >/dev/null 2>&1 || true
                    docker run -d \
                        --name webcup-frontend-test \
                        -p "127.0.0.1:$FRONTEND_PORT:80" \
                        "$FRONTEND_IMAGE:$DOCKER_TAG"

                    for i in 1 2 3 4 5
                    do
                        if curl -fsS \
                            "http://127.0.0.1:$FRONTEND_PORT/" \
                            >/dev/null
                        then
                            echo "✅ Frontend OK"
                            exit 0
                        fi
                        sleep 2
                    done

                    echo "❌ Frontend indisponible"
                    docker logs webcup-frontend-test || true
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


        stage('Extract Frontend') {
            when {
                branch 'frontend'
            }

            steps {
                sh '''
                    set -eu
                    echo "=== Extraction Frontend ==="
                    rm -rf "$FRONTEND_DEPLOY_DIR"
                    mkdir -p "$FRONTEND_DEPLOY_DIR"
                    docker rm -f webcup-frontend-extract \
                        >/dev/null 2>&1 || true
                    docker create \
                        --name webcup-frontend-extract \
                        "$FRONTEND_IMAGE:$DOCKER_TAG"
                    docker cp \
                        webcup-frontend-extract:/usr/share/nginx/html/. \
                        "$FRONTEND_DEPLOY_DIR/"
                    docker rm webcup-frontend-extract
                    echo "=== Fichiers Frontend ==="
                    find "$FRONTEND_DEPLOY_DIR" \
                        -maxdepth 3 \
                        -type f
                '''
            }
        }


        stage('Deploy Frontend FTP') {
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
                        echo "=== Déploiement Frontend vers Hodi ==="
                        find "$FRONTEND_DEPLOY_DIR" -type f |
                        while IFS= read -r FILE
                        do
                            RELATIVE_PATH="${FILE#$FRONTEND_DEPLOY_DIR/}"

                            echo "Upload frontend : $RELATIVE_PATH"

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
                                "ftp://$FTP_HOST$FRONTEND_REMOTE_DIR/$RELATIVE_PATH"
                        done

                        echo "✅ Frontend envoyé"
                    '''
                }
            }
        }


        stage('Verify Frontend') {
            when {
                branch 'frontend'
            }

            steps {
                sh '''
                    set -eu

                    echo "=== Vérification Frontend ==="

                    curl \
                        --fail \
                        --silent \
                        --show-error \
                        "$FRONTEND_URL" \
                        >/dev/null

                    echo "✅ Frontend disponible en production"
                '''
            }
        }
        
        stage('Build Backend') {
            when {
                branch 'backend'
            }

            steps {
                sh '''
                    set -eu

                    echo "=== Build Backend ==="

                    docker build \
                        --pull \
                        -t "$BACKEND_IMAGE:$DOCKER_TAG" \
                        -f backend/Dockerfile .
                '''
            }
        }


        stage('Test Backend') {
            when {
                branch 'backend'
            }

            steps {
                sh '''
                    set -eu

                    echo "=== Django Check ==="

                    docker run --rm \
                        -e SECRET_KEY="jenkins-ci-secret-not-production" \
                        -e DEBUG="False" \
                        -e CORS_ALLOW_ALL_ORIGINS="False" \
                        "$BACKEND_IMAGE:$DOCKER_TAG" \
                        python manage.py check

                    echo "=== Vérification migrations ==="

                    docker run --rm \
                        -e SECRET_KEY="jenkins-ci-secret-not-production" \
                        -e DEBUG="False" \
                        -e CORS_ALLOW_ALL_ORIGINS="False" \
                        "$BACKEND_IMAGE:$DOCKER_TAG" \
                        python manage.py makemigrations \
                            --check \
                            --dry-run

                    echo "✅ Backend Django valide"
                '''
            }
        }


        stage('Prepare Backend') {
            when {
                branch 'backend'
            }

            steps {
                sh '''
                    set -eu

                    echo "=== Préparation Backend ==="

                    rm -rf "$BACKEND_DEPLOY_DIR"

                    mkdir -p "$BACKEND_DEPLOY_DIR"

                    cp -a backend/. "$BACKEND_DEPLOY_DIR/"

                    # Les secrets locaux ne doivent jamais être déployés.
                    rm -f \
                        "$BACKEND_DEPLOY_DIR/.env" \
                        "$BACKEND_DEPLOY_DIR/Dockerfile" \
                        "$BACKEND_DEPLOY_DIR/.gitignore" \
                        "$BACKEND_DEPLOY_DIR/db.sqlite3"

                    # Suppression des caches Python.
                    find "$BACKEND_DEPLOY_DIR" \
                        -type d \
                        -name "__pycache__" \
                        -prune \
                        -exec rm -rf {} + || true

                    find "$BACKEND_DEPLOY_DIR" \
                        -type f \
                        \\( -name "*.pyc" -o -name "*.pyo" \\) \
                        -delete || true

                    echo "=== Fichiers Backend ==="

                    find "$BACKEND_DEPLOY_DIR" \
                        -maxdepth 3 \
                        -type f
                '''
            }
        }


        stage('Deploy Backend FTP') {
            when {
                branch 'backend'
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

                        echo "=== Déploiement Backend vers Hodi ==="

                        find "$BACKEND_DEPLOY_DIR" -type f |
                        while IFS= read -r FILE
                        do
                            RELATIVE_PATH="${FILE#$BACKEND_DEPLOY_DIR/}"

                            echo "Upload backend : $RELATIVE_PATH"

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
                                "ftp://$FTP_HOST$BACKEND_REMOTE_DIR/$RELATIVE_PATH"
                        done

                        echo "✅ Backend envoyé"
                    '''
                }
            }
        }


        stage('Restart Backend') {
            when {
                branch 'backend'
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

                        echo "=== Redémarrage Passenger ==="

                        RESTART_FILE="$WORKSPACE/restart.txt"

                        : > "$RESTART_FILE"

                        curl \
                            --fail \
                            --silent \
                            --show-error \
                            --ftp-pasv \
                            --ftp-create-dirs \
                            --connect-timeout 10 \
                            --max-time 30 \
                            --retry 2 \
                            --user "$FTP_USER:$FTP_PASSWORD" \
                            --upload-file "$RESTART_FILE" \
                            "ftp://$FTP_HOST$BACKEND_REMOTE_DIR/tmp/restart.txt"

                        rm -f "$RESTART_FILE"

                        echo "✅ Redémarrage Passenger demandé"
                    '''
                }
            }
        }


        stage('Verify Backend') {
            when {
                branch 'backend'
            }

            steps {
                sh '''
                    set -eu

                    echo "=== Vérification Backend Hodi ==="

                    for i in 1 2 3 4 5 6
                    do
                        if curl \
                            --fail \
                            --silent \
                            --show-error \
                            "$BACKEND_HEALTH_URL"
                        then
                            echo
                            echo "✅ Backend Django disponible"
                            exit 0
                        fi

                        echo "Attente du démarrage Passenger..."
                        sleep 3
                    done

                    echo "❌ Backend inaccessible"

                    exit 1
                '''
            }
        }
    }


    post {

        success {
            echo "✅ [${env.BRANCH_NAME}] Pipeline terminé avec succès."
        }

        failure {
            echo "❌ [${env.BRANCH_NAME}] Pipeline échoué."
        }

        always {
            sh '''
                docker rm -f \
                    webcup-frontend-test \
                    webcup-frontend-extract \
                    >/dev/null 2>&1 || true

                rm -rf \
                    "$FRONTEND_DEPLOY_DIR" \
                    "$BACKEND_DEPLOY_DIR" \
                    || true

                rm -f \
                    "$WORKSPACE/restart.txt" \
                    || true
            '''
        }
    }
}