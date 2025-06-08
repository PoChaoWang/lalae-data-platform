from celery import shared_task
from google.cloud import bigquery
from google.api_core import exceptions
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def create_bigquery_dataset_and_tables_task(self, dataset_id, user_id=None):
    """Create a BigQuery dataset and its default tables.
    
    Args:
        dataset_id: The ID of the dataset to create.
        user_id: The ID of the user who is creating the dataset.
    """
    try:
        client = bigquery.Client()
        project_id = settings.GOOGLE_CLOUD_PROJECT_ID

        # Create dataset
        dataset_ref = f"{project_id}.{dataset_id}"
        dataset = bigquery.Dataset(dataset_ref)
        dataset.location = "asia-east1"  # Set your preferred location
        dataset = client.create_dataset(dataset, exists_ok=True)
        logger.info(f"Created dataset {dataset_id} by user {user_id}")

        # Create default tables
        create_default_bigquery_table_task.delay(dataset_id, "customer_events", user_id)
        create_default_bigquery_table_task.delay(dataset_id, "customer_transactions", user_id)

    except exceptions.Conflict:
        logger.warning(f"Dataset {dataset_id} already exists")
    except Exception as e:
        logger.error(f"Error creating dataset {dataset_id}: {str(e)}")
        raise self.retry(exc=e)

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def delete_bigquery_dataset_task(self, dataset_id):
    """Delete a BigQuery dataset and all its contents."""
    try:
        client = bigquery.Client()
        project_id = settings.GOOGLE_CLOUD_PROJECT_ID
        dataset_ref = f"{project_id}.{dataset_id}"
        
        client.delete_dataset(dataset_ref, delete_contents=True, not_found_ok=True)
        logger.info(f"Deleted dataset {dataset_id}")

    except exceptions.NotFound:
        logger.warning(f"Dataset {dataset_id} not found")
    except Exception as e:
        logger.error(f"Error deleting dataset {dataset_id}: {str(e)}")
        raise self.retry(exc=e)

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def create_default_bigquery_table_task(self, dataset_id, table_name, user_id=None):
    """Create a default table in the specified dataset.
    
    Args:
        dataset_id: The ID of the dataset.
        table_name: The name of the table to create.
        user_id: The ID of the user who is creating the table.
    """
    try:
        client = bigquery.Client()
        project_id = settings.GOOGLE_CLOUD_PROJECT_ID
        table_ref = f"{project_id}.{dataset_id}.{table_name}"

        # Define schema based on table type
        if table_name == "customer_events":
            schema = [
                bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
                bigquery.SchemaField("event_type", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("user_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("properties", "JSON", mode="NULLABLE"),
            ]
            time_partitioning = bigquery.TimePartitioning(
                type_=bigquery.TimePartitioningType.DAY,
                field="timestamp"
            )
            clustering_fields = ["event_type", "user_id"]
        else:  # customer_transactions
            schema = [
                bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
                bigquery.SchemaField("transaction_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("user_id", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("amount", "NUMERIC", mode="REQUIRED"),
                bigquery.SchemaField("currency", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("status", "STRING", mode="REQUIRED"),
                bigquery.SchemaField("metadata", "JSON", mode="NULLABLE"),
            ]
            time_partitioning = bigquery.TimePartitioning(
                type_=bigquery.TimePartitioningType.DAY,
                field="timestamp"
            )
            clustering_fields = ["user_id", "status"]

        # Create table
        table = bigquery.Table(table_ref, schema=schema)
        table.time_partitioning = time_partitioning
        table.clustering_fields = clustering_fields
        table = client.create_table(table, exists_ok=True)
        logger.info(f"Created table {table_name} in dataset {dataset_id} by user {user_id}")

    except Exception as e:
        logger.error(f"Error creating table {table_name} in dataset {dataset_id}: {str(e)}")
        raise self.retry(exc=e)

@shared_task
def test_celery_connection():
    """Test task to verify Celery connection"""
    logger.info("Testing Celery connection...")
    return "Celery connection is working!" 