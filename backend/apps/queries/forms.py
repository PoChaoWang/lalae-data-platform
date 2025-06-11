# apps/queries/forms.py

from django import forms
from .models import QueryDefinition
from django.utils import timezone
import json

class QueryDefinitionForm(forms.ModelForm):
    class Meta:
        model = QueryDefinition
        fields = [
            'name', 'description', 'sql_query',
            'bigquery_project_id', 'bigquery_dataset_id',
            'schedule_config',  
            'output_target', 'output_config'
        ]
        widgets = {
            'description': forms.Textarea(attrs={'rows': 3}),
            'sql_query': forms.Textarea(attrs={
                'rows': 10,
                'placeholder': 'SELECT * FROM `your_project.your_dataset.your_table` LIMIT 100',
                'class': 'sql-editor'
            }),
            'schedule_config': forms.HiddenInput(),
            'output_config': forms.HiddenInput(),
        }
        help_texts = {
            'output_target': 'Where should the query results be sent?',
        }

    def clean_schedule_config(self):
        """
        清理和驗證 schedule_config JSON 資料。
        """
        config_str = self.cleaned_data.get('schedule_config')
        if not config_str:
            return {}  # 如果沒有排程，回傳空字典

        try:
            config = json.loads(config_str)
            freq_type = config.get('frequency_type')

            if freq_type and freq_type != 'NONE':
                if 'hour' not in config or 'minute' not in config:
                    raise forms.ValidationError("Schedule config must include 'hour' and 'minute'.")
                
                if freq_type == 'WEEKLY' and 'week_of_day' not in config:
                    raise forms.ValidationError("Weekly schedule requires 'week_of_day'.")

                if freq_type == 'MONTHLY' and 'month_of_day' not in config:
                    raise forms.ValidationError("Monthly schedule requires 'month_of_day'.")

            return config
        except json.JSONDecodeError:
            raise forms.ValidationError("Invalid JSON format in schedule_config.")
        
    def clean_output_config(self):
        """
        清理和驗證 output_config JSON 資料。
        """
        config_str = self.cleaned_data.get('output_config')
        output_target = self.cleaned_data.get('output_target')

        if output_target == 'NONE':
            return {} # 如果沒有輸出目標，回傳空字典

        if not config_str:
            raise forms.ValidationError("Output configuration is required for the selected target.")

        try:
            config = json.loads(config_str)
            if output_target == 'GOOGLE_SHEET':
                if not config.get('sheet_id') or not config.get('sheet_tab_name'):
                    raise forms.ValidationError("For Google Sheets, 'Sheet ID' and 'Sheet Tab Name' are required.")
            
            elif output_target == 'LOOKER_STUDIO':
                if not config.get('gmail_address'):
                     raise forms.ValidationError("For Looker Studio, 'Gmail Address' is required.")

            return config
        except json.JSONDecodeError:
            raise forms.ValidationError("Invalid JSON format in output_config.")

    def clean(self):
        """
        整體驗證。
        """
        cleaned_data = super().clean()
        # 這裡可以加入更多跨欄位的驗證邏輯
        return cleaned_data