# forms.py
from django import forms
from django.db import models
from .models import Connection, GoogleAdsField
from apps.clients.models import Client
from django.contrib.auth import get_user_model
from .apis.facebook_ads import get_facebook_field_choices
from django.contrib import messages
import logging
import pytz


timezone = pytz.timezone('Asia/Taipei')

logger = logging.getLogger(__name__)

User = get_user_model()

class BaseConnectionForm(forms.ModelForm):
    # 同步設定
    sync_frequency = forms.ChoiceField(
        choices=[
            ('once', 'Once'),
            ('daily', 'Daily'),
            ('weekly', 'Weekly'),
            ('monthly', 'Monthly'),
        ],
        initial='daily',
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    
    # 新增時間選擇欄位
    sync_hour = forms.ChoiceField(
        choices=[(str(hour).zfill(2), str(hour).zfill(2)) for hour in range(24)],
        initial='00',
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    
    sync_minute = forms.ChoiceField(
        choices=[(str(minute).zfill(2), str(minute).zfill(2)) for minute in range(0, 60, 15)],
        initial='00',
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    
    weekly_day_of_week = forms.ChoiceField(
        choices=[
            ('0', 'Sunday'),
            ('1', 'Monday'),
            ('2', 'Tuesday'),
            ('3', 'Wednesday'),
            ('4', 'Thursday'),
            ('5', 'Friday'),
            ('6', 'Saturday'),
        ],
        required=False,
        widget=forms.Select(attrs={'class': 'form-select'})
    )
    
    monthly_day_of_month = forms.IntegerField(
        min_value=1,
        max_value=31,
        required=False,
        widget=forms.NumberInput(attrs={'class': 'form-control', 'placeholder': 'e.g., 1 for the 1st of the month'})
    )

    class Meta:
        model = Connection
        fields = ['display_name', 'target_dataset_id']
        widgets = {
            'display_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g., My Production Google Ads'}),
            'target_dataset_id': forms.TextInput(attrs={'readonly': 'readonly', 'class': 'form-control'}),
        }
        fields += ['sync_frequency', 'sync_hour', 'sync_minute', 'weekly_day_of_week', 'monthly_day_of_month']
    
    
    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user', None)
        self.request = kwargs.pop('request', None)
        self.data_source = kwargs.pop('data_source_instance', None)

        super().__init__(*args, **kwargs)

    def save(self, commit=True):
        # 1. 呼叫 ModelForm 預設的 save，但不提交到資料庫，以獲取一個 instance
        instance = super().save(commit=False)

        # 2. 設定通用屬性
        instance.user = self.user
        instance.data_source = self.data_source
        
        # 將表單中通用欄位的設定存入 config
        instance.config = {
            'sync_frequency': self.cleaned_data.get('sync_frequency'),
            'sync_hour': self.cleaned_data.get('sync_hour'),
            'sync_minute': self.cleaned_data.get('sync_minute'),
            'weekly_day_of_week': self.cleaned_data.get('weekly_day_of_week'),
            'monthly_day_of_month': self.cleaned_data.get('monthly_day_of_month'),
        }
        
        if commit:
            instance.save()
        return instance
        
class GoogleAdsForm(BaseConnectionForm):
    customer_id = forms.CharField(label="Google Ads Customer ID", required=True)

    # Google Ads 報表格式
    resource_name = forms.ModelChoiceField(
        label="Report Level (Resource)",
        queryset=GoogleAdsField.objects.filter(category='RESOURCE').order_by('field_name'),
        to_field_name='field_name', # POST 的值會是 field_name
        empty_label="--- Select a Resource ---",
        widget=forms.Select(attrs={'class': 'form-select'})
    )

    selected_metrics = forms.ModelMultipleChoiceField(
        queryset=GoogleAdsField.objects.filter(category='METRIC'),
        widget=forms.SelectMultiple(attrs={'class': 'd-none'}), # 隱藏起來，由 JS 控制
        required=False,
        to_field_name='field_name'
    )
    selected_segments = forms.ModelMultipleChoiceField(
        queryset=GoogleAdsField.objects.filter(category='SEGMENT'),
        widget=forms.SelectMultiple(attrs={'class': 'd-none'}),
        required=False,
        to_field_name='field_name'
    )
    selected_attributes = forms.ModelMultipleChoiceField(
        queryset=GoogleAdsField.objects.filter(category='ATTRIBUTE'),
        widget=forms.SelectMultiple(attrs={'class': 'd-none'}),
        required=False,
        to_field_name='field_name'
    )

    class Meta(BaseConnectionForm.Meta):
        model = Connection
        fields = BaseConnectionForm.Meta.fields + [
            'customer_id',
            'resource_name',
            'selected_metrics',
            'selected_segments',
            'selected_attributes'
        ]

    def __init__(self, *args, **kwargs):
        # __init__ 方法需要先呼叫父類別的 __init__
        super().__init__(*args, **kwargs)
        
        # 如果是更新現有連線，從 instance.config 初始化欄位值
        # 這個 if 判斷可以安全地處理 "建立" 和 "更新" 兩種情況
        if self.instance and self.instance.pk and self.instance.config:
            self.fields['customer_id'].initial = self.instance.config.get('customer_id')
            self.fields['resource_name'].initial = self.instance.config.get('resource_name')
            
            self.fields['selected_metrics'].initial = GoogleAdsField.objects.filter(field_name__in=self.instance.config.get('metrics', []))
            self.fields['selected_segments'].initial = GoogleAdsField.objects.filter(field_name__in=self.instance.config.get('segments', []))
            self.fields['selected_attributes'].initial = GoogleAdsField.objects.filter(field_name__in=self.instance.config.get('attributes', []))
    
    def clean(self):
        """
        伺服器端的核心驗證邏輯。
        """
        cleaned_data = super().clean()
        resource = cleaned_data.get('resource_name')
        metrics = cleaned_data.get('selected_metrics', [])
        segments = cleaned_data.get('selected_segments', [])
        attributes = cleaned_data.get('selected_attributes', [])

        if not resource:
            # 如果連 resource 都沒選，就不用繼續往下驗證了
            return cleaned_data

        if not metrics and not segments and not attributes:
            raise forms.ValidationError("You must select at least one Metric, Segment, or Attribute.")

        # 1. 獲取透過 ManyToMany 關聯的相容欄位 (Metrics 和 Segments)
        compatible_fields_set = set(resource.compatible_fields.all())

        # 2. 獲取 Resource 自身的屬性 (例如 ad_group.name, ad_group.campaign)
        #    這些欄位以 resource 的名稱開頭
        own_attributes_qs = GoogleAdsField.objects.filter(
            category='ATTRIBUTE',
            field_name__startswith=f"{resource.field_name}."
        )
        own_attributes_set = set(own_attributes_qs)

        # 3. 將兩者合併，成為一個完整的合法欄位集合
        valid_fields = compatible_fields_set.union(own_attributes_set)

        # 驗證每個提交的欄位是否都在合法清單內
        all_selected = list(metrics) + list(segments) + list(attributes)
        for field in all_selected:
            if field not in valid_fields:
                raise forms.ValidationError(
                    f"The field '{field.field_name}' is not compatible with the resource '{resource.field_name}'."
                )

        return cleaned_data

    def save(self, commit=True):
        # 先呼叫父類別的 save() 來處理通用欄位
        instance = super().save(commit=False)

        config = instance.config or {}

        metrics_list = [field.field_name for field in self.cleaned_data.get('selected_metrics', [])]
        segments_list = [field.field_name for field in self.cleaned_data.get('selected_segments', [])]
        attributes_list = [field.field_name for field in self.cleaned_data.get('selected_attributes', [])]

        config.update({
            'customer_id': self.cleaned_data.get('customer_id'),
            'resource_name': self.cleaned_data.get('resource_name').field_name, # 存 field_name
            'metrics': metrics_list,
            'segments': segments_list,
            'attributes': attributes_list,
        })
        instance.config = config
        
        client = instance.client
        if not client.is_oauth_authorized():
             # 在表單層級引發一個驗證錯誤，而不是在 view 中重導向
            raise forms.ValidationError(
                "This client needs Google OAuth authorization. Please authorize first."
            )
        
        instance.social_account = client.google_social_account
        instance.status = "PENDING"

        # 因為 setup_dts_transfer 需要一個已儲存的物件 (帶有 pk)，所以我們先儲存一次
        if commit:
            instance.save()
        
        return instance

class FacebookAdsForm(BaseConnectionForm):
    # 只定義 Facebook 專用的欄位
    facebook_ad_account_id = forms.ChoiceField(label="Facebook Ad Account ID", required=True)

    # 將 selected_fields 拆分為三個獨立的欄位
    selected_breakdowns = forms.MultipleChoiceField(
        label='Select Breakdowns',
        choices=get_facebook_field_choices, # 這裡假設 get_facebook_field_choices 會回傳所有可能的選項
        widget=forms.SelectMultiple,
        required=False, # 允許不選
    )
    
    selected_action_breakdowns = forms.MultipleChoiceField(
        label='Select Action Breakdowns',
        choices=get_facebook_field_choices,
        widget=forms.SelectMultiple,
        required=False,
    )

    selected_fields = forms.MultipleChoiceField(
        label='Select Fields',
        choices=get_facebook_field_choices,
        widget=forms.SelectMultiple,
        required=True, # Metrics/Fields 至少要選一個
        help_text="Select the fields, dimensions, action dimensions, and metrics for your reports."
    )

    insights_level = forms.ChoiceField(
                    label='Insights Level',
                    choices=[
                        ('campaign', 'Campaign'),
                        ('adset', 'Ad Set'),
                        ('ad', 'Ad'),
                    ],
                    initial='campaign',
                    widget=forms.Select(attrs={'class': 'form-select'})
                )
    
    date_range_type = forms.ChoiceField(
                choices=[('preset', 'Use Date Preset'), ('custom', 'Custom Date Range')],
                widget=forms.RadioSelect,
                initial='preset',
                required=True
                )
    
    date_preset = forms.ChoiceField(
                    choices=[
                        ('today', 'Today'),
                        ('yesterday', 'Yesterday'),
                        ('this_month', 'This Month'),
                        ('last_month', 'Last Month'),
                        ('this_quarter', 'This Quarter'),
                        ('maximum', 'Maximum'),
                        ('data_maximum', 'Data Maximum'),
                        ('last_3d', 'Last 3 Days'),
                        ('last_7d', 'Last 7 Days'),
                        ('last_14d', 'Last 14 Days'),
                        ('last_28d', 'Last 28 Days'),
                        ('last_30d', 'Last 30 Days'),
                        ('last_90d', 'Last 90 Days'),
                        ('last_week_mon_sun', 'Last Week (Mon-Sun)'),
                        ('last_week_sun_sat', 'Last Week (Sun-Sat)'),
                        ('last_quarter', 'Last Quarter'),
                        ('last_year', 'Last Year'),
                        ('this_week_mon_today', 'This Week (Mon-Today)'),
                        ('this_week_sun_today', 'This Week (Sun-Today)'),
                        ('this_year', 'This Year'),
                    ], 
                    required=False, # 只有在 date_range_type 為 'preset' 時才需要
                    widget=forms.Select(attrs={'class': 'form-select'})
                )
    date_since = forms.DateField(required=False, widget=forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}))
    date_until = forms.DateField(required=False, widget=forms.DateInput(attrs={'type': 'date', 'class': 'form-control'}))

    class Meta(BaseConnectionForm.Meta):
        fields = BaseConnectionForm.Meta.fields + [
            'facebook_ad_account_id', 'insights_level',
            'selected_breakdowns', 'selected_action_breakdowns', 'selected_fields',
            'date_range_type', 'date_preset', 'date_since', 'date_until'
        ]

    def __init__(self, *args, **kwargs):
        # 接收從 view 傳來的動態選項
        facebook_ad_accounts_choices = kwargs.pop('facebook_ad_accounts_choices', [])
        super().__init__(*args, **kwargs)
        
        # 動態設定下拉選單的選項
        self.fields['facebook_ad_account_id'].choices = [('', '--- Select Ad Account ---')] + facebook_ad_accounts_choices

    def save(self, commit=True):
        instance = super().save(commit=False)

        if self.instance.client and self.instance.client.facebook_social_account:
            instance.social_account = self.instance.client.facebook_social_account
        
        # 更新 config 以儲存三個獨立的欄位列表
        instance.config.update({
            'facebook_ad_account_id': self.cleaned_data.get('facebook_ad_account_id'),
            'selected_breakdowns': self.cleaned_data.get('selected_breakdowns'),
            'selected_action_breakdowns': self.cleaned_data.get('selected_action_breakdowns'),
            'selected_fields': self.cleaned_data.get('selected_fields'),
            'insights_level': self.cleaned_data.get('insights_level'),
            'date_range_type': self.cleaned_data.get('date_range_type'),
            'date_preset': self.cleaned_data.get('date_preset'),
            'date_since': str(self.cleaned_data.get('date_since')) if self.cleaned_data.get('date_since') else None,
            'date_until': str(self.cleaned_data.get('date_until')) if self.cleaned_data.get('date_until') else None,
        })
        
        if commit:
            instance.save()
        return instance
