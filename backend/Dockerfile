FROM python:3.12.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD sh -c "python manage.py migrate && gunicorn --bind 0.0.0.0:${PORT:-8000} main.wsgi"