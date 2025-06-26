import os
from celery import Celery
from celery.schedules import crontab
import logging
import sys

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')

app = Celery('main')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django app configs.
app.autodiscover_tasks()

app.conf.update(
    worker_log_format='%(asctime)s - %(levelname)s - %(name)s - %(message)s',
    worker_task_log_format='%(asctime)s - %(levelname)s - %(name)s - %(message)s',
    # 確保標準輸出/錯誤被重定向
    worker_redirect_stdouts=True,
    worker_redirect_stdouts_level='INFO',
)

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}') 