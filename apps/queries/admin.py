from django.contrib import admin
from django.db.models import Q
from django.core.exceptions import PermissionDenied
from django import forms

from .models import QueryDefinition, QueryExecution
from apps.clients.models import Client, ClientSetting

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
            'sql_query': forms.Textarea(attrs={'rows': 10, 'placeholder': 'SELECT * FROM ...'}),
            'output_config': forms.HiddenInput(),
            'schedule_config': forms.Textarea(attrs={'rows': 5}),
        }

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        if self.user and not self.user.is_superuser:
            allowed_dataset_ids = get_allowed_dataset_ids_for_user(self.user, check_edit_manage_rights=True)
            if 'bigquery_dataset_id' in self.fields:
                if allowed_dataset_ids:
                    current_value = self.instance.bigquery_dataset_id if self.instance and self.instance.pk else None
                    choices = [(bid, bid) for bid in allowed_dataset_ids]
                    if current_value and current_value not in allowed_dataset_ids:
                        choices.append((current_value, f"{current_value} (current, access may be restricted for changes)"))
                        choices = sorted(list(set(choices)))
                    self.fields['bigquery_dataset_id'].widget = forms.Select(choices=choices)
                    if not choices:
                        self.fields['bigquery_dataset_id'].disabled = True
                        self.fields['bigquery_dataset_id'].help_text = "You do not have permission to manage any dataset IDs."
                    elif len(choices) == 1 and not current_value:
                        self.fields['bigquery_dataset_id'].initial = choices[0][0]
                else:
                    self.fields['bigquery_dataset_id'].disabled = True
                    self.fields['bigquery_dataset_id'].help_text = "You do not have permission to set a dataset ID."
        if self.instance and self.instance.pk and self.user and not self.user.is_superuser:
            if not user_can_modify_dataset(self.user, self.instance.bigquery_dataset_id):
                if 'bigquery_dataset_id' in self.fields:
                    self.fields['bigquery_dataset_id'].disabled = True
                    self.fields['bigquery_dataset_id'].help_text = "You do not have permission to change the dataset ID of this query."

    def clean_bigquery_dataset_id(self):
        dataset_id = self.cleaned_data.get('bigquery_dataset_id')
        if self.user and not self.user.is_superuser:
            if not dataset_id:
                raise forms.ValidationError("BigQuery Dataset ID is required.")
            if not user_can_modify_dataset(self.user, dataset_id):
                raise forms.ValidationError("You do not have permission to use this BigQuery Dataset ID.")
        return dataset_id


# --- Helper Functions for Permissions ---

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
        user=user,
        client__bigquery_dataset_id__isnull=False,
        client__is_active=True
    )

    if check_edit_manage_rights:
        query_filters &= (Q(can_edit=True) | Q(can_manage_gcp=True) | Q(is_owner=True))

    allowed_ids = ClientSetting.objects.filter(query_filters)\
        .values_list('client__bigquery_dataset_id', flat=True).distinct()
    return list(allowed_ids)

def user_has_general_access(user):
    """Checks if the user has access to any dataset."""
    if user.is_superuser:
        return True
    return ClientSetting.objects.filter(
        user=user,
        client__bigquery_dataset_id__isnull=False,
        client__is_active=True
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
        client__is_active=True
    ).exists()

# --- Admin Class for QueryExecution (Inline and standalone) ---

class QueryExecutionInline(admin.TabularInline):
    model = QueryExecution
    extra = 0
    readonly_fields = ('triggered_by', 'status', 'started_at', 'completed_at', 'result_message', 'result_rows_count', 'result_storage_path', 'result_output_link', 'query_definition_link')
    fields = ('query_definition_link', 'status', 'triggered_by', 'started_at', 'completed_at', 'result_rows_count', 'result_message', 'result_output_link')
    can_delete = False # Generally, execution records are not deleted by users
    show_change_link = False # No separate change page for executions from inline if all read-only

    def query_definition_link(self, obj):
        return obj.query_definition.name
    query_definition_link.short_description = "Query Name (from Execution)"

    def has_view_permission(self, request, obj=None): # obj is the parent QueryDefinition
        if not obj: # Should not happen in inline context for viewing parent
            return False
        # User can view executions if they can view the parent QueryDefinition
        return QueryDefinitionAdmin(QueryDefinition, admin.site).has_view_permission(request, obj)

    def has_add_permission(self, request, obj=None): # obj is parent QueryDefinition
        return False # Executions are not added via inline

    def has_change_permission(self, request, obj=None): # obj here is QueryExecution instance
        return False # Executions are read-only here

    def has_delete_permission(self, request, obj=None): # obj here is QueryExecution instance
         # Only superusers might be allowed to delete, and not from inline easily
        return request.user.is_superuser


@admin.register(QueryExecution)
class QueryExecutionAdmin(admin.ModelAdmin):
    list_display = ('get_query_definition_name', 'status', 'triggered_by', 'started_at', 'completed_at', 'result_rows_count')
    list_filter = ('status', 'triggered_by', 'query_definition__bigquery_dataset_id')
    search_fields = ('query_definition__name', 'result_message')
    readonly_fields = ('query_definition', 'triggered_by', 'status', 'started_at', 'completed_at', 'result_message', 'result_rows_count', 'result_storage_path', 'result_output_link')

    def get_query_definition_name(self, obj):
        return obj.query_definition.name
    get_query_definition_name.short_description = 'Query Definition Name'
    get_query_definition_name.admin_order_field = 'query_definition__name'

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
        if not allowed_view_ids: # User has no dataset access at all
            return False
        if obj is None: # Changelist view
            return True # get_queryset handles filtering
        return obj.query_definition.bigquery_dataset_id in allowed_view_ids

    def has_add_permission(self, request):
        return False # QueryExecutions are created by the system/tasks

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser # Only superuser for emergency edits

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser # Only superuser for emergency deletions

    def has_module_permission(self, request):
        return user_has_general_access(request.user)

# --- Admin Class for QueryDefinition ---

@admin.register(QueryDefinition)
class QueryDefinitionAdmin(admin.ModelAdmin):
    form = QueryDefinitionForm
    list_display = ('name', 'bigquery_dataset_id', 'get_schedule_summary', 'output_target', 'last_run_status', 'owner', 'updated_at')
    list_filter = ('output_target', 'last_run_status', 'bigquery_dataset_id')
    search_fields = ('name', 'description', 'sql_query', 'bigquery_dataset_id')
    inlines = [QueryExecutionInline]
    actions = ['run_selected_queries_action']

    fieldsets = (
        (None, {
            'fields': ('name', 'description', 'sql_query')
        }),
        ('BigQuery Configuration', {
            'fields': ('bigquery_project_id', 'bigquery_dataset_id')
        }),
        ('Scheduling', {
            'fields': ('schedule_config',) 
        }),
        ('Output', {
            'fields': ('output_target', 'output_config')
        }),
        ('Ownership', {
            'fields': ('owner',)
        }),
    )
    readonly_fields = ('owner', 'last_run_status', 'last_run_initiated_at', 'last_successful_run_result')

    @admin.display(description='Schedule Summary')
    def get_schedule_summary(self, obj):
        config = obj.schedule_config
        if not isinstance(config, dict) or config.get('frequency_type') == 'NONE':
            return "Not Scheduled"
        
        freq_type = config.get('frequency_type', 'N/A').capitalize()
        hour = config.get('hour', '00')
        minute = config.get('minute', '00')
        time_str = f"{str(hour).zfill(2)}:{str(minute).zfill(2)}"

        if freq_type == 'Daily':
            return f"Daily at {time_str}"
        
        if freq_type == 'Weekly':
            days = {'0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat'}
            day_of_week = days.get(str(config.get('week_of_day')), '?')
            return f"Weekly on {day_of_week} at {time_str}"

        if freq_type == 'Monthly':
            day_of_month = config.get('month_of_day', '?')
            return f"Monthly on day {day_of_month} at {time_str}"
            
        return "Custom"

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
            return False # User cannot view any dataset
        if obj is None: # Changelist
            return True # Filtered by get_queryset
        return obj.bigquery_dataset_id in allowed_view_ids

    def has_add_permission(self, request):
        # User can add if they have edit/manage rights for at least one dataset
        return get_allowed_dataset_ids_for_user(request.user, check_edit_manage_rights=True) is not None and \
               len(get_allowed_dataset_ids_for_user(request.user, check_edit_manage_rights=True)) > 0


    def has_change_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is None: # When checking for the "change" button in changelist or add view access
            # User can change objects if they have edit/manage rights for *any* dataset they could potentially see
             return get_allowed_dataset_ids_for_user(request.user, check_edit_manage_rights=True) is not None and \
                    len(get_allowed_dataset_ids_for_user(request.user, check_edit_manage_rights=True)) > 0
        return user_can_modify_dataset(request.user, obj.bigquery_dataset_id)

    def has_delete_permission(self, request, obj=None):
        if request.user.is_superuser:
            return True
        if obj is None: # Similar to change permission for general "delete" action availability
            return get_allowed_dataset_ids_for_user(request.user, check_edit_manage_rights=True) is not None and \
                   len(get_allowed_dataset_ids_for_user(request.user, check_edit_manage_rights=True)) > 0 # more specific: check owner or specific delete permission
        # Typically, only owners or those with high privileges (can_manage_gcp) should delete
        return ClientSetting.objects.filter(
            Q(is_owner=True) | Q(can_manage_gcp=True),  # Example: Owner or GCP manager can delete
            user=request.user,
            client__bigquery_dataset_id=obj.bigquery_dataset_id,
            client__is_active=True
        ).exists()

    def has_module_permission(self, request):
        return user_has_general_access(request.user)

    def save_model(self, request, obj, form, change):
        if not obj.owner_id: # Set owner on creation if not already set
            obj.owner = request.user
        
        # Security check: ensure the dataset_id is one the user can manage
        # This is especially important if the form field wasn't perfectly restricted
        chosen_dataset_id = form.cleaned_data.get('bigquery_dataset_id')
        if not request.user.is_superuser and not user_can_modify_dataset(request.user, chosen_dataset_id):
            self.message_user(request, "You do not have permission to create or modify queries for the selected BigQuery Dataset ID.", level='ERROR')
            raise PermissionDenied("Insufficient permissions for this BigQuery Dataset ID.")
        
        super().save_model(request, obj, form, change)

    def get_form(self, request, obj=None, **kwargs):
        # Pass the user to the form
        kwargs['form'] = self.get_form_class(request, obj)
        form = super().get_form(request, obj, **kwargs)
        # The form's __init__ will handle dataset_id choices
        return form

    def get_form_class(self, request, obj=None):
        """
        Returns the form class to use.
        We pass the request to the form's __init__ method.
        """
        # Store the request in a way the form's __init__ can access it,
        # or pass it directly if your Django version supports it easily.
        # A common pattern is to dynamically create a form class with the user.
        class FormWithUser(QueryDefinitionForm):
            def __init__(self, *args, **inner_kwargs):
                inner_kwargs['user'] = request.user
                super().__init__(*args, **inner_kwargs)
        return FormWithUser

    def run_selected_queries_action(self, request, queryset):
        triggered_count = 0
        for query_def in queryset:
            # Additional check: can this user trigger *this specific* query_def?
            # Based on "吻合就可以使用", view permission should be enough to trigger.
            if self.has_view_permission(request, query_def): # or a more specific 'has_run_permission'
                # from .views import trigger_query_execution # Or call task directly
                # For simplicity, let's assume a task:
                from .tasks import run_bigquery_query_task # Ensure this task exists

                execution = QueryExecution.objects.create(
                    query_definition=query_def,
                    triggered_by=f"ADMIN_ACTION_{request.user.username}",
                    status='PENDING'
                )
                run_bigquery_query_task.delay(execution.id)
                triggered_count += 1
            else:
                self.message_user(request, f"You do not have permission to run query: {query_def.name}", level='WARNING')

        if triggered_count > 0:
            self.message_user(request, f"{triggered_count} queries have been sent to the execution queue.")
        else:
            self.message_user(request, "No queries were triggered (possibly due to permissions).", level='WARNING')

    run_selected_queries_action.short_description = "Run selected queries"