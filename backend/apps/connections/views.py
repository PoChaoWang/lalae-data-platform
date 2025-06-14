# backend/apps/connections/views.py
import logging
import urllib.parse
from django.shortcuts import render, get_object_or_404, redirect
from django.views.generic import (
    ListView,
    DetailView,
    CreateView,
    UpdateView,
    DeleteView,
    TemplateView,
)
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy, reverse
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.conf import settings
from django.utils import timezone
from django.http import JsonResponse
from django.views import View
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.middleware.csrf import get_token
import facebook
import requests # Add this for Facebook OAuth token exchange
from allauth.socialaccount.models import SocialApp
# Google specific (minimal, only for what's left in views)
from google.auth import default
from googleapiclient.discovery import build
from google.ads.googleads.client import GoogleAdsClient

from allauth.socialaccount.models import SocialAccount, SocialToken
from allauth.socialaccount.providers.oauth2.views import OAuth2CallbackView
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
import json
# from apps.clients.models import Client # Already imported below

# App-specific imports
from .models import Connection, DataSource, GoogleAdsField, ConnectionExecution, Client
from django.db.models import Q
from .forms import BaseConnectionForm, GoogleAdsForm, FacebookAdsForm, GoogleSheetForm
from apps.clients.models import Client  # Assuming this path is correct

# Import refactored OAuth and DTS logic from apis/google_oauth.py
from .apis.google_oauth import (
    oauth_authorize as api_oauth_authorize,
    _refresh_user_social_token,
    run_custom_gaql_and_save,
    get_google_ads_page_context   
)

# Import Facebook Ads API client
from .apis.facebook_ads import (
    FacebookAdsAPIClient, 
    get_facebook_ads_page_context, # This will be used
    get_facebook_oauth_url,
    get_facebook_fields_structure 
)

from .apis.google_sheet import GoogleSheetAPIClient
from .tasks import sync_connection_data_task
from itertools import chain
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import GoogleAdsField
from .apis.facebook_ads import get_facebook_field_choices, FacebookAdsAPIClient
from allauth.socialaccount.models import SocialToken

from .serializers import ConnectionSerializer, ClientSerializer, DataSourceSerializer, ConnectionExecutionSerializer

logger = logging.getLogger(__name__)

# ===================================================================
# ================== NEW: API ViewSets ==============================
# ===================================================================

class ClientViewSet(viewsets.ReadOnlyModelViewSet):
    """
    提供 Client 列表的唯讀 API 端點
    """
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Client.objects.all().order_by('name')
        # 一般使用者只能看到他們有權限的客戶
        return Client.objects.filter(settings__user=self.request.user).distinct().order_by('name')
    
    

class DataSourceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    提供 DataSource 列表的唯讀 API 端點
    """
    serializer_class = DataSourceSerializer
    permission_classes = [IsAuthenticated]
    queryset = DataSource.objects.filter(
        name__in=["GOOGLE_ADS", "FACEBOOK_ADS", "GOOGLE_SHEET"]
    )
    lookup_field = 'name'


class ConnectionViewSet(viewsets.ModelViewSet):
    """
    一個 ViewSet 用於檢視和編輯 Connection 實例。
    """
    serializer_class = ConnectionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        此 ViewSet 應該只回傳經過認證的使用者有權限的 connections。
        """
        user = self.request.user
        if user.is_superuser:
            return Connection.objects.all().order_by("-created_at")

        accessible_clients = Client.objects.filter(settings__user=user)
        return Connection.objects.filter(client__in=accessible_clients).order_by("-created_at")

    def perform_create(self, serializer):
        """
        在建立新連線時，自動設定 user 和初始狀態。
        """
        # 注意：client_id 和 data_source_id 的處理已移至 Serializer 的 create 方法中
        connection = serializer.save(user=self.request.user, status="PENDING")
        
        # 觸發非同步任務
        logger.info(f"Triggering sync task for new connection {connection.pk}")
        sync_connection_data_task.delay(
            connection.pk,
            triggered_by_user_id=self.request.user.id
        )

    @action(detail=True, methods=['post'], url_path='clone')
    def clone(self, request, pk=None):
        """
        複製一個現有的 Connection。
        對應前端的 'Clone' 按鈕 -> POST /api/connections/{id}/clone/
        """
        original_connection = self.get_object()
        
        # 建立新物件，但不儲存
        new_connection = original_connection
        new_connection.pk = None  # 設為 None 來建立新紀錄
        new_connection.id = None
        new_connection.display_name = f"{original_connection.display_name} (Copy)"
        new_connection.status = "PENDING"
        new_connection.created_at = None # 會自動設定
        new_connection.updated_at = None # 會自動設定
        
        # 儲存新物件
        new_connection.save()
        
        logger.info(f"Cloned connection {original_connection.pk} to new connection {new_connection.pk}")
        
        # 也可以選擇性觸發一次同步
        sync_connection_data_task.delay(
            new_connection.pk,
            triggered_by_user_id=request.user.id
        )

        serializer = self.get_serializer(new_connection)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='run-sync')
    def run_sync(self, request, pk=None):
        """
        手動觸發一次資料同步。
        對應前端的 'Sync Now' 按鈕 -> POST /api/connections/{id}/run-sync/
        """
        connection = self.get_object()
        if not connection.is_enabled:
            return Response(
                {"error": "Connection is disabled."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        sync_connection_data_task.delay(
            connection.pk,
            triggered_by_user_id=request.user.id
        )
        
        return Response(
            {"status": f"Sync task for '{connection.display_name}' has been triggered."},
            status=status.HTTP_200_OK
        )
    
    @action(detail=True, methods=['get'], url_path='executions')
    def executions(self, request, pk=None):
        """
        返回指定 Connection 的所有執行紀錄 (更健壯的版本)
        """
        try:
            connection = self.get_object()
            execution_queryset = ConnectionExecution.objects.filter(connection=connection).order_by('-started_at')
            
            serializer = ConnectionExecutionSerializer(execution_queryset, many=True)
            
            return Response(serializer.data, status=status.HTTP_200_OK)

        except Connection.DoesNotExist:
            return Response({"error": "Connection not found."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            # 捕捉任何其他潛在錯誤，並返回 500 錯誤及訊息
            logger.error(f"Error fetching executions for connection {pk}: {e}", exc_info=True) 
            return Response(
                {"error": "An internal server error occurred while fetching execution history."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

@api_view(['GET'])
@permission_classes([AllowAny])
@csrf_exempt
def get_csrf_token(request):
    token = get_token(request)
    return JsonResponse({'csrfToken': token})

@api_view(['GET'])
def get_google_ads_resources_api(request):
    resources = GoogleAdsField.objects.filter(category='RESOURCE').order_by('field_name')
    data = [{'name': r.field_name, 'display': r.field_name.replace('_', ' ').title()} for r in resources]
    return Response(data)

# ✨ 新增：提供 Facebook Ad Accounts 選項的 API
@api_view(['GET'])
def get_facebook_ad_accounts_api(request):
    client_id = request.query_params.get('client_id')
    if not client_id:
        return Response({"error": "client_id is required"}, status=400)
    
    try:
        client = Client.objects.get(id=client_id)
        if not client.facebook_social_account:
            return Response({"error": "Client not linked to a Facebook account"}, status=400)

        token = SocialToken.objects.get(account=client.facebook_social_account)
        api_client = FacebookAdsAPIClient(
            app_id=settings.FACEBOOK_APP_ID,
            app_secret=settings.FACEBOOK_APP_SECRET,
            access_token=token.token
        )
        accounts = api_client.get_ad_accounts()
        return Response(accounts)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

# ✨ 新增：提供 Facebook 所有欄位定義的 API
@api_view(['GET'])
def get_facebook_all_fields_api(request):
    """
    一個健壯的 API 端點，用於提供 Facebook 所有欄位的定義。
    它直接呼叫一個專門的資料函式，並回傳由 DRF 序列化的 JSON。
    """
    try:
        # 直接呼叫我們新建的函式，它會回傳一個乾淨的 Python 字典
        all_fields_data = get_facebook_fields_structure()
        return Response(all_fields_data)

    except (FileNotFoundError, json.JSONDecodeError) as e:
        logger.error(f"獲取 Facebook 欄位時發生嚴重錯誤: {e}", exc_info=True)
        return Response(
            {"error": "Server configuration error: Could not load Facebook field definitions."}, 
            status=500
        )
    except Exception as e:
        logger.error(f"處理 get_facebook_all_fields_api 時發生未知錯誤: {e}", exc_info=True)
        return Response(
            {"error": "An unexpected server error occurred."}, 
            status=500
        )

# ===================================================================
# =========== EXISTING VIEWS (to be replaced by API) ================
# ===================================================================

class ConnectionListView(LoginRequiredMixin, ListView):
    model = Connection
    template_name = "connections/connection_list.html"
    context_object_name = "connections"

    def get_queryset(self):
        prefetch_name = 'executions__triggered_by'
        # 如果是超級使用者，回傳所有連線
        if self.request.user.is_superuser:
            return Connection.objects.select_related(
                'client', 'data_source'
            ).prefetch_related(
                prefetch_name
            ).all().order_by("-created_at")

        # 找出使用者有權限的所有客戶 (自己建立的或被分享的)
        accessible_clients = Client.objects.filter(settings__user=self.request.user)
        
        # 篩選出所有與這些客戶相關的連線
        return Connection.objects.select_related(
            'client', 'data_source'
        ).prefetch_related(
            prefetch_name
        ).filter(client__in=accessible_clients).order_by("-created_at")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        facebook_connections = self.get_queryset().filter(
            data_source__name="FACEBOOK_ADS"
        )
        context["facebook_connections"] = facebook_connections
        return context


class SelectClientView(LoginRequiredMixin, TemplateView):
    template_name = "connections/select_dataset.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # 如果是超級使用者，顯示所有客戶
        if self.request.user.is_superuser:
            context["clients"] = Client.objects.all().order_by('name')
        else:
            # 一般使用者只顯示他們有權限的客戶
            context["clients"] = Client.objects.filter(settings__user=self.request.user).distinct().order_by('name')
        return context


class SelectDataSourceView(LoginRequiredMixin, TemplateView):
    template_name = "connections/select_data_source.html"

    def get(self, request, *args, **kwargs):
        client_id = request.GET.get("client_id")
        dataset_id = request.GET.get("dataset_id")

        if not client_id or not dataset_id:
            messages.warning(request, "Please select a client first.")
            return redirect("connections:select_dataset")

        try:
            client = Client.objects.get(id=client_id)
            request.session["selected_client_id"] = str(client.id)
            request.session["selected_dataset_id"] = dataset_id
        except Client.DoesNotExist:
            messages.warning(
                request, "Selected client not found. Please select a client first."
            )
            return redirect("connections:select_dataset")

        return super().get(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["data_sources"] = DataSource.objects.filter(
            name__in=["GOOGLE_ADS", "FACEBOOK_ADS", "GOOGLE_SHEET"]
        )
        client_id = self.request.GET.get("client_id")
        dataset_id = self.request.GET.get("dataset_id")

        try:
            client = Client.objects.get(id=client_id)
            context["client"] = client
            context["dataset_id"] = dataset_id
            context["client_id"] = str(client.id)
        except Client.DoesNotExist:
            pass
        return context


class ConnectionCloneView(LoginRequiredMixin, View):
    """
    這個 View 不渲染模板，它的唯一工作是：
    1. 獲取要複製的連線物件。
    2. 將其設定儲存到 session 中。
    3. 將使用者重導向到標準的 ConnectionCreateView。
    """
    def get(self, request, *args, **kwargs):
        pk = self.kwargs.get('pk')
        try:
            # 獲取要被複製的原始連線
            source_connection = Connection.objects.get(pk=pk, user=self.request.user)
        except Connection.DoesNotExist:
            messages.error(self.request, "Connection not found.")
            return redirect("connections:connection_list")

        # 準備要傳遞給建立表單的初始資料
        initial_data = {
            # 在名稱後加上 (Copy) 以示區別
            'display_name': f"{source_connection.display_name} (Copy)",
            'target_dataset_id': source_connection.target_dataset_id,
        }
        # 將原始連線的 config 也加入
        if source_connection.config:
            initial_data.update(source_connection.config)

        # 將完整的初始資料存入 session
        request.session['cloned_connection_initial_data'] = initial_data

        # 重導向到對應資料來源的建立頁面
        return redirect('connections:connection_create', 
                        client_id=source_connection.client.id, 
                        source_name=source_connection.data_source.name)

class ConnectionCreateView(LoginRequiredMixin, CreateView):
    model = Connection
    template_name = "connections/connection_form.html"

    def get_initial(self):
        if 'cloned_connection_initial_data' in self.request.session:
            # 如果有，就將其作為表單的初始資料，並從 session 中移除
            initial = self.request.session.pop('cloned_connection_initial_data')
            
            # 因為 target_dataset_id 可能在 session 中，我們要確保它被正確設定
            dataset_id = self.request.session.get('selected_dataset_id')
            if dataset_id:
                initial['target_dataset_id'] = dataset_id

            return initial
        
        initial = super().get_initial()
        dataset_id = self.request.session.get('selected_dataset_id')

        if dataset_id:
            initial['target_dataset_id'] = dataset_id
            
        return initial

    # 1. 表單工廠：根據 URL 決定使用哪個 Form Class
    def get_form_class(self):
        source_name = self.kwargs.get("source_name")
        if source_name == 'GOOGLE_ADS':
            return GoogleAdsForm
        elif source_name == 'FACEBOOK_ADS':
            return FacebookAdsForm
        elif source_name == 'GOOGLE_SHEET': 
            return GoogleSheetForm
        else:
            return BaseConnectionForm

    # 2. 準備動態資料並傳遞給 Form 的 __init__ 方法
    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['user'] = self.request.user
        kwargs['request'] = self.request
        
        source_name = self.kwargs.get("source_name")
        data_source = get_object_or_404(DataSource, name=source_name)
        kwargs['data_source_instance'] = data_source

        client_id = self.kwargs.get("client_id")
        client = get_object_or_404(Client, id=client_id)
        kwargs['client'] = client

        # 如果是 Facebook，我們需要準備 ad_accounts 的選項並傳給 form
        if source_name == 'FACEBOOK_ADS':
            print("start to get form")
            ad_accounts = []
            
            # 從 SocialAccount 中安全地獲取 token
            if client.facebook_social_account:
                try:
                    # 這裡的邏輯是為了獲取 token
                    token_obj = SocialToken.objects.get(account=client.facebook_social_account, app__provider='facebook')
                    fb_client = FacebookAdsAPIClient(
                        app_id=settings.FACEBOOK_APP_ID,
                        app_secret=settings.FACEBOOK_APP_SECRET,
                        access_token=token_obj.token
                    )
                    ad_accounts = fb_client.get_ad_accounts()
                except SocialToken.DoesNotExist:
                    messages.error(self.request, "Facebook token not found. Please re-authorize the client.")
                except Exception as e:
                    logger.error(f"Failed to get FB Ad Accounts for form: {e}")
                    messages.error(self.request, "Failed to retrieve Facebook Ad Accounts.")

            # 將 ad_accounts 轉換為 (value, label) 格式並傳遞
            kwargs['facebook_ad_accounts_choices'] = [(acc['id'], f"{acc['name']} ({acc['id']})") for acc in ad_accounts]

            # 未來如果 GoogleAdsForm 需要動態選項，也可以在這裡加入
            # elif source_name == 'GOOGLE_ADS':
            #    kwargs['some_google_choices'] = get_google_choices()
            
        return kwargs

    # 3. 準備給 Template 使用的上下文資料
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        client_id = self.kwargs.get("client_id")
        client = get_object_or_404(Client, id=client_id)
        source_name = self.kwargs.get("source_name")
        context["client_id"] = str(client_id)
        context['data_source'] = get_object_or_404(DataSource, name=source_name)
        context['client'] = client
        context["dataset_id"] = self.request.GET.get("dataset_id") or self.request.session.get("selected_dataset_id")
        
        if self.request.user.is_superuser:
            # 超級使用者可以直接獲取客戶，無需檢查權限
            client = get_object_or_404(Client, id=client_id)
        else:
            # 一般使用者必須對該客戶有權限
            try:
                # 嘗試從使用者有權限的客戶中獲取目標客戶
                client = Client.objects.filter(settings__user=self.request.user).get(id=client_id)
            except Client.DoesNotExist:
                # 如果找不到，表示使用者無權為此客戶建立連線，拋出 404 錯誤
                from django.http import Http404
                raise Http404("You do not have permission to create a connection for this client.")
            
        try:
            if source_name == "FACEBOOK_ADS":
                # ... (您現有的 Facebook 邏輯保持不變) ...
                user_fb_token = None
                if client.facebook_social_account:
                    # ...
                    pass
                facebook_page_context = get_facebook_ads_page_context(user_access_token=user_fb_token)
                context.update(facebook_page_context)

            elif source_name == "GOOGLE_ADS":
                # 呼叫我們重構後的函式
                google_page_context = get_google_ads_page_context(client)
                context.update(google_page_context)

        except Client.DoesNotExist:
            messages.error(self.request, "Selected client not found.")
            return redirect("connections:select_dataset")
        
        return context

    def form_invalid(self, form):
        
        print("================== FORM IS INVALID ==================")
        print(form.errors.as_json()) 
        print("===================================================")
        return super().form_invalid(form)

    # 4. 處理表單提交的核心邏輯
    def form_valid(self, form):
        """
        這個方法只會在表單通過所有基礎驗證後 (form.is_valid() == True) 才被呼叫。
        """
        logger.info(f"form_valid() called for source: {self.kwargs.get('source_name')}")
        source_name = self.kwargs.get("source_name")
        client = get_object_or_404(Client, id=self.kwargs.get("client_id"))
        
        self.object = form.save(commit=False)
        self.object.client = client
        self.object.status = "PENDING"
        self.object.user = self.request.user

        try: 
            if source_name == "GOOGLE_SHEET":
                try:
                    sheet_id = form.cleaned_data.get('sheet_id')
                    logger.info(f"Performing Google Sheet pre-flight checks for sheet ID: {sheet_id}")
                    
                    # 初始化 API Client
                    api_client = GoogleSheetAPIClient()
                    
                    # 步驟 9: 驗證權限
                    if not api_client.check_sheet_permissions(sheet_id):
                        logger.warning(f"Permission validation failed for sheet ID: {sheet_id}")
                        # 將錯誤新增到表單並返回
                        form.add_error('sheet_id', "Permission Denied. Please ensure our service account has 'Editor' access to this Google Sheet.")
                        return self.form_invalid(form)
                    
                    logger.info("Google Sheet permission check PASSED.")

                except Exception as e:
                    logger.error(f"An unexpected error occurred during Google Sheet validation: {e}", exc_info=True)
                    form.add_error(None, f"An unexpected error occurred: {e}")
                    return self.form_invalid(form)
    
            elif source_name == "FACEBOOK_ADS":
                if not client.facebook_social_account:
                    form.add_error(None, "This client does not have a linked Facebook account. Please authorize it first.")
                    return self.form_invalid(form)

                try:
                    logger.info("Performing Facebook API connection test...")
                    token_obj = SocialToken.objects.get(account=client.facebook_social_account, app__provider='facebook')
                    fb_client = FacebookAdsAPIClient(
                        app_id=settings.FACEBOOK_APP_ID,
                        app_secret=settings.FACEBOOK_APP_SECRET,
                        access_token=token_obj.token,
                        ad_account_id=form.cleaned_data.get('facebook_ad_account_id')
                    )
                    # 執行一個輕量的 API 請求作為測試，例如獲取廣告帳戶的名稱
                    fb_client.get_insights(fields=['campaign_name'], date_preset='yesterday')
                    logger.info("Facebook API connection test PASSED.")
                except Exception as e:
                    logger.error(f"Facebook API connection test FAILED: {e}", exc_info=True)
                    # 將詳細的技術錯誤記錄下來，但只給使用者一個友善的提示
                    form.add_error(None, f"Connection test to Facebook failed. Please check your account permissions or try re-authorizing. Error: {e}")
                    return self.form_invalid(form)

            elif source_name == "GOOGLE_ADS":
                if not client.is_oauth_authorized():
                    form.add_error(None, "Google account is not authorized for this client.")
                    return self.form_invalid(form)
                try:
                    logger.info("Performing Google Ads API connection test...")
                    social_token = SocialToken.objects.get(account=client.google_social_account)
                    
                    # 確保 token 是最新的，以防測試因 token 過期而失敗
                    _refresh_user_social_token(social_token)
                    
                    # 建立一個臨時的 Google Ads Client 來進行測試
                    google_ads_config = {
                        "developer_token": settings.GOOGLE_ADS_DEVELOPER_TOKEN,
                        "client_id": social_token.app.client_id,
                        "client_secret": social_token.app.secret,
                        "refresh_token": social_token.token_secret,
                        # 使用表單中使用者剛填寫的 customer_id
                        "login_customer_id": form.cleaned_data.get("customer_id"), 
                        "use_proto_plus": True
                    }
                    google_ads_client = GoogleAdsClient.load_from_dict(google_ads_config)
                    customer_service = google_ads_client.get_service("CustomerService")
                    
                    # 執行一個輕量的 API 請求，例如列出可存取的客戶，來驗證憑證是否有效
                    accessible_customers = customer_service.list_accessible_customers()
                    logger.info("Google Ads API connection test PASSED.")

                except Exception as e:
                    logger.error(f"Google Ads API connection test FAILED: {e}", exc_info=True)
                    form.add_error(None, f"Connection test to Google Ads failed. Please check credentials and permissions. Error: {e}")
                    return self.form_invalid(form)
        except Exception as e:
            # 任何 API 驗證的失敗都會在這裡被捕捉
            logger.error(f"API connection test FAILED for {source_name}: {e}", exc_info=True)
            form.add_error(None, f"Connection test failed: {e}")
            # 因為尚未儲存，所以這裡返回時資料庫是乾淨的
            return self.form_invalid(form)

        try:
            self.object.save()
            # form.save_m2m() # 如果您的表單有關聯多對多欄位，也需要呼叫此方法
            logger.info(f"Connection object {self.object.pk} with all checks passed is now saved to the database.")
        except Exception as e:
            # 這是一個防禦性措施，以防在最後儲存階段發生資料庫層級的錯誤
            logger.error(f"An unexpected error occurred during the final database save(): {e}", exc_info=True)
            form.add_error(None, f"An unexpected error occurred while saving the connection: {e}")
            return self.form_invalid(form)
            
        # --- 步驟 4: 派發非同步任務並重導向 ---
        messages.success(self.request, f"Connection '{self.object.display_name}' was created successfully. First data sync is in progress.")
        
        sync_connection_data_task.delay(
            self.object.pk,
            triggered_by_user_id=self.request.user.id  
        ) 
        
        self.request.session.pop("selected_client_id", None)
        self.request.session.pop("selected_dataset_id", None)

        # 重導向到成功頁面
        return redirect(self.get_success_url())

    def get_success_url(self):
        return reverse("connections:connection_detail", kwargs={"pk": self.object.pk})


class ConnectionDetailView(LoginRequiredMixin, DetailView):
    model = Connection
    template_name = "connections/connection_detail.html"
    context_object_name = "connection"

    def get_queryset(self):
        # 如果是超級使用者，可以看任何連線
        if self.request.user.is_superuser:
            return Connection.objects.select_related('user', 'data_source', 'client').all()

        # 找出使用者有權限的所有客戶
        accessible_clients = Client.objects.filter(settings__user=self.request.user)
        # 篩選出與這些客戶相關的連線
        return Connection.objects.select_related('user', 'data_source', 'client').filter(client__in=accessible_clients)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        connection = self.get_object()

        # === 需求 2: OAuth 狀態判斷 ===
        # 判斷邏輯：
        # 1. 該 Connection 必須關聯到一個 SocialAccount
        # 2. 該 SocialAccount 必須有一個對應的 SocialToken
        # 3. 該 Token 不能過期
        is_authenticated = False
        auth_message = "Not Authenticated"
        if connection.social_account:
            try:
                social_token = SocialToken.objects.get(
                    account=connection.social_account,
                    app__provider=connection.data_source.name.lower().split('_')[0] # 'google' or 'facebook'
                )
                if social_token.expires_at:
                    if social_token.expires_at > timezone.now():
                        is_authenticated = True
                        auth_message = f"Authenticated as {connection.social_account.extra_data.get('email', connection.social_account.uid)}. Expires at {social_token.expires_at.strftime('%Y-%m-%d %H:%M:%S')}."
                    else:
                        auth_message = "Token has expired. Please re-authorize."
                else: # e.g. Facebook long-lived tokens might not have an expiry from allauth
                    is_authenticated = True
                    auth_message = f"Authenticated as {connection.social_account.extra_data.get('name', connection.social_account.uid)}."

            except SocialToken.DoesNotExist:
                auth_message = "Authentication token not found. Please re-authorize."
            except Exception as e:
                auth_message = f"Error checking token: {e}"
        else:
             auth_message = "No social account linked to this connection."
        
        context['oauth_is_authenticated'] = is_authenticated
        context['oauth_auth_message'] = auth_message

        # === 需求 3: Last Execution Status ===
        last_execution = ConnectionExecution.objects.filter(connection=connection).order_by('-started_at').first()
        context['last_execution'] = last_execution

        # === 需求 5: 準備排程設定給前端表單 ===
        # 這些值將用於填充詳情頁上的更新表單
        config = connection.config or {}
        context['sync_settings'] = {
            'sync_frequency': config.get('sync_frequency', 'daily'),
            'sync_hour': config.get('sync_hour', '00'),
            'sync_minute': config.get('sync_minute', '00'),
            'weekly_day_of_week': config.get('weekly_day_of_week', '1'),
            'monthly_day_of_month': config.get('monthly_day_of_month', '1'),
        }

        context['sync_hour_choices'] = [str(hour).zfill(2) for hour in range(24)]
        context['sync_minute_choices'] = [str(minute).zfill(2) for minute in range(0, 60, 15)]
        
        return context
    
    

class ConnectionUpdateView(LoginRequiredMixin, UpdateView):
    model = Connection
    # 這個 View 現在只處理 POST 請求，不需要渲染模板或表單
    # 因此我們移除 template_name 和 form_class 相關的所有方法

    def get_queryset(self):
        # 如果是超級使用者，可以更新任何連線
        if self.request.user.is_superuser:
            return Connection.objects.all()
        # 一般使用者只能更新自己建立的連線
        return Connection.objects.filter(user=self.request.user)

    def post(self, request, *args, **kwargs):
        """
        覆寫 post 方法，專門處理從 connection_detail.html 頁面提交的排程更新。
        """
        connection = self.get_object()

        is_enabled = request.POST.get('is_enabled') == 'on'

        # 從 POST 請求中獲取表單數據
        sync_frequency = request.POST.get('sync_frequency')
        weekly_day_of_week = request.POST.get('weekly_day_of_week')
        monthly_day_of_month = request.POST.get('monthly_day_of_month')
        sync_hour = request.POST.get('sync_hour')
        sync_minute = request.POST.get('sync_minute')

        # 更新 connection 物件的 config 字典
        config = connection.config or {}
        config.update({
            'sync_frequency': sync_frequency,
            'weekly_day_of_week': weekly_day_of_week,
            'monthly_day_of_month': monthly_day_of_month,
            'sync_hour': sync_hour,
            'sync_minute': sync_minute,
        })
        connection.config = config

        connection.is_enabled = is_enabled
        # 只更新指定的欄位，更有效率
        connection.save(update_fields=['config', 'is_enabled', 'updated_at'])

        messages.success(request, "Sync schedule updated successfully.")

        # 觸發一次性的同步任務
        if connection.is_enabled:
            try:
                sync_connection_data_task.delay(
                    connection.pk,
                    triggered_by_user_id=request.user.id
                )
                messages.info(request, "A new data sync task has been triggered to run in the background.")
            except Exception as e:
                logger.error(f"Failed to trigger sync task for connection {connection.pk}: {e}")
                messages.error(request, "Failed to trigger the sync task. Please check system logs.")
        else:
            messages.warning(request, "Connection is disabled. No sync task was triggered.")
            
        # 處理完成後，重定向回詳情頁面
        return redirect('connections:connection_list')
    
    def get_success_url(self):
        # 雖然 post 方法直接處理了重導向，但保留此方法是個好習慣
        return reverse("connections:connection_list", kwargs={"pk": self.object.pk})

class ConnectionDeleteView(LoginRequiredMixin, DeleteView):
    model = Connection
    template_name = "connections/connection_confirm_delete.html"
    success_url = reverse_lazy("connections:connection_list")

    def get_queryset(self):
        # 如果是超級使用者，可以刪除任何連線
        if self.request.user.is_superuser:
            return Connection.objects.all()
        # 一般使用者只能刪除自己建立的連線
        return Connection.objects.filter(user=self.request.user)

    def delete(self, request, *args, **kwargs):
        # ... (existing DTS deletion logic for Google)
        connection_instance = self.get_object()
        dts_config_name = getattr(connection_instance, 'dts_transfer_config_name', None) # Make it safer

        response = super().delete(request, *args, **kwargs) 

        if dts_config_name: # This is Google DTS specific
            try:
                credentials_adc, project_adc = default(
                    scopes=["https://www.googleapis.com/auth/bigquery"]
                )
                dts_service = build(
                    "bigquerydatatransfer", "v1", credentials=credentials_adc
                )
                dts_service.projects().locations().transferConfigs().delete(
                    name=dts_config_name
                ).execute()
                logger.info(f"Successfully deleted DTS config: {dts_config_name}")
                messages.success(
                    request,
                    f'Connection and associated data transfer ({dts_config_name.split("/")[-1]}) deleted successfully.',
                )
            except Exception as e:
                logger.error(f"Error deleting DTS config {dts_config_name}: {str(e)}")
                messages.warning(
                    request,
                    f'Connection deleted, but failed to delete associated data transfer ({dts_config_name.split("/")[-1]}). Please check Google Cloud Console. Error: {str(e)}',
                )
        else:
            # If not a Google DTS connection, or no DTS config name was stored
            messages.success(request, "Connection deleted successfully.")
        return response




@login_required
def connection_oauth_authorize_view(request, pk):
    return api_oauth_authorize(request, pk) # From google_oauth.py

@login_required
def reauthorize_connection(request, pk):
    connection = get_object_or_404(Connection, pk=pk, user=request.user)
    request.session["oauth_connection_pk_to_link"] = pk # Used to link social account after re-auth
    
    provider_name = None
    if connection.data_source.name == "GOOGLE_ADS": # Or other Google services
        provider_name = "google"
    elif connection.data_source.name == "FACEBOOK_ADS":
        provider_name = "facebook"
        # For Facebook, re-auth might mean re-doing the client-level auth
        # as the token is tied to the client's SocialAccount
        messages.info(request, "To re-authorize Facebook, please go to the client's authorization page or re-initiate the OAuth flow for the client.")
        # Redirect to a page where they can trigger client_oauth_authorize for Facebook
        # Or, if you want to directly trigger it:
        # return redirect(reverse('connections:client_oauth_authorize', args=[connection.client.id]) + '?data_source=FACEBOOK_ADS')
        # For now, let's assume client re-auth is handled elsewhere or they re-auth the client.
        # This reauthorize_connection is more aligned with allauth's "connect" process.
        # For Facebook, it might be better to guide them to re-auth the Client.
        # However, if the goal is to re-link the connection's `social_account` field (if it's used for FB directly)
        # then a similar flow to Google might be attempted.
        # Given current setup, FB token is via Client.
        # Let's make this re-authorize specific to the data source type.
        messages.warning(request, "Re-authorization for Facebook connections typically involves re-authorizing the client's Facebook link. If issues persist, try re-authorizing the client.")
        return redirect("connections:connection_detail", pk=pk)


    if provider_name:
        messages.info(
            request, f"Please re-authorize your {provider_name.title()} account for this connection."
        )
        # The 'next' URL should ideally bring them back to the connection detail or form
        # Ensure the redirect URL after allauth is handled correctly
        # It might go to `oauth_callback` or a custom allauth callback if defined
        
        # Store where to redirect *after* allauth completes and our oauth_callback is hit
        request.session['oauth_redirect_url'] = reverse('connections:connection_detail', args=[pk])

        return redirect(
            f"{reverse('account_login')}?process=connect&provider={provider_name}" 
            # `next` param for allauth's internal redirect after its own process,
            # not to be confused with our `oauth_redirect_url` for after our callback.
            # Allauth's `next` usually points to where it should go if login/connect is successful
            # before our own specific logic in `oauth_callback` or `facebook_oauth_callback` runs.
            # Often, allauth's own views handle the SocialAccount creation/update, then redirect.
        )
    else:
        messages.error(request, "Re-authorization not configured for this data source type.")
        return redirect("connections:connection_detail", pk=pk)

@login_required
def check_auth_status(request):
    """檢查使用者的 Google 授權狀態"""
    try:
        client_id = request.GET.get('client_id')
        if not client_id:
            return JsonResponse({"is_authorized": False, "email": "", "error": "No client_id provided"})

        client = get_object_or_404(Client, id=client_id)
        
        # 檢查 client 是否有 google_social_account
        if not client.google_social_account:
            return JsonResponse({"is_authorized": False, "email": ""})

        social_account = client.google_social_account
        social_token = SocialToken.objects.filter(
            account=social_account, app__provider="google"
        ).first()

        is_authorized = bool(
            social_token
            and (
                not social_token.expires_at or social_token.expires_at > timezone.now()
            )
        )

        return JsonResponse(
            {
                "is_authorized": is_authorized,
                "email": (
                    social_account.extra_data.get("email", "") if is_authorized else ""
                ),
            }
        )
    except Exception as e:
        logger.error(f"Error checking auth status: {str(e)}")
        return JsonResponse({"is_authorized": False, "email": "", "error": str(e)})

@login_required
def client_oauth_authorize(request, client_id): # client_id is UUID here
   
    data_source_name = request.GET.get('data_source')
    client = get_object_or_404(Client, id=client_id)

    request.session['oauth_client_id_to_link'] = str(client.id)
    redirect_path = request.GET.get('redirect_uri')
    if redirect_path:
        # 如果前端有提供，就使用它
        request.session['final_redirect_after_oauth_link'] = redirect_path
    else:
        # 如果沒有提供，則使用一個安全的預設值 (例如前端的首頁)
        request.session['final_redirect_after_oauth_link'] = "/"

    if data_source_name == "GOOGLE_ADS":
        # 直接使用 allauth 的 Google 登入 URL
        google_login_url = reverse('google_login')
        
        # 構建參數
        params = {
            'process': 'connect',  # 用於連接現有帳戶
            'next': reverse('connections:oauth_callback')  # OAuth 完成後的回調
        }
        
        # 構建最終 URL
        final_url = f"{google_login_url}?{urllib.parse.urlencode(params)}"
        return redirect(final_url)

    elif data_source_name == "FACEBOOK_ADS":
        auth_url, _ = get_facebook_oauth_url(request, str(client_id))
        return redirect(auth_url)
        
    else:
        messages.error(request, "Invalid data source for OAuth.")
        return redirect("connections:connection_list")

@login_required
def oauth_callback(request): # Primarily for Google via AllAuth
    """Handle OAuth callback and link social account to client"""
    logger.info(f"OAuth callback called with GET params: {request.GET}")
    logger.info(f"Session data: oauth_client_id_to_link={request.session.get('oauth_client_id_to_link')}")
    
    client_id = request.session.pop('oauth_client_id_to_link', None)
    redirect_path = request.session.pop('final_redirect_after_oauth_link', '/')

    if not client_id:
        logger.error("No client_id found in session")
        messages.error(request, "OAuth session expired or invalid. Please try again.")
        return redirect("connections:connection_list")

    try:
        # 獲取最新的 Google social account
        social_accounts = SocialAccount.objects.filter(
            user=request.user, 
            provider="google"
        ).order_by('-date_joined')
        
        logger.info(f"Found {social_accounts.count()} Google social accounts")
        
        if not social_accounts.exists():
            logger.error("No Google social account found for user")
            messages.error(request, "Please complete the Google authorization process first.")
            return redirect("connections:connection_list")
            
        social_account = social_accounts.first()
        logger.info(f"Using Google social account: {social_account.extra_data.get('email', 'No email found')}")
            
        client = Client.objects.get(id=client_id)
        logger.info(f"Found client: {client.name}")
        
        # 檢查是否已經有 Google social account
        if client.google_social_account:
            logger.info(f"Client already has Google account: {client.google_social_account.extra_data.get('email')}")
            messages.info(request, f"Client already has Google account: {client.google_social_account.extra_data.get('email')}")
        else:
            client.google_social_account = social_account
            client.save(update_fields=['google_social_account'])
            logger.info(f"Successfully linked Google account to client {client.name}")
            messages.success(
                request, 
                f"Google account '{social_account.extra_data.get('email')}' successfully linked to client '{client.name}'."
            )

    except Client.DoesNotExist:
        logger.error(f"Client with ID {client_id} not found during OAuth callback")
        messages.error(request, "Client not found. Please try again.")
    except Exception as e:
        logger.error(f"Unexpected error during OAuth callback: {e}")
        messages.error(request, "An error occurred while linking the account. Please try again.")

    # Redirect in the Frontend
    final_redirect_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}{redirect_path}"
    
    logger.info(f"OAuth success. Redirecting to dynamic frontend URL: {final_redirect_url}")
    return redirect(final_redirect_url)

class GoogleOAuth2CustomCallbackView(OAuth2CallbackView, View):
    adapter_class = GoogleOAuth2Adapter

    def dispatch(self, request, *args, **kwargs):
        # If AllAuth's standard callback view is working, this custom one might not be hit
        # or might interfere. Ensure it's correctly configured in urls.py if used.
        response = super().dispatch(request, *args, **kwargs)
        if hasattr(response, "url"): # Check if it's a redirect response
            # This logic seems to force render a template instead of redirecting.
            # This can be useful to close a popup window and signal parent.
            # Ensure 'account/socialaccount_callback.html' exists and handles this.
            return render(request, "account/socialaccount_callback.html") 
        return response

@login_required
def save_oauth_redirect(request): # Used by _base.html JS
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            redirect_url = data.get('redirect_url')
            if redirect_url:
                # This session key 'oauth_redirect_url' is generic.
                # Be careful if Google and Facebook flows use it differently.
                # Facebook callback seems to construct its own redirect.
                # Google callback uses 'final_redirect_after_oauth_link'.
                request.session['oauth_redirect_url_generic_save'] = redirect_url # Use a more specific name
                
                client_id = data.get('client_id') # Passed from JS
                dataset_id = data.get('dataset_id') # Passed from JS
                if client_id:
                    request.session['selected_client_id_from_js_save'] = client_id
                if dataset_id:
                    request.session['selected_dataset_id_from_js_save'] = dataset_id
                return JsonResponse({'status': 'success'})
        except json.JSONDecodeError:
            pass # Fall through to error
    return JsonResponse({'status': 'error', 'message': 'Invalid request'}, status=400)

@login_required
@require_http_methods(["GET"])
def facebook_oauth_callback(request):
    code = request.GET.get('code')
    state_param = request.GET.get('state') # This should be the client_id we passed

    redirect_path = request.session.pop('final_redirect_after_oauth_link', '/')
    
    # Retrieve client_id from state or session (state is more reliable for CSRF protection)
    client_id_from_state = state_param
    client_id_from_session = request.session.pop("facebook_client_id_to_link", None)

    if not client_id_from_state and not client_id_from_session: # Prefer state
        messages.error(request, "No client ID found in state or session for Facebook OAuth.")
        return redirect("connections:connection_list")
    
    client_id = client_id_from_state or client_id_from_session

    if not code:
        error_reason = request.GET.get('error_reason')
        error_description = request.GET.get('error_description')
        logger.error(f"Facebook OAuth error: No code. Reason: {error_reason}, Desc: {error_description}")
        messages.error(request, f"Facebook authorization failed. Reason: {error_description or error_reason or 'Unknown error'}")
        return redirect("connections:connection_list")
    
    try:
        # Exchange code for an access token
        redirect_uri = request.build_absolute_uri(reverse('connections:facebook_oauth_callback'))
        redirect_uri = redirect_uri.replace('http://', 'https://') # Ensure HTTPS
        
        token_url = (
            f"https://graph.facebook.com/v18.0/oauth/access_token"
            f"?client_id={settings.FACEBOOK_APP_ID}"
            f"&redirect_uri={redirect_uri}"
            f"&client_secret={settings.FACEBOOK_APP_SECRET}"
            f"&code={code}"
        )
        
        api_response = requests.get(token_url)
        api_response.raise_for_status()
        token_data = api_response.json()
        
        access_token = token_data.get('access_token')
        if not access_token:
            logger.error(f"Facebook OAuth: No access_token in response data: {token_data}")
            raise Exception("Access token not found in Facebook's response.")
        
        # Get user info from Facebook using the new access token
        graph = facebook.GraphAPI(access_token=access_token)
        user_info = graph.get_object('me', fields='id,name,email')
        
        try:
            current_facebook_app = SocialApp.objects.get(
                provider='facebook',
                client_id=settings.FACEBOOK_APP_ID
            )
        except SocialApp.DoesNotExist:
            logger.error(f"CRITICAL: Facebook SocialApp with provider 'facebook' and client_id '{settings.FACEBOOK_APP_ID}' not found in Django Admin.")
            messages.error(request, "Facebook application is not configured correctly in the system.")
            return redirect("connections:connection_list")
        except SocialApp.MultipleObjectsReturned:
            logger.error(f"CRITICAL: Multiple Facebook SocialApp configurations found.")
            messages.error(request, "Ambiguous Facebook application configuration.")
            return redirect("connections:connection_list")

        # Create or update SocialAccount
        social_account, created = SocialAccount.objects.update_or_create(
            user=request.user,
            provider=current_facebook_app.provider,
            uid=user_info['id'],
            defaults={'extra_data': user_info}
        )

        # Create or update SocialToken
        SocialToken.objects.update_or_create(
            account=social_account,
            app=current_facebook_app,
            defaults={'token': access_token}
        )

        client = Client.objects.get(id=client_id)
        client.facebook_social_account = social_account
        client.save(update_fields=['facebook_social_account'])

        messages.success(request, f"Facebook account '{user_info.get('name', user_info['id'])}' successfully authorized and linked to client {client.name}.")
        
        final_redirect_url = f"{settings.FRONTEND_BASE_URL.rstrip('/')}{redirect_path}"
        
        logger.info(f"Facebook OAuth success. Redirecting to dynamic frontend URL: {final_redirect_url}")
        return redirect(final_redirect_url)

    except requests.exceptions.HTTPError as e:
        logger.error(f"Facebook OAuth HTTPError during token exchange: {e.response.text}", exc_info=True)
        messages.error(request, f"Failed to get access token from Facebook: {e.response.json().get('error',{}).get('message','Server error')}")
    except Client.DoesNotExist:
        messages.error(request, "Client not found for Facebook OAuth linking.")
    except SocialAccount.DoesNotExist:
        messages.error(request, "Failed to create or link Facebook social account.")
    except Exception as e:
        logger.error(f"Facebook OAuth callback unexpected error: {str(e)}", exc_info=True)
        messages.error(request, f"An unexpected error occurred during Facebook authorization: {str(e)}")
    
    return redirect("connections:connection_list")

@require_http_methods(["GET"])
def get_compatible_google_ads_fields_api(request):
    """
    一個 API 端點，根據提供的 resource_name，回傳可用的欄位。
    """
    resource_name = request.GET.get('resource')
    if not resource_name:
        return JsonResponse({'error': 'Resource parameter is required.'}, status=400)

    try:
        # 1. 找到 Resource 物件
        resource_field = GoogleAdsField.objects.get(field_name=resource_name, category='RESOURCE')

        # 2. 透過我們建立的 `compatible_fields` 關聯，獲取所有可用的欄位
        compatible_fields = resource_field.compatible_fields.all()
        own_attributes = GoogleAdsField.objects.filter(
            Q(category='ATTRIBUTE') & Q(field_name__startswith=f"{resource_name}.")
        )
        all_fields = sorted(
            list(set(chain(compatible_fields, own_attributes))),
            key=lambda x: (x.category, x.field_name)
        )
        
        # 3. 將結果分類打包成 JSON
        response_data = {
            'metrics': [],
            'segments': [],
            'attributes': [] # 有些 Resource 也會關聯到其他 ATTRIBUTE
        }
        
        for field in all_fields:
            full_name = field.field_name

            parts = full_name.split('.')
            display_name = ('.'.join(parts[1:]) if len(parts) > 1 else full_name).replace('_', ' ')

            field_data = {
                'name': full_name,         
                'display': display_name    
            }
            
            if field.category == 'METRIC':
                response_data['metrics'].append(field_data)
            elif field.category == 'SEGMENT':
                response_data['segments'].append(field_data)
            elif field.category == 'ATTRIBUTE':
                 response_data['attributes'].append(field_data)

        return JsonResponse(response_data)

    except GoogleAdsField.DoesNotExist:
        return JsonResponse({'error': f'Resource "{resource_name}" not found.'}, status=404)
    except Exception as e:
        logger.error(f"API Error in get_compatible_google_ads_fields_api: {e}", exc_info=True)
        return JsonResponse({'error': 'An internal server error occurred.'}, status=500)

