FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml .
# app/ precisa existir ANTES do pip install: o pyproject declara
# packages=["app"] e o setuptools falha se o pacote nao estiver no contexto.
COPY app ./app
RUN pip install --no-cache-dir .
EXPOSE 8000
# --ws-max-size: rejeita frame gigante no protocolo, antes de virar RAM
#   (o limite de 4KB em rooms.py roda depois do frame ja montado).
# --limit-concurrency: teto de conexoes simultaneas (WS conta) — evita
#   exaustao de socket/memoria num flood.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--ws-max-size", "16384", "--limit-concurrency", "256"]
