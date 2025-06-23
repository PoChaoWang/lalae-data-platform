from django.db import models
from django.contrib.auth.models import User  # 如果需要追蹤是誰建立的
from django.utils import timezone
from datetime import timedelta
import hashlib
from django.core.exceptions import ValidationError

# from django_celery_beat.models import PeriodicTask # 如果使用 django-celery-beat 做排程


def get_default_expires_at():
    return timezone.now() + timedelta(days=30)


# def _generate_sql_hash(sql_query):
#     """Generates a SHA256 hash for a given SQL query string."""
#     return hashlib.sha256(sql_query.encode('utf-8')).hexdigest()


class QueryDefinition(models.Model):
    # SCHEDULE_FREQUENCY_CHOICES = [
    #     ("NONE", "None"),
    #     ("HOURLY", "Hourly"),
    #     ("DAILY", "Daily"),
    #     ("WEEKLY", "Weekly"),
    #     ("MONTHLY", "Monthly"),
    # ]

    # WRITE_MODE_CHOICES = [
    #     ("OVERWRITE", "Overwrite Sheet"),
    #     ("APPEND", "Append to Sheet"),
    # ]

    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("RUNNING", "Running"),
        ("SUCCESS", "Success"),
        ("FAILED", "Failed"),
        ("SCHEDULED", "Scheduled"),
        ("OUTPUT_ERROR", "Output Error"),
        ("SAVED_ONLY", "Saved Only"),  
    ]

    name = models.CharField(max_length=255, verbose_name="Query Name")
    description = models.TextField(blank=True, null=True, verbose_name="Description")
    sql_query = models.TextField(verbose_name="SQL Query")
    bigquery_project_id = models.CharField(max_length=100, help_text="GCP Project ID")
    bigquery_dataset_id = models.CharField(
        max_length=100, help_text="Target BigQuery dataset ID"
    )
    # bigquery_destination_table = models.CharField(max_length=100, blank=True, null=True, help_text="若查詢結果寫入新表，可指定表名")

    # Schedule settings
    schedule_type = models.CharField(max_length=10, default='ONCE',
                                     choices=[('ONCE', 'Once'), ('PERIODIC', 'Periodic')])

    # 新增 schedule_hour 和 schedule_minute
    cron_schedule = models.CharField(max_length=255, null=True, blank=True,
                                     help_text="Cron schedule string (e.g., '0 9 * * *' for daily 9 AM)")
    # Output settings
    output_target = models.CharField(max_length=50, default='NONE',
                                     choices=[
                                         ('NONE', 'None'),
                                         ('GOOGLE_SHEET', 'Google Sheets'),
                                         ('LOOKER_STUDIO', 'Google Looker Studio')
                                     ])
    
    output_config = models.JSONField(null=True, blank=True,
                                     help_text="JSON configuration for output target (e.g., sheet_id, tab_name, append_mode)")

    # Status tracking
    last_run_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="PENDING",
        verbose_name="Last Run Status",
    )

    last_run_initiated_at = models.DateTimeField(null=True, blank=True)

    last_successful_run_result = models.ForeignKey('QueryRunResult', on_delete=models.SET_NULL, null=True, blank=True,
                                                  related_name='successful_for_query', help_text="Link to the last successful run result")
    
    last_successful_test_hash = models.CharField(max_length=64, null=True, blank=True,
                                                  help_text="SHA256 hash of the last successfully tested SQL query")
    last_tested_at = models.DateTimeField(null=True, blank=True)

    owner = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Owner"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated At")

    def __str__(self):
        return self.name

    def has_downloadable_result(self):
        return (
            self.last_successful_run_result is not None
            and self.last_successful_run_result.result_data_csv is not None
        )

    def save(self, *args, **kwargs):
        if not self.pk:  # New instance
            self.last_run_status = "PENDING"
        super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        if self.output_target == "Google Sheets":
            sheet_id = self.output_config.get("sheet_id") if self.output_config else None
            if not sheet_id or not str(sheet_id).strip():  # 檢查是否為空字串或只含空白
                raise ValidationError(
                    {"output_config": "Sheet ID is required for Google Sheets output."}
                )
        elif self.output_target == "Google Looker Studio":
            email = self.output_config.get("email") if self.output_config else None
            if not email or not str(email).strip():
                raise ValidationError(
                    {
                        "output_config": "Email address is required for Looker Studio output."
                    }
                )

    class Meta:
        verbose_name = "Query Definition"
        verbose_name_plural = "Query Definitions"


class QueryRunResult(models.Model):
    query = models.ForeignKey(QueryDefinition, on_delete=models.CASCADE, related_name='run_results')
    executed_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=50, default='PENDING')
    result_rows_count = models.IntegerField(null=True, blank=True)
    result_data_csv = models.TextField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)
    triggered_by = models.CharField(max_length=100, default='MANUAL') 
    result_output_link = models.URLField(max_length=500, null=True, blank=True)
    result_message = models.TextField(null=True, blank=True)
    result_storage_path = models.CharField(max_length=500, null=True, blank=True)

    def __str__(self):
        return f"{self.query.name} - {self.get_status_display()} at {self.executed_at}"

    class Meta:
        # verbose_name = "Query Run Result"
        # verbose_name_plural = "Query Run Results"
        ordering = ["-executed_at"]


class QueryExecution(models.Model):
    STATUS_CHOICES = [
        ("PENDING", "Pending"),
        ("RUNNING", "Running"),
        ("SUCCESS", "Success"),
        ("FAILED", "Failed"),
        ("CANCELLED", "Cancelled"),
    ]

    query_definition = models.ForeignKey(
        QueryDefinition,
        on_delete=models.CASCADE,
        related_name="executions",
        verbose_name="Query Definition",
    )
    triggered_by = models.CharField(
        max_length=20, default="MANUAL", verbose_name="Triggered By"
    )  # MANUAL, SCHEDULED
    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default="PENDING", verbose_name="Status"
    )
    started_at = models.DateTimeField(null=True, blank=True, verbose_name="Started At")
    completed_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Completed At"
    )
    result_message = models.TextField(
        blank=True, null=True, verbose_name="Result Message/Error Message"
    )
    result_rows_count = models.IntegerField(
        null=True, blank=True, verbose_name="Result Rows Count"
    )
    # 如果結果是檔案，可以存在 GCS 並在這裡記錄路徑
    result_storage_path = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        verbose_name="Result Storage Path (e.g., GCS)",
    )
    # 或者直接記錄 Google Sheet / Looker Studio 的連結 (如果每次執行都產生新的)
    result_output_link = models.URLField(
        blank=True, null=True, verbose_name="Result Output Link"
    )

    def __str__(self):
        return f"{self.query_definition.name} - {self.get_status_display()} at {self.started_at or self.id}"

    class Meta:
        verbose_name = "Query Execution Record"
        verbose_name_plural = "Query Execution Records"
        ordering = ["-started_at"]
