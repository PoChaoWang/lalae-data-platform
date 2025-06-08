from django import forms
from .models import QueryDefinition
from django.utils import timezone

class QueryDefinitionForm(forms.ModelForm):
    class Meta:
        model = QueryDefinition
        fields = [
            'name', 'description', 'sql_query',
            'bigquery_project_id', 'bigquery_dataset_id',
            'schedule_frequency', 'schedule_start_datetime',
            'output_target', 'output_config'
        ]
        widgets = {
            'description': forms.Textarea(attrs={'rows': 3}),
            'sql_query': forms.Textarea(attrs={
                'rows': 10,
                'placeholder': 'SELECT * FROM `your_project.your_dataset.your_table` LIMIT 100',
                'class': 'sql-editor'
            }),
            'schedule_start_datetime': forms.DateTimeInput(
                attrs={'type': 'datetime-local'},
                format='%Y-%m-%dT%H:%M'
            ),
            'output_config': forms.HiddenInput(),  # Will be populated via JavaScript
        }
        help_texts = {
            'schedule_frequency': 'Select how often you want this query to run.',
            'schedule_start_datetime': 'When should the scheduled execution begin?',
            'output_target': 'Where should the query results be sent?',
        }

    def clean(self):
        cleaned_data = super().clean()
        schedule_frequency = cleaned_data.get("schedule_frequency")
        schedule_start_datetime = cleaned_data.get("schedule_start_datetime")
        output_target = cleaned_data.get("output_target")
        output_config = cleaned_data.get("output_config")

        # Validate schedule settings
        if schedule_frequency != 'NONE' and not schedule_start_datetime:
            self.add_error('schedule_start_datetime', "Start date/time is required for scheduled queries.")

        if schedule_start_datetime and schedule_start_datetime < timezone.now():
            self.add_error('schedule_start_datetime', "Start date/time must be in the future.")

        # Validate output settings
        if output_target != 'NONE':
            if not output_config:
                self.add_error('output_config', "Output configuration is required when an output target is selected.")
            else:
                # Validate output_config based on output_target
                if output_target == 'GOOGLE_SHEET':
                    required_fields = ['sheet_id', 'sheet_name', 'write_mode']
                    for field in required_fields:
                        if field not in output_config:
                            self.add_error('output_config', f"Missing required field: {field}")
                elif output_target == 'LOOKER_STUDIO':
                    required_fields = ['project_id', 'dataset_id', 'table_id', 'write_mode']
                    for field in required_fields:
                        if field not in output_config:
                            self.add_error('output_config', f"Missing required field: {field}")

        return cleaned_data