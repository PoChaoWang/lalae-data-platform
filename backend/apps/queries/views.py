from django.shortcuts import render, get_object_or_404, redirect
from django.urls import reverse_lazy
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView, View
from django.contrib.auth.mixins import LoginRequiredMixin # 如果需要登入
from django.http import HttpResponse, JsonResponse, Http404
from django.utils import timezone
from django.views.decorators.http import require_POST, require_http_methods
from django.utils.decorators import method_decorator
from .models import QueryDefinition, QueryExecution, QueryRunResult
from .forms import QueryDefinitionForm
from google.cloud import bigquery
from google.api_core import exceptions
from apps.clients.models import Client, ClientSetting  # 添加這行來導入 Client 和 ClientSetting 模型
from io import StringIO
from datetime import timedelta
import json
import csv
from django.contrib.auth.decorators import login_required
from .tasks import test_bigquery_query
from django.contrib import messages

class DatasetSelectView(LoginRequiredMixin, View):
    template_name = 'queries/dataset_select.html'

    def get(self, request):
        selected_dataset = request.session.get('selected_dataset', '')
        # 獲取使用者有權限的客戶資料集
        client_settings = ClientSetting.objects.filter(
            user=request.user,
            client__is_active=True,
            client__bigquery_dataset_id__isnull=False
        ).select_related('client')
        
        client_datasets = []
        for setting in client_settings:
            dataset_info = {
                'client_name': setting.client.name,
                'dataset_id': setting.client.bigquery_dataset_id,
                'description': f"Access Level: {'Owner' if setting.is_owner else 'Viewer'}"
            }
            client_datasets.append(dataset_info)

        return render(request, self.template_name, {
            'selected_dataset': selected_dataset,
            'client_datasets': client_datasets
        })

    def post(self, request):
        dataset_id = request.POST.get('dataset_id', '').strip()
        if not dataset_id:
            return render(request, self.template_name, {
                'error_message': 'Please enter a dataset ID',
                'selected_dataset': dataset_id
            })

        # 檢查使用者是否有權限訪問該資料集
        try:
            client = Client.objects.get(bigquery_dataset_id=dataset_id)
            client_setting = ClientSetting.objects.get(client=client, user=request.user)
            
            if not client.is_active:
                return render(request, self.template_name, {
                    'error_message': 'This client is no longer active',
                    'selected_dataset': dataset_id
                })

            # 驗證資料集是否存在於 BigQuery
            bq_client = bigquery.Client()
            dataset_ref = bq_client.dataset(dataset_id)
            bq_client.get_dataset(dataset_ref)
            
            # 保存到 session
            request.session['selected_dataset'] = dataset_id
            return redirect('queries:query-list')
        except Client.DoesNotExist:
            return render(request, self.template_name, {
                'error_message': f'Dataset "{dataset_id}" not found',
                'selected_dataset': dataset_id
            })
        except ClientSetting.DoesNotExist:
            return render(request, self.template_name, {
                'error_message': 'You do not have permission to access this dataset',
                'selected_dataset': dataset_id
            })
        except exceptions.NotFound:
            return render(request, self.template_name, {
                'error_message': f'Dataset "{dataset_id}" not found in BigQuery',
                'selected_dataset': dataset_id
            })
        except Exception as e:
            return render(request, self.template_name, {
                'error_message': f'Error: {str(e)}',
                'selected_dataset': dataset_id
            })

def get_dataset_tables(request):
    """Get list of tables and their columns from BigQuery dataset."""
    client = bigquery.Client()
    dataset_id = request.session.get('selected_dataset')
    if not dataset_id:
        return []
        
    dataset_ref = client.dataset(dataset_id)
    
    try:
        tables = []
        for table in client.list_tables(dataset_ref):
            table_ref = dataset_ref.table(table.table_id)
            table_obj = client.get_table(table_ref)
            
            columns = []
            for field in table_obj.schema:
                columns.append({
                    'name': field.name,
                    'type': field.field_type
                })
            
            tables.append({
                'name': table.table_id,
                'columns': columns
            })
        
        return tables
    except Exception as e:
        print(f"Error getting tables: {e}")
        return []

# --- QueryDefinition CRUD ---
class QueryDefinitionListView(LoginRequiredMixin, ListView):
    model = QueryDefinition
    template_name = 'queries/querydefinition_list.html' 
    context_object_name = 'queries'
    paginate_by = 15
    ordering = ['-last_run_initiated_at']

    def get(self, request, *args, **kwargs):
        if not request.session.get('selected_dataset'):
            return redirect('queries:dataset-select')
            
        # 檢查當前選擇的資料集是否仍然有權限訪問
        try:
            client = Client.objects.get(bigquery_dataset_id=request.session['selected_dataset'])
            client_setting = ClientSetting.objects.get(client=client, user=request.user)
            if not client.is_active:
                return redirect('queries:dataset-select')
        except (Client.DoesNotExist, ClientSetting.DoesNotExist):
            return redirect('queries:dataset-select')
            
        return super().get(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # 獲取使用者有權限的客戶資料集
        client_settings = ClientSetting.objects.filter(
            user=self.request.user,
            client__is_active=True
        ).select_related('client')
        
        client_datasets = []
        for setting in client_settings:
            if setting.client.bigquery_dataset_id:  # 確保有資料集 ID
                dataset_info = {
                    'client_name': setting.client.name,
                    'dataset_id': setting.client.bigquery_dataset_id,
                    'description': f"Access Level: {'Owner' if setting.is_owner else 'Viewer'}"
                }
                client_datasets.append(dataset_info)

        context['client_datasets'] = client_datasets
        context['current_dataset'] = self.request.session.get('selected_dataset', '')
        
        # 獲取當前資料集的客戶資訊
        try:
            current_client = Client.objects.get(bigquery_dataset_id=context['current_dataset'])
            current_setting = ClientSetting.objects.get(client=current_client, user=self.request.user)
            context['current_client_name'] = current_client.name
            context['current_access_level'] = 'Owner' if current_setting.is_owner else 'Viewer'
        except (Client.DoesNotExist, ClientSetting.DoesNotExist):
            context['current_client_name'] = 'Unknown'
            context['current_access_level'] = 'No Access'
            
        return context

    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter by the selected dataset
        dataset_id = self.request.session.get('selected_dataset')
        if dataset_id:
            queryset = queryset.filter(bigquery_dataset_id=dataset_id)
        
        # Add execution status information
        for query in queryset:
            latest_result = query.run_results.first()
            if latest_result:
                query._latest_status = latest_result.status
                query._latest_execution_time = latest_result.executed_at
                query._has_downloadable_result = (
                    latest_result.status in ['SUCCESS', 'OUTPUT_ERROR'] and
                    latest_result.result_data_csv and
                    latest_result.executed_at > timezone.now() - timedelta(days=30)
                )
            else:
                query._latest_status = 'PENDING'
                query._latest_execution_time = None
                query._has_downloadable_result = False
        return queryset

class QueryDefinitionDetailView(LoginRequiredMixin, DetailView):
    model = QueryDefinition
    template_name = 'queries/querydefinition_detail.html' 
    context_object_name = 'query_def'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['executions'] = self.object.executions.all().order_by('-started_at')[:20] 
        return context

class QueryDefinitionCreateView(LoginRequiredMixin, CreateView):
    model = QueryDefinition
    form_class = QueryDefinitionForm
    template_name = 'queries/querydefinition_form.html' 
    success_url = reverse_lazy('queries:query-list') 

    def get(self, request, *args, **kwargs):
        if not request.session.get('selected_dataset'):
            return redirect('queries:dataset-select')
        return super().get(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['dataset_tables'] = get_dataset_tables(self.request)
        return context

    def form_valid(self, form):
        form.instance.owner = self.request.user
        form.instance.last_run_status = 'PENDING'
        form.instance.bigquery_dataset_id = self.request.session.get('selected_dataset')
        return super().form_valid(form)

class QueryDefinitionUpdateView(LoginRequiredMixin, UpdateView):
    model = QueryDefinition
    form_class = QueryDefinitionForm
    template_name = 'queries/querydefinition_form.html'

    def get(self, request, *args, **kwargs):
        if not request.session.get('selected_dataset'):
            return redirect('queries:dataset-select')
        return super().get(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['dataset_tables'] = get_dataset_tables(self.request)
        return context

    def get_success_url(self):
        return reverse_lazy('queries:query-detail', kwargs={'pk': self.object.pk})

    def form_valid(self, form):
        form.instance.last_run_status = 'PENDING'
        return super().form_valid(form)

class QueryDefinitionDeleteView(LoginRequiredMixin, DeleteView):
    model = QueryDefinition
    template_name = 'queries/querydefinition_confirm_delete.html' # 需要建立此模板
    success_url = reverse_lazy('queries:query-list')

    # 可以加入權限檢查
    # def get_queryset(self):
    #     queryset = super().get_queryset()
    #     return queryset.filter(owner=self.request.user)

# --- 查詢執行相關 ---
def trigger_query_execution(request, pk):
    query_def = get_object_or_404(QueryDefinition, pk=pk)
    # 權限檢查 (例如: 只有 owner 或特定群組可以執行)
    # if query_def.owner != request.user and not request.user.is_staff:
    #     return HttpResponse("Unauthorized", status=403)

    # 建立 QueryExecution 紀錄
    execution = QueryExecution.objects.create(
        query_definition=query_def,
        triggered_by='MANUAL', # 或 request.user.username
        status='PENDING',
        started_at=timezone.now() # 標記為已開始處理 (送入隊列)
    )

    # **非同步執行 BigQuery 查詢**
    # run_bigquery_query_task.delay(execution.id) # 使用 Celery
    # 如果是同步執行 (不建議用於可能長時間的查詢):
    # from .bq_services import execute_and_handle_bq_query # 你需要建立這個服務函數
    # execute_and_handle_bq_query(execution.id)


    # 這裡只是示意，實際執行應該用 Celery task
    # 模擬執行
    # import time
    # time.sleep(2) # 模擬 BigQuery 執行
    # execution.status = 'SUCCESS'
    # execution.completed_at = timezone.now()
    # execution.result_message = "手動模擬執行成功。"
    # execution.result_rows_count = 100
    # execution.save()

    # return redirect('queries:query-detail', pk=query_def.pk)
    return JsonResponse({'status': 'success', 'message': f'查詢 "{query_def.name}" 已加入執行佇列。', 'execution_id': execution.id})


def download_query_result(request, result_pk):
    result = get_object_or_404(QueryRunResult, pk=result_pk)
    
    if not result.result_data_csv:
        raise Http404("No result data available")
    
    if result.executed_at < timezone.now() - timedelta(days=30):
        raise Http404("Result has expired")
    
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="query_result_{result.query.name}_{result.executed_at.strftime("%Y%m%d_%H%M%S")}.csv"'
    
    response.write(result.result_data_csv)
    return response

def switch_dataset(request):
    """切換當前選擇的資料集"""
    if request.method == 'POST':
        dataset_id = request.POST.get('dataset_id')
        if dataset_id:
            try:
                # 檢查使用者是否有權限訪問該資料集
                client = Client.objects.get(bigquery_dataset_id=dataset_id)
                client_setting = ClientSetting.objects.get(client=client, user=request.user)
                
                if not client.is_active:
                    messages.error(request, 'This client is no longer active')
                    return redirect('queries:query-list')

                # 驗證資料集是否存在於 BigQuery
                bq_client = bigquery.Client()
                dataset_ref = bq_client.dataset(dataset_id)
                bq_client.get_dataset(dataset_ref)
                
                # 保存到 session
                request.session['selected_dataset'] = dataset_id
                return redirect('queries:query-list')
            except Client.DoesNotExist:
                messages.error(request, 'Dataset not found')
                return redirect('queries:query-list')
            except ClientSetting.DoesNotExist:
                messages.error(request, 'You do not have permission to access this dataset')
                return redirect('queries:query-list')
            except Exception as e:
                messages.error(request, str(e))
                return redirect('queries:query-list')
    messages.error(request, 'Invalid request')
    return redirect('queries:query-list')

@method_decorator(require_POST, name='dispatch')
class TestQueryView(LoginRequiredMixin, View):
    def post(self, request, pk):
        query_def = get_object_or_404(QueryDefinition, pk=pk)
        
        try:
            # Execute the query
            client = bigquery.Client()
            query_job = client.query(query_def.sql_query)
            results = query_job.result()
            
            # Convert to list of dicts for JSON serialization
            rows = []
            for row in results:
                rows.append(dict(row.items()))
            
            # Store first 10 rows for preview
            preview_rows = rows[:10]
            
            return JsonResponse({
                'status': 'success',
                'preview_rows': preview_rows,
                'total_rows': len(rows),
                'columns': list(rows[0].keys()) if rows else []
            })
            
        except Exception as e:
            return JsonResponse({
                'status': 'error',
                'error_message': str(e)
            }, status=400)

@method_decorator(require_POST, name='dispatch')
class RunQueryView(LoginRequiredMixin, View):
    def post(self, request, pk):
        query_def = get_object_or_404(QueryDefinition, pk=pk)
        
        # Create a new run result
        run_result = QueryRunResult.objects.create(
            query=query_def,
            status='RUNNING'
        )
        
        try:
            # Execute the query
            client = bigquery.Client()
            query_job = client.query(query_def.sql_query)
            results = query_job.result()
            
            # Convert to CSV
            output = StringIO()
            writer = csv.writer(output)
            
            # Write header
            if results:
                writer.writerow(results[0].keys())
                # Write data
                for row in results:
                    writer.writerow(row.values())
            
            # Store the result
            run_result.result_data_csv = output.getvalue()
            run_result.status = 'SUCCESS'
            
            # Update query definition
            query_def.last_run_status = 'SUCCESS'
            query_def.last_run_initiated_at = timezone.now()
            query_def.last_successful_run_result = run_result
            query_def.save()
            
            # Handle output target if specified
            if query_def.output_target != 'NONE':
                try:
                    self._handle_output_target(query_def, run_result)
                except Exception as e:
                    run_result.status = 'OUTPUT_ERROR'
                    run_result.error_message = f"Query succeeded but output failed: {str(e)}"
                    run_result.save()
                    query_def.last_run_status = 'OUTPUT_ERROR'
                    query_def.save()
            
            return JsonResponse({
                'status': 'success',
                'message': 'Query executed successfully'
            })
            
        except Exception as e:
            run_result.status = 'FAILED'
            run_result.error_message = str(e)
            run_result.save()
            
            query_def.last_run_status = 'FAILED'
            query_def.save()
            
            return JsonResponse({
                'status': 'error',
                'error_message': str(e)
            }, status=400)
    
    def _handle_output_target(self, query_def, run_result):
        output_config = query_def.output_config
        
        if query_def.output_target == 'GOOGLE_SHEET':
            # Implement Google Sheet output
            pass
        elif query_def.output_target == 'LOOKER_STUDIO':
            # Implement BigQuery table output for Looker Studio
            pass

@login_required
@require_http_methods(["POST"])
def test_query(request):
    try:
        data = json.loads(request.body)
        sql_query = data.get('sql_query')
        
        if not sql_query:
            return JsonResponse({'error': 'No SQL query provided'}, status=400)

        # Get the current dataset from session
        dataset_id = request.session.get('selected_dataset')
        if not dataset_id:
            return JsonResponse({'error': 'No dataset selected'}, status=400)

        # Modify the query to include dataset name
        # This is a simple approach - you might need more sophisticated SQL parsing
        # to handle complex queries with multiple tables
        modified_query = sql_query.replace('FROM ', f'FROM `{dataset_id}`.')
        modified_query = modified_query.replace('JOIN ', f'JOIN `{dataset_id}`.')
        modified_query = modified_query.replace('INNER JOIN ', f'INNER JOIN `{dataset_id}`.')
        modified_query = modified_query.replace('LEFT JOIN ', f'LEFT JOIN `{dataset_id}`.')
        modified_query = modified_query.replace('RIGHT JOIN ', f'RIGHT JOIN `{dataset_id}`.')
        modified_query = modified_query.replace('FULL JOIN ', f'FULL JOIN `{dataset_id}`.')

        # Run the test query task
        task = test_bigquery_query.delay(modified_query)
        
        # Wait for the task to complete (with timeout)
        try:
            result = task.get(timeout=30)  # 30 seconds timeout
            if result['success']:
                return JsonResponse({
                    'success': True,
                    'results': result['results']
                })
            else:
                return JsonResponse({
                    'error': result['error']
                }, status=400)
        except Exception as e:
            return JsonResponse({
                'error': f'Query execution timed out or failed: {str(e)}'
            }, status=400)
        
    except Exception as e:
        return JsonResponse({
            'error': str(e)
        }, status=400)

@login_required
@require_http_methods(["POST"])
def run_query(request):
    try:
        data = json.loads(request.body)
        sql_query = data.get('sql_query')
        query_name = data.get('name', '').strip()
        
        if not sql_query:
            return JsonResponse({'error': 'No SQL query provided'}, status=400)
            
        if not query_name:
            return JsonResponse({'error': 'Query name is required'}, status=400)

        # Get the current dataset from session
        dataset_id = request.session.get('selected_dataset')
        if not dataset_id:
            return JsonResponse({'error': 'No dataset selected'}, status=400)

        # Modify the query to include dataset name
        modified_query = sql_query.replace('FROM ', f'FROM `{dataset_id}`.')
        modified_query = modified_query.replace('JOIN ', f'JOIN `{dataset_id}`.')
        modified_query = modified_query.replace('INNER JOIN ', f'INNER JOIN `{dataset_id}`.')
        modified_query = modified_query.replace('LEFT JOIN ', f'LEFT JOIN `{dataset_id}`.')
        modified_query = modified_query.replace('RIGHT JOIN ', f'RIGHT JOIN `{dataset_id}`.')
        modified_query = modified_query.replace('FULL JOIN ', f'FULL JOIN `{dataset_id}`.')

        # Create a new query definition
        query_def = QueryDefinition.objects.create(
            name=query_name,
            sql_query=sql_query,
            last_run_status='RUNNING',
            last_run_initiated_at=timezone.now(),
            owner=request.user,
            bigquery_dataset_id=dataset_id
        )

        # Create a run result
        run_result = QueryRunResult.objects.create(
            query=query_def,
            status='RUNNING'
        )

        try:
            # Execute the query
            client = bigquery.Client()
            query_job = client.query(modified_query)
            results = query_job.result()
            
            # Convert results to CSV
            output = StringIO()
            writer = csv.writer(output)
            
            # Get the first row to get column names
            first_row = next(iter(results), None)
            if first_row:
                # Write header
                writer.writerow(first_row.keys())
                # Write first row
                writer.writerow(first_row.values())
                # Write remaining rows
                for row in results:
                    writer.writerow(row.values())
            
            # Store the result
            run_result.result_data_csv = output.getvalue()
            run_result.status = 'SUCCESS'
            run_result.save()
            
            # Update query definition
            query_def.last_run_status = 'SUCCESS'
            query_def.last_successful_run_result = run_result
            query_def.save()
            
            return JsonResponse({
                'success': True,
                'query_id': query_def.id,
                'message': 'Query executed successfully'
            })
            
        except Exception as e:
            run_result.status = 'FAILED'
            run_result.error_message = str(e)
            run_result.save()
            
            query_def.last_run_status = 'FAILED'
            query_def.save()
            
            return JsonResponse({
                'error': str(e)
            }, status=400)
        
    except Exception as e:
        return JsonResponse({
            'error': str(e)
        }, status=400)

@login_required
@require_http_methods(["POST"])
def save_query(request, pk=None):
    print("save_query view called with pk:", pk) # Debug log
    try:
        data = json.loads(request.body)
        print("Received data:", data) # Debug log
        
        sql_query = data.get('sql_query')
        query_name = data.get('name', '').strip()
        
        if not sql_query:
            print("No SQL query provided") # Debug log
            return JsonResponse({'error': 'No SQL query provided'}, status=400)
            
        if not query_name:
            print("No query name provided") # Debug log
            return JsonResponse({'error': 'Query name is required'}, status=400)

        # Get the current dataset from session
        dataset_id = request.session.get('selected_dataset')
        if not dataset_id:
            print("No dataset selected") # Debug log
            return JsonResponse({'error': 'No dataset selected'}, status=400)
    
        if pk:  # If pk is provided, update existing query
            try:
                query_def = QueryDefinition.objects.get(pk=pk)
                # Check if user has permission to edit this query
                if query_def.owner != request.user:
                    return JsonResponse({'error': 'You do not have permission to edit this query'}, status=403)
                
                print(f"Updating existing query: id={pk}") # Debug log
                query_def.name = query_name
                query_def.sql_query = sql_query
                query_def.last_run_status = 'PENDING'
                query_def.save()
                
                print(f"Query updated successfully: id={pk}") # Debug log
                return JsonResponse({
                    'success': True,
                    'query_id': query_def.id,
                    'message': 'Query Updated Successfully'
                })
            except QueryDefinition.DoesNotExist:
                return JsonResponse({'error': 'Query not found'}, status=404)
        else:  # Create new query
            print(f"Creating new query definition: name={query_name}, dataset={dataset_id}") # Debug log
            
            # Create a new query definition
            query_def = QueryDefinition.objects.create(
                name=query_name,
                sql_query=sql_query,
                last_run_status='PENDING',
                last_run_initiated_at=timezone.now(),
                owner=request.user,
                bigquery_dataset_id=dataset_id
            )
            
            print(f"Query definition created with ID: {query_def.id}") # Debug log
            
            return JsonResponse({
                'success': True,
                'query_id': query_def.id,
                'message': 'Query Pending'
            })
    except Exception as e:
        print(f"Error in save_query: {str(e)}") # Debug log
        return JsonResponse({
            'error': str(e)
        }, status=400)

@login_required
@require_http_methods(["POST"])
def rerun_query(request, pk):
    try:
        query_def = QueryDefinition.objects.get(id=pk)

        # Get the current dataset from session
        dataset_id = request.session.get('selected_dataset')
        if not dataset_id:
            return JsonResponse({'status': 'error', 'message': 'No dataset selected'}, status=400)

        # Modify the query to include dataset name
        # This is a simple approach - you might need more sophisticated SQL parsing
        # to handle complex queries with multiple tables
        sql_query = query_def.sql_query
        modified_query = sql_query.replace('FROM ', f'FROM `{dataset_id}`.')
        modified_query = modified_query.replace('JOIN ', f'JOIN `{dataset_id}`.')
        modified_query = modified_query.replace('INNER JOIN ', f'INNER JOIN `{dataset_id}`.')
        modified_query = modified_query.replace('LEFT JOIN ', f'LEFT JOIN `{dataset_id}`.')
        modified_query = modified_query.replace('RIGHT JOIN ', f'RIGHT JOIN `{dataset_id}`.')
        modified_query = modified_query.replace('FULL JOIN ', f'FULL JOIN `{dataset_id}`.')

        # Create a new run result
        run_result = QueryRunResult.objects.create(
            query=query_def,
            status='RUNNING'
        )

        # Update query status
        query_def.last_run_status = 'RUNNING'
        query_def.last_run_initiated_at = timezone.now()
        query_def.save()

        # Start the query execution in background
        try:
            client = bigquery.Client()
            # Use the modified query
            query_job = client.query(modified_query)
            results = query_job.result()

            # Convert results to CSV
            csv_data = []
            # Add header row
            if results and results.schema:
                 csv_data.append(','.join([field.name for field in results.schema]))
            for row in results:
                csv_data.append(','.join(str(value) for value in row))

            # Update run result
            run_result.status = 'SUCCESS'
            run_result.result_data_csv = '\n'.join(csv_data)
            run_result.save()

            # Update query definition
            query_def.last_run_status = 'SUCCESS'
            query_def.last_successful_run_result = run_result
            query_def.save()

            return JsonResponse({'status': 'success'})

        except Exception as e:
            run_result.status = 'FAILED'
            run_result.error_message = str(e)
            run_result.save()

            query_def.last_run_status = 'FAILED'
            query_def.save()

            return JsonResponse({
                'status': 'error',
                'message': str(e)
            }, status=400)

    except QueryDefinition.DoesNotExist:
        return JsonResponse({
            'status': 'error',
            'message': 'Query not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)

@login_required
def download_query_result(request, result_id):
    try:
        result = QueryRunResult.objects.get(id=result_id)
        
        if not result.result_data_csv:
            return JsonResponse({'error': 'No result data available'}, status=404)
        
        response = HttpResponse(result.result_data_csv, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="query_result_{result.id}.csv"'
        return response
        
    except QueryRunResult.DoesNotExist:
        return JsonResponse({'error': 'Result not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

@login_required
@require_http_methods(["POST"])
def check_query_name(request):
    try:
        data = json.loads(request.body)
        name = data.get('name', '').strip()
        
        if not name:
            return JsonResponse({
                'is_available': False,
                'error': 'Query name is required'
            }, status=400)
            
        # Check if name already exists
        exists = QueryDefinition.objects.filter(name=name).exists()
        
        return JsonResponse({
            'is_available': not exists
        })
        
    except Exception as e:
        return JsonResponse({
            'is_available': False,
            'error': str(e)
        }, status=400)

@login_required
@require_http_methods(["GET"])
def get_query_executions(request, pk):
    try:
        query_def = get_object_or_404(QueryDefinition, pk=pk)
        # 獲取該 QueryDefinition 關聯的最近10次 QueryRunResult 記錄
        executions = query_def.run_results.all().order_by('-executed_at')[:10]

        # 準備 JSON 響應數據
        execution_list = []
        for exec in executions:
            execution_list.append({
                'id': exec.id,
                'executed_at': exec.executed_at.strftime('%Y-%m-%d %H:%M:%S') if exec.executed_at else None,
                'status': exec.status,
                'error_message': exec.error_message if exec.status == 'FAILED' or exec.status == 'OUTPUT_ERROR' else None,
            })

        return JsonResponse({
            'status': 'success',
            'executions': execution_list
        })

    except QueryDefinition.DoesNotExist:
        return JsonResponse({
            'status': 'error',
            'message': 'Query not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)