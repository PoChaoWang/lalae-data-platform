from django.contrib import admin
from django.db.models import Q
from django.core.exceptions import PermissionDenied
from django import forms

from .models import QueryDefinition, QueryExecution
from apps.clients.models import Client, ClientSetting

import json # 需要導入 json 來處理 output_config

# --- Helper Functions for Permissions (保持不變) ---
def get_allowed_dataset_ids_for_user(user, check_edit_manage_rights=False):
    """
    Returns a list of bigquery_dataset_ids the user is allowed to access.
    If check_edit_manage_rights is True, also checks for can_edit or can_manage_gcp
    in ClientSetting.
    Returns None if superuser (no restrictions).
    Returns an empty list if no permissions.
    """
    if user.is_superuser:
        return None  # No restriction for superuser

    query_filters = Q(
        user=user, client__bigquery_dataset_id__isnull=False, client__is_active=True
    )

    if check_edit_manage_rights:
        query_filters &= Q(can_edit=True) | Q(can_manage_gcp=True) | Q(is_owner=True)

    allowed_ids = (
        ClientSetting.objects.filter(query_filters)
        .values_list("client__bigquery_dataset_id", flat=True)
        .distinct()
    )
    return list(allowed_ids)


def user_has_general_access(user):
    """Checks if the user has access to any dataset."""
    if user.is_superuser:
        return True
    return ClientSetting.objects.filter(
        user=user, client__bigquery_dataset_id__isnull=False, client__is_active=True
    ).exists()


def user_can_modify_dataset(user, dataset_id):
    """Checks if the user has modification rights for a specific dataset_id."""
    if user.is_superuser:
        return True
    if not dataset_id:
        return False
    return ClientSetting.objects.filter(
        Q(can_edit=True) | Q(can_manage_gcp=True) | Q(is_owner=True),
        user=user,
        client__bigquery_dataset_id=dataset_id,
        client__is_active=True,
    ).exists()


# --- QueryDefinitionForm (修改) ---
class QueryDefinitionForm(forms.ModelForm):
    class Meta:
        model = QueryDefinition
        # 這裡的 fields 應該包含所有您希望在 admin 表單中顯示的 QueryDefinition 欄位。
        # 如果您明確列出，請確保它們都在 models.py 中存在。
        # 因為您在 admin class 中已經定義了 fieldsets，這裡也可以使用 '__all__'
        # 但我建議還是明確列出，以避免未來模型變更時自動引入不需要的欄位。
        fields = [
            'name', 'description', 'sql_query',
            'bigquery_project_id', 'bigquery_dataset_id',
            'schedule_type', 'cron_schedule', # 新增的排程欄位
            'output_target', 'output_config', # 新增的輸出欄位
            'owner', # owner 在創建時由 save_model 設定，但可以在 admin 顯示
        ]
        widgets = {
            "description": forms.Textarea(attrs={"rows": 3}),
            "sql_query": forms.Textarea(
                attrs={"rows": 10, "placeholder": "SELECT * FROM ..."}
            ),
            # output_config 是一個 JSONField，通常不需要自定義 widget，
            # Django 會為其提供一個文本區域。如果您想更精細控制，可以為其添加自定義 widget。
            # 例如：
            # "output_config": forms.Textarea(attrs={"rows": 5, "placeholder": "Enter JSON config"})
        }

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user", None)
        super().__init__(*args, **kwargs)
        if self.user and not self.user.is_superuser:
            allowed_dataset_ids = get_allowed_dataset_ids_for_user(
                self.user, check_edit_manage_rights=True
            )
            if "bigquery_dataset_id" in self.fields:
                if allowed_dataset_ids:
                    current_value = (
                        self.instance.bigquery_dataset_id
                        if self.instance and self.instance.pk
                        else None
                    )
                    choices = [(bid, bid) for bid in allowed_dataset_ids]
                    if current_value and current_value not in allowed_dataset_ids:
                        choices.append(
                            (
                                current_value,
                                f"{current_value} (current, access may be restricted for changes)",
                            )
                        )
                        choices = sorted(list(set(choices)))
                    self.fields["bigquery_dataset_id"].widget = forms.Select(
                        choices=choices
                    )
                    if not choices:
                        self.fields["bigquery_dataset_id"].disabled = True
                        self.fields["bigquery_dataset_id"].help_text = (
                            "You do not have permission to manage any dataset IDs."
                        )
                    elif len(choices) == 1 and not current_value:
                        self.fields["bigquery_dataset_id"].initial = choices[0][0]
                else:
                    self.fields["bigquery_dataset_id"].disabled = True
                    self.fields["bigquery_dataset_id"].help_text = (
                        "You do not have permission to set a dataset ID."
                    )
        if (
            self.instance
            and self.instance.pk
            and self.user
            and not self.user.is_superuser
        ):
            if not user_can_modify_dataset(
                self.user, self.instance.bigquery_dataset_id
            ):
                if "bigquery_dataset_id" in self.fields:
                    self.fields["bigquery_dataset_id"].disabled = True
                    self.fields["bigquery_dataset_id"].help_text = (
                        "You do not have permission to change the dataset ID of this query."
                    )

    def clean_bigquery_dataset_id(self):
        dataset_id = self.cleaned_data.get("bigquery_dataset_id")
        if self.user and not self.user.is_superuser:
            if not dataset_id:
                raise forms.ValidationError("BigQuery Dataset ID is required.")
            if not user_can_modify_dataset(self.user, dataset_id):
                raise forms.ValidationError(
                    "You do not have permission to use this BigQuery Dataset ID."
                )
        return dataset_id

    def clean_output_config(self):
        output_config_str = self.cleaned_data.get('output_config')
        output_target = self.cleaned_data.get('output_target')

        if not output_config_str:
            if output_target == 'GOOGLE_SHEET' or output_target == 'LOOKER_STUDIO': 
                raise forms.ValidationError(
                    f"Output configuration is required for {output_target.replace('_', ' ').title()} output." 
                )
            return None

        try:
            config = json.loads(output_config_str)
        except json.JSONDecodeError:
            raise forms.ValidationError("Invalid JSON format for Output Configuration.")

        if output_target == 'GOOGLE_SHEET': 
            sheet_id = config.get("sheet_id")
            if not sheet_id or not str(sheet_id).strip():
                raise forms.ValidationError(
                    {"sheet_id": "Sheet ID is required for Google Sheets output."}
                )
        elif output_target == 'LOOKER_STUDIO': 
            email = config.get("email")
            if not email or not str(email).strip():
                raise forms.ValidationError(
                    {"email": "Email address is required for Google Looker Studio output."}
                )

        return json.dumps(config)



class QueryExecutionInline(admin.TabularInline):
    model = QueryExecution
    extra = 0
    readonly_fields = (
        "triggered_by",
        "status",
        "started_at",
        "completed_at",
        "result_message",
        "result_rows_count",
        "result_storage_path",
        "result_output_link",
        "query_definition_link",
    )
    fields = (
        "query_definition_link",
        "status",
        "triggered_by",
        "started_at",
        "completed_at",
        "result_rows_count",
        "result_message",
        "result_output_link",
    )
    can_delete = False
    show_change_link = False

    def query_definition_link(self, obj):
        return obj.query_definition.name

    query_definition_link.short_description = "Query Name (from Execution)"

    def has_view_permission(
        self, request, obj=None
    ):
        if not obj:
            return False
        return QueryDefinitionAdmin(QueryDefinition, admin.site).has_view_permission(
            request, obj
        )

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(
        self, request, obj=None
    ):
        return False

    def has_delete_permission(
        self, request, obj=None
    ):
        return request.user.is_superuser


@admin.register(QueryExecution)
class QueryExecutionAdmin(admin.ModelAdmin):
    list_display = (
        "get_query_definition_name",
        "status",
        "triggered_by",
        "started_at",
        "completed_at",
        "result_rows_count",
    )
    list_filter = ("status", "triggered_by", "query_definition__bigquery_dataset_id")
    search_fields = ("query_definition__name", "result_message")
    readonly_fields = (
        "query_definition",
        "triggered_by",
        "status",
        "started_at",
        "completed_at",
        "result_message",
        "result_rows_count",
        "result_storage_path",
        "result_output_link",
    )

    def get_query_definition_name(self, obj):
        return obj.query_definition.name

    get_query_definition_name.short_description = "Query Definition Name"
    get_query_definition_name.admin_order_field = "query_definition__name"

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        allowed_ids = get_allowed_dataset_ids_for_user(request.user)
        return qs.filter(query_definition__bigquery_dataset_id__in=allowed_ids)

    def has_view_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        allowed_view_ids = get_allowed_dataset_ids_for_user(request.user)
        if not allowed_view_ids:
            return False
        if obj is None:
            return True
        return obj.query_definition.bigquery_dataset_id in allowed_view_ids

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_module_permission(self, request):
        return user_has_general_access(request.user)


# --- Admin Class for QueryDefinition (修改) ---


@admin.register(QueryDefinition)
class QueryDefinitionAdmin(admin.ModelAdmin):
    form = QueryDefinitionForm # 保持使用自定義表單
    list_display = (
        "name",
        "bigquery_dataset_id",
        "get_schedule_summary",
        "output_target",
        "last_run_status",
        "owner",
        "updated_at",
    )
    list_filter = ("output_target", "last_run_status", "bigquery_dataset_id")
    search_fields = ("name", "description", "sql_query", "bigquery_dataset_id")
    inlines = [QueryExecutionInline]
    actions = ["run_selected_queries_action"]

    fieldsets = (
        (None, {"fields": ("name", "description", "sql_query")}),
        (
            "BigQuery Configuration",
            {"fields": ("bigquery_project_id", "bigquery_dataset_id")},
        ),
        # 這裡將 'schedule_config' 替換為 'schedule_type' 和 'cron_schedule'
        ("Scheduling", {"fields": ("schedule_type", "cron_schedule")}),
        ("Output", {"fields": ("output_target", "output_config")}),
        ("Ownership", {"fields": ("owner",)}),
    )
    # 將 'schedule_config' 從唯讀欄位中移除，並添加新的唯讀欄位
    readonly_fields = (
        "owner",
        "last_run_status",
        "last_run_initiated_at",
        "last_successful_run_result",
        "last_successful_test_hash", # 新增
        "last_tested_at", # 新增
        "created_at", # 通常設為唯讀
        "updated_at", # 通常設為唯讀
    )

    @admin.display(description="Schedule Summary")
    def get_schedule_summary(self, obj):
        # 根據 models.py 中新的 schedule_type 和 cron_schedule 欄位來生成摘要
        schedule_type = obj.schedule_type
        cron_schedule = obj.cron_schedule

        if schedule_type == "ONCE":
            return "Once (Manual or One-Time Scheduled)"
        
        if not cron_schedule:
            return "Periodic (Config Missing)"

        # 解析 cron_schedule 字符串，提供更具體的摘要
        # Cron string format: minute hour day_of_month month day_of_week
        try:
            parts = cron_schedule.split()
            minute = parts[0] if parts[0] != '*' else '0' # 預設0分
            hour = parts[1] if parts[1] != '*' else '0' # 預設0時
            day_of_month = parts[2]
            day_of_week = parts[4]

            time_str = f"{str(hour).zfill(2)}:{str(minute).zfill(2)}"

            if schedule_type == "PERIODIC": # PERIODIC 是一個更通用的類型
                if day_of_week == '*' and day_of_month == '*':
                    return f"Daily at {time_str}"
                elif day_of_week != '*' and day_of_month == '*':
                    # 將 Cron 格式的 day_of_week 轉換為可讀的名稱
                    # Cron 格式: 0=Sunday, 1=Monday, ..., 6=Saturday
                    days_map = {
                        "0": "Sun", "1": "Mon", "2": "Tue", "3": "Wed",
                        "4": "Thu", "5": "Fri", "6": "Sat"
                    }
                    display_days = [days_map.get(d, '?') for d in day_of_week.split(',')]
                    return f"Weekly on {', '.join(display_days)} at {time_str}"
                elif day_of_month != '*' and day_of_week == '*':
                    return f"Monthly on day {day_of_month} at {time_str}"
            
            # 如果是其他複雜的 cron 表達式，則顯示原始的 cron 字符串
            return f"Custom Cron: {cron_schedule}"

        except IndexError:
            return f"Invalid Cron: {cron_schedule}"
        except Exception:
            return f"Error parsing Cron: {cron_schedule}"


    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        allowed_ids = get_allowed_dataset_ids_for_user(request.user)
        return qs.filter(bigquery_dataset_id__in=allowed_ids)

    def has_view_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        allowed_view_ids = get_allowed_dataset_ids_for_user(request.user)
        if not allowed_view_ids:
            return False
        if obj is None:
            return True
        return obj.bigquery_dataset_id in allowed_view_ids

    def has_add_permission(self, request):
        return (
            get_allowed_dataset_ids_for_user(
                request.user, check_edit_manage_rights=True
            )
            is not None
            and len(
                get_allowed_dataset_ids_for_user(
                    request.user, check_edit_manage_rights=True
                )
            )
            > 0
        )

    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if (
            obj is None
        ):
            return (
                get_allowed_dataset_ids_for_user(
                    request.user, check_edit_manage_rights=True
                )
                is not None
                and len(
                    get_allowed_dataset_ids_for_user(
                        request.user, check_edit_manage_rights=True
                    )
                )
                > 0
            )
        return user_can_modify_dataset(request.user, obj.bigquery_dataset_id)

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if (
            obj is None
        ):
            return (
                get_allowed_dataset_ids_for_user(
                    request.user, check_edit_manage_rights=True
                )
                is not None
                and len(
                    get_allowed_dataset_ids_for_user(
                        request.user, check_edit_manage_rights=True
                    )
                )
                > 0
            )
        return ClientSetting.objects.filter(
            Q(is_owner=True)
            | Q(can_manage_gcp=True),
            user=request.user,
            client__bigquery_dataset_id=obj.bigquery_dataset_id,
            client__is_active=True,
        ).exists()

    def has_module_permission(self, request):
        return user_has_general_access(request.user)

    def save_model(self, request, obj, form, change):
        if not obj.owner_id:
            obj.owner = request.user

        chosen_dataset_id = form.cleaned_data.get("bigquery_dataset_id")
        if not request.user.is_superuser and not user_can_modify_dataset(
            request.user, chosen_dataset_id
        ):
            self.message_user(
                request,
                "You do not have permission to create or modify queries for the selected BigQuery Dataset ID.",
                level="ERROR",
            )
            raise PermissionDenied(
                "Insufficient permissions for this BigQuery Dataset ID."
            )

        super().save_model(request, obj, form, change)

    def get_form(self, request, obj=None, **kwargs):
        kwargs["form"] = self.get_form_class(request, obj)
        form = super().get_form(request, obj, **kwargs)
        return form

    def get_form_class(self, request, obj=None):
        class FormWithUser(QueryDefinitionForm):
            def __init__(self, *args, **inner_kwargs):
                inner_kwargs["user"] = request.user
                super().__init__(*args, **inner_kwargs)
        return FormWithUser

    def run_selected_queries_action(self, request, queryset):
        triggered_count = 0
        for query_def in queryset:
            if self.has_view_permission(
                request, query_def
            ):
                from .tasks import run_bigquery_query_task

                execution = QueryExecution.objects.create(
                    query_definition=query_def,
                    triggered_by=f"ADMIN_ACTION_{request.user.username}",
                    status="PENDING",
                )
                run_bigquery_query_task.delay(execution.id)
                triggered_count += 1
            else:
                self.message_user(
                    request,
                    f"You do not have permission to run query: {query_def.name}",
                    level="WARNING",
                )

        if triggered_count > 0:
            self.message_user(
                request,
                f"{triggered_count} queries have been sent to the execution queue.",
            )
        else:
            self.message_user(
                request,
                "No queries were triggered (possibly due to permissions).",
                level="WARNING",
            )

    run_selected_queries_action.short_description = "Run selected queries"