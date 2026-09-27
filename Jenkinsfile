pipeline {
    agent any

    environment {
        FRONTEND_IMAGE = "webcup-frontend"
        FRONTEND_PORT = "8690"
        FRONTEND_REMOTE_DIR = "/public_html"
        FRONTEND_DEPLOY_DIR = "${WORKSPACE}/deploy-frontend"

        BACKEND_IMAGE = "webcup-backend"
        BACKEND_REMOTE_DIR = "/webcupbackend"
        BACKEND_DEPLOY_DIR = "${WORKSPACE}/deploy-backend"

        MYSQL_IMAGE = "mysql:8.4"
        MYSQL_NAME = "webcup-mysql-test"
        MYSQL_NETWORK = "webcup-ci-network"
        MYSQL_DB = "webcup_test"
        MYSQL_USER = "webcup"
        MYSQL_PASSWORD = "webcup-ci-password"
        MYSQL_ROOT_PASSWORD = "webcup-root-password"

        FTP_HOST = "tnr1.hodi.host"
        DOCKER_TAG = "latest"

        FRONTEND_URL = "https://ikomholala.madagascar.webcup.hodi.cloud/"
        BACKEND_URL = "https://ikomholala.madagascar.webcup.hodi.cloud/webcup-backend/health/"
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
            when { branch 'frontend' }
            steps {
                sh '''
                    set -eu
                    docker build --pull \
                        -t "$FRONTEND_IMAGE:$DOCKER_TAG" \
                        -f frontend/Dockerfile .
                '''
            }
        }

        stage('Test Frontend') {
            when { branch 'frontend' }
            steps {
                sh '''
                    set -eu
                    docker rm -f webcup-frontend-test >/dev/null 2>&1 || true

                    docker run -d \
                        --name webcup-frontend-test \
                        -p "127.0.0.1:$FRONTEND_PORT:80" \
                        "$FRONTEND_IMAGE:$DOCKER_TAG"

                    for i in 1 2 3 4 5; do
                        curl -fsS "http://127.0.0.1:$FRONTEND_PORT/" >/dev/null && exit 0
                        sleep 2
                    done

                    docker logs webcup-frontend-test || true
                    exit 1
                '''
            }
            post {
                always {
                    sh 'docker rm -f webcup-frontend-test >/dev/null 2>&1 || true'
                }
            }
        }

        stage('Extract Frontend') {
            when { branch 'frontend' }
            steps {
                sh '''
                    set -eu
                    rm -rf "$FRONTEND_DEPLOY_DIR"
                    mkdir -p "$FRONTEND_DEPLOY_DIR"

                    docker rm -f webcup-frontend-extract >/dev/null 2>&1 || true

                    docker create \
                        --name webcup-frontend-extract \
                        "$FRONTEND_IMAGE:$DOCKER_TAG"

                    docker cp \
                        webcup-frontend-extract:/usr/share/nginx/html/. \
                        "$FRONTEND_DEPLOY_DIR/"

                    docker rm webcup-frontend-extract
                '''
            }
        }

        stage('Deploy Frontend') {
            when { branch 'frontend' }
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

                        find "$FRONTEND_DEPLOY_DIR" -type f |
                        while IFS= read -r FILE; do
                            REL="${FILE#$FRONTEND_DEPLOY_DIR/}"

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
                                -T "$FILE" \
                                "ftp://$FTP_HOST$FRONTEND_REMOTE_DIR/$REL"
                        done
                    '''
                }
            }
        }

        stage('Verify Frontend') {
            when { branch 'frontend' }
            steps {
                sh 'curl -fsS "$FRONTEND_URL" >/dev/null'
            }
        }

        stage('Build Backend') {
            when { branch 'backend' }
            steps {
                sh '''
                    set -eu
                    docker build --pull \
                        -t "$BACKEND_IMAGE:$DOCKER_TAG" \
                        -f backend/Dockerfile .
                '''
            }
        }

        stage('Test Backend') {
            when { branch 'backend' }

            steps {
                sh '''
                    set -eu

                    docker rm -f "$MYSQL_NAME" >/dev/null 2>&1 || true

                    docker run -d \
                        --name "$MYSQL_NAME" \
                        -e MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD" \
                        -e MYSQL_DATABASE="$MYSQL_DB" \
                        -e MYSQL_USER="$MYSQL_USER" \
                        -e MYSQL_PASSWORD="$MYSQL_PASSWORD" \
                        --health-cmd="mysqladmin ping -h 127.0.0.1 -uroot -p$MYSQL_ROOT_PASSWORD --protocol=tcp --silent" \
                        --health-interval=2s \
                        --health-timeout=5s \
                        --health-retries=30 \
                        "$MYSQL_IMAGE"

                    for i in $(seq 1 30); do
                        STATUS=$(docker inspect \
                            --format='{{.State.Health.Status}}' \
                            "$MYSQL_NAME")

                        [ "$STATUS" = "healthy" ] && break

                        if [ "$STATUS" = "unhealthy" ] || [ "$i" = "30" ]; then
                            docker logs "$MYSQL_NAME"
                            exit 1
                        fi

                        sleep 2
                    done

                    run_django() {
                        docker run --rm \
                            --network "container:$MYSQL_NAME" \
                            -e SECRET_KEY="jenkins-ci-secret" \
                            -e DEBUG="False" \
                            -e CORS_ALLOW_ALL_ORIGINS="False" \
                            -e DB_HOST="127.0.0.1" \
                            -e DB_PORT="3306" \
                            -e DB_NAME="$MYSQL_DB" \
                            -e DB_USER="$MYSQL_USER" \
                            -e DB_PASSWORD="$MYSQL_PASSWORD" \
                            "$BACKEND_IMAGE:$DOCKER_TAG" "$@"
                    }

                    run_django python manage.py check
                    run_django python manage.py makemigrations --check --dry-run
                    run_django python manage.py migrate --noinput

                    echo "✅ Backend + MySQL OK"
                '''
            }

            post {
                always {
                    sh '''
                        docker rm -f "$MYSQL_NAME" >/dev/null 2>&1 || true
                    '''
                }
            }
        }

        stage('Prepare Backend') {
            when { branch 'backend' }
            steps {
                sh '''
                    set -eu

                    rm -rf "$BACKEND_DEPLOY_DIR"
                    mkdir -p "$BACKEND_DEPLOY_DIR"

                    cp -a backend/. "$BACKEND_DEPLOY_DIR/"

                    rm -f \
                        "$BACKEND_DEPLOY_DIR/.env" \
                        "$BACKEND_DEPLOY_DIR/Dockerfile" \
                        "$BACKEND_DEPLOY_DIR/.gitignore" \
                        "$BACKEND_DEPLOY_DIR/db.sqlite3"

                    find "$BACKEND_DEPLOY_DIR" \
                        -type d -name "__pycache__" \
                        -prune -exec rm -rf {} + || true

                    find "$BACKEND_DEPLOY_DIR" \
                        -type f \
                        \\( -name "*.pyc" -o -name "*.pyo" \\) \
                        -delete || true
                '''
            }
        }

        stage('Deploy Backend') {
            when { branch 'backend' }
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

                        find "$BACKEND_DEPLOY_DIR" -type f |
                        while IFS= read -r FILE; do
                            REL="${FILE#$BACKEND_DEPLOY_DIR/}"

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
                                -T "$FILE" \
                                "ftp://$FTP_HOST$BACKEND_REMOTE_DIR/$REL"
                        done
                    '''
                }
            }
        }

        stage('Restart Backend') {
            when { branch 'backend' }
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

                        touch "$WORKSPACE/restart.txt"

                        curl \
                            --fail \
                            --silent \
                            --show-error \
                            --ftp-pasv \
                            --ftp-create-dirs \
                            --user "$FTP_USER:$FTP_PASSWORD" \
                            -T "$WORKSPACE/restart.txt" \
                            "ftp://$FTP_HOST$BACKEND_REMOTE_DIR/tmp/restart.txt"
                    '''
                }
            }
        }

        stage('Verify Backend') {
            when { branch 'backend' }
            steps {
                sh '''
                    set -eu

                    for i in 1 2 3 4 5 6 7 8 9 10; do
                        curl -fsS "$BACKEND_URL" && exit 0
                        sleep 3
                    done

                    exit 1
                '''
            }
        }
    }

    post {
        success {
            echo "✅ [${env.BRANCH_NAME}] terminé."
        }

        failure {
            echo "❌ [${env.BRANCH_NAME}] échoué."
        }

        always {
            sh '''
                docker rm -f \
                    webcup-frontend-test \
                    webcup-frontend-extract \
                    "$MYSQL_NAME" \
                    >/dev/null 2>&1 || true

                rm -rf \
                    "$FRONTEND_DEPLOY_DIR" \
                    "$BACKEND_DEPLOY_DIR"

                rm -f "$WORKSPACE/restart.txt"
            '''
        }
    }
}