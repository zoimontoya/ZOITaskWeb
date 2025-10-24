@echo off
echo === LIMPIANDO DOCKER COMPLETAMENTE ===
docker-compose down -v
docker system prune -a -f
docker builder prune -a -f
docker volume prune -f

echo === RECONSTRUYENDO SIN CACHE ===
docker-compose build --no-cache --pull

echo === INICIANDO SERVICIOS ===
docker-compose up -d

echo === VERIFICANDO ESTADO ===
docker-compose ps

pause