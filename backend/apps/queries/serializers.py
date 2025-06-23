# backend/apps/queries/serializers.py

from rest_framework import serializers
from .models import QueryDefinition, QueryRunResult
from apps.clients.models import Client
from apps.clients.serializers import ClientSerializer
from django.utils import timezone
from datetime import timedelta
from django.db import models

class QueryRunResultSerializer(serializers.ModelSerializer):
    executed_at = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True)

    class Meta:
        model = QueryRunResult
        fields = ['id', 'executed_at', 'status', 'error_message', 'result_message', 'result_output_link']


class QueryDefinitionSerializer(serializers.ModelSerializer):
    latest_status = serializers.SerializerMethodField()
    latest_execution_time = serializers.SerializerMethodField()
    has_downloadable_result = serializers.SerializerMethodField()
    last_successful_run_result = QueryRunResultSerializer(read_only=True)

    class Meta:
        model = QueryDefinition
        fields = [
            'id', 'name', 'sql_query', 'bigquery_project_id', 'bigquery_dataset_id',
            'schedule_type', 'cron_schedule',       
            'output_target', 'output_config',       
            'last_run_status', 'last_run_initiated_at', 'last_successful_run_result',
            'last_successful_test_hash', 'last_tested_at',
            'owner', 'created_at', 'updated_at', 'description', 
            'latest_status',
            'latest_execution_time',
            'has_downloadable_result',
        ]
        read_only_fields = [
            'owner', 'last_run_status', 'last_run_initiated_at',
            'created_at', 'updated_at', 'last_successful_run_result',
            'last_successful_test_hash', 'last_tested_at'
        ]

    def get_latest_status(self, obj):
        latest_result = obj.run_results.order_by('-executed_at').first()
        return latest_result.status if latest_result else 'PENDING'

    def get_latest_execution_time(self, obj):
        latest_result = obj.run_results.order_by('-executed_at').first()
        return latest_result.executed_at.strftime('%Y-%m-%d %H:%M') if latest_result and latest_result.executed_at else None

    def get_has_downloadable_result(self, obj):
        latest_result = obj.last_successful_run_result
        if latest_result:
            return (
                latest_result.status in ['SUCCESS', 'OUTPUT_ERROR'] and
                latest_result.result_data_csv is not None and
                latest_result.executed_at and
                latest_result.executed_at > timezone.now() - timedelta(days=30)
            )
        return False