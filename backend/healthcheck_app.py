import os
import time
import logging
from datetime import datetime
from flask import Flask, jsonify

# 設置日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
START_TIME = time.time()

@app.route('/')
def root():
    """根路由"""
    return jsonify({
        'status': 'ok',
        'service': 'celery-worker',
        'timestamp': datetime.utcnow().isoformat(),
        'uptime_seconds': time.time() - START_TIME
    })

@app.route('/health')
def health_check():
    """健康檢查端點"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'uptime_seconds': time.time() - START_TIME
    }), 200

@app.route('/readiness')
def readiness_check():
    """就緒檢查端點"""
    return jsonify({
        'status': 'ready',
        'timestamp': datetime.utcnow().isoformat()
    }), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    logger.info(f"Starting health check server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)