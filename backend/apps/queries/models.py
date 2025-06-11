from django.db import models
from django.contrib.auth.models import User # 如果需要追蹤是誰建立的
from django.utils import timezone
from datetime import timedelta
# from django_celery_beat.models import PeriodicTask # 如果使用 django-celery-beat 做排程

def get_default_expires_at():
    return timezone.now() + timedelta(days=30)

class QueryDefinition(models.Model):
    SCHEDULE_FREQUENCY_CHOICES = [
        ('NONE', 'None'),
        ('HOURLY', 'Hourly'),
        ('DAILY', 'Daily'),
        ('WEEKLY', 'Weekly'),
        ('MONTHLY', 'Monthly'),
    ]
    
    OUTPUT_TARGET_CHOICES = [
        ('NONE', 'None'),
        ('GOOGLE_SHEET', 'Google Sheet'),
        ('LOOKER_STUDIO', 'Google Looker Studio'),
    ]
    
    WRITE_MODE_CHOICES = [
        ('OVERWRITE', 'Overwrite Sheet'),
        ('APPEND', 'Append to Sheet'),
    ]
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('RUNNING', 'Running'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('SCHEDULED', 'Scheduled'),
        ('OUTPUT_ERROR', 'Output Error'),
        ('PENDING', 'Saved Only'),  # New status for queries that are only saved
    ]

    name = models.CharField(max_length=255, verbose_name="Query Name")
    description = models.TextField(blank=True, null=True, verbose_name="Description")
    sql_query = models.TextField(verbose_name="SQL Query")
    bigquery_project_id = models.CharField(max_length=100, help_text="GCP Project ID")
    bigquery_dataset_id = models.CharField(max_length=100, help_text="Target BigQuery dataset ID")
    # bigquery_destination_table = models.CharField(max_length=100, blank=True, null=True, help_text="若查詢結果寫入新表，可指定表名")

    # Schedule settings
    schedule_config = models.JSONField(default=dict, blank=True)

    # Output settings
    output_target = models.CharField(
        max_length=20,
        choices=OUTPUT_TARGET_CHOICES,
        default='NONE',
        verbose_name="Output Target"
    )
    output_config = models.JSONField(
        null=True,
        blank=True,
        verbose_name="Output Configuration",
        help_text="JSON configuration for output settings (Google Sheet ID, BigQuery table details, etc.)"
    )

    # Status tracking
    last_run_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING',
        verbose_name="Last Run Status"
    )
    last_run_initiated_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Last Run Initiated At"
    )
    last_successful_run_result = models.ForeignKey(
        'QueryRunResult',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='last_successful_for_queries',
        verbose_name="Last Successful Run Result"
    )

    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Owner")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated At")

    def __str__(self):
        return self.name

    @property
    def has_downloadable_result(self):
        return (self.last_successful_run_result is not None and 
                self.last_successful_run_result.result_data_csv is not None)

    @property
    def latest_status(self):
        if hasattr(self, '_latest_status'):
            return self._latest_status
        if self.last_run_status == 'PENDING':
            return 'PENDING'
        return self.last_run_status

    @property
    def latest_execution_time(self):
        if hasattr(self, '_latest_execution_time'):
            return self._latest_execution_time
        if self.last_run_initiated_at:
            return self.last_run_initiated_at
        return None

    def save(self, *args, **kwargs):
        if not self.pk:  # New instance
            self.last_run_status = 'PENDING'
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "Query Definition"
        verbose_name_plural = "Query Definitions"

class QueryRunResult(models.Model):
    query = models.ForeignKey(
        QueryDefinition,
        on_delete=models.CASCADE,
        related_name='run_results',
        verbose_name="Query"
    )
    executed_at = models.DateTimeField(auto_now_add=True, verbose_name="Executed At")
    status = models.CharField(
        max_length=20,
        choices=QueryDefinition.STATUS_CHOICES,
        default='PENDING',
        verbose_name="Status"
    )
    result_data_csv = models.TextField(
        null=True,
        blank=True,
        verbose_name="Result Data (CSV)"
    )
    error_message = models.TextField(
        null=True,
        blank=True,
        verbose_name="Error Message"
    )
    expires_at = models.DateTimeField(
        default=get_default_expires_at,
        verbose_name="Expires At"
    )

    def __str__(self):
        return f"{self.query.name} - {self.get_status_display()} at {self.executed_at}"

    class Meta:
        verbose_name = "Query Run Result"
        verbose_name_plural = "Query Run Results"
        ordering = ['-executed_at']

class QueryExecution(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('RUNNING', 'Running'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('CANCELLED', 'Cancelled'),
    ]

    query_definition = models.ForeignKey(QueryDefinition, on_delete=models.CASCADE, related_name="executions", verbose_name="Query Definition")
    triggered_by = models.CharField(max_length=20, default='MANUAL', verbose_name="Triggered By") # MANUAL, SCHEDULED
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING', verbose_name="Status")
    started_at = models.DateTimeField(null=True, blank=True, verbose_name="Started At")
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name="Completed At")
    result_message = models.TextField(blank=True, null=True, verbose_name="Result Message/Error Message")
    result_rows_count = models.IntegerField(null=True, blank=True, verbose_name="Result Rows Count")
    # 如果結果是檔案，可以存在 GCS 並在這裡記錄路徑
    result_storage_path = models.CharField(max_length=500, blank=True, null=True, verbose_name="Result Storage Path (e.g., GCS)")
    # 或者直接記錄 Google Sheet / Looker Studio 的連結 (如果每次執行都產生新的)
    result_output_link = models.URLField(blank=True, null=True, verbose_name="Result Output Link")

    def __str__(self):
        return f"{self.query_definition.name} - {self.get_status_display()} at {self.started_at or self.id}"

    class Meta:
        verbose_name = "Query Execution Record"
        verbose_name_plural = "Query Execution Records"
        ordering = ['-started_at']