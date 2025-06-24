# healthcheck_app.py
from flask import Flask

app = Flask(__name__)

@app.route('/healthz')
def health_check():
    return 'OK', 200

# 在你的celery啟動文件中
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)