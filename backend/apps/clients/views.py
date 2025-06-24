from .models import Client
import json
from rest_framework import viewsets, permissions, status
from .serializers import ClientSerializer
from rest_framework_simplejwt.authentication import JWTAuthentication
from apps.clients.models import Client, ClientSetting
import re
from rest_framework.response import Response
class ClientViewSet(viewsets.ModelViewSet):

    serializer_class = ClientSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [JWTAuthentication]
    queryset = Client.objects.all()
    serializer_class = ClientSerializer

    MAX_CLIENTS_PER_USER = 2

    def get_queryset(self):
        user = self.request.user
        base_queryset = Client.objects.select_related('created_by')

        if self.request.user.is_superuser:
            return Client.objects.all().order_by('-created_at')
        
        return base_queryset.filter(settings__user=user).distinct().order_by('-created_at')

    def perform_create(self, serializer):
        client = serializer.save(created_by=self.request.user)
        user = self.request.user
        current_clients_count = ClientSetting.objects.filter(user=user).count()

        if not user.is_superuser: # 如果不是超級使用者，才檢查配額
            current_clients_count = ClientSetting.objects.filter(user=user).count()
            if current_clients_count >= self.MAX_CLIENTS_PER_USER:
                return Response(
                    {"detail": f"You can only create up to {self.MAX_CLIENTS_PER_USER} clients."},
                    status=status.HTTP_403_FORBIDDEN # 返回 403 Forbidden
                )

        # 如果是超級使用者，或者非超級使用者但未達到配額，則繼續執行創建邏輯
        client = serializer.save(created_by=self.request.user) # 這行應該在配額檢查之後，確保只有通過檢查才創建

        try:
            # 清理名稱
            clean_name = re.sub(r'[^a-zA-Z0-9_]', '_', client.name.lower())
            clean_name = re.sub(r'_+', '_', clean_name).strip('_')

            # 清理 UUID - 移除 - 符號
            clean_id = str(client.id).replace('-', '_')

            dataset_id = f"{clean_name}_{clean_id}"

            # 設定 BigQuery dataset ID 並再次儲存
            client.bigquery_dataset_id = dataset_id
            client.save()

            # 儲存客戶設定
            # 假設 client.save_client_setting 是一個在 Client 模型中定義的方法
            client.save_client_setting(
                user=self.request.user,
                is_owner=True,
                can_edit=True,
                can_view_gcp=True,
                can_manage_gcp=True
            )

            # 呼叫非同步任務來建立 BigQuery dataset
            client.create_bigquery_dataset_async(user_id=self.request.user.id)

        except Exception as e:
            # 如果後續步驟出錯，應該刪除剛剛建立的 client，並返回錯誤
            client.delete() # 刪除已創建但後續操作失敗的 client
            print(f"Error during post-create operations for client {client.id}: {e}")
            return Response(
                {"detail": f"Failed to complete client creation due to an internal error: {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(serializer.data, status=status.HTTP_201_CREATED) 

# @ensure_csrf_cookie
# def get_csrf_token(request):
#     """
#     這個 view 的唯一目的，就是確保 CSRF cookie
#     被設定在 client 的瀏覽器中。
#     """
#     token = get_token(request)
#     return JsonResponse({'csrfToken': token})

# class ClientListView(LoginRequiredMixin, ListView):
#     model = Client
#     template_name = 'clients/client_list.html'
#     context_object_name = 'clients'
#     ordering = ['-created_at']

#     def get_queryset(self):
#         """
#         覆寫這個方法，確保使用者只能看到他們有權限的客戶。
#         (自己擁有的，或別人分享的)
#         """
#         if self.request.user.is_superuser:
#             # 超級使用者可以看到所有客戶
#             return Client.objects.all().order_by('-created_at')
#         # 一般使用者只能看到他們有權限的客戶
#         return Client.objects.filter(settings__user=self.request.user).distinct().order_by('-created_at')

# class ClientCreateView(LoginRequiredMixin, CreateView):
#     model = Client
#     form_class = ClientForm
#     template_name = 'clients/client_form.html'
#     success_url = reverse_lazy('clients:client-list')

#     def form_valid(self, form):
#         try:
#             import re
            
#             client = form.save(commit=False)
#             client.created_by = self.request.user  # 設置創建者
#             client.updated_by = self.request.user  # 設置更新者
#             client.save(request=self.request)  # 傳入 request 以進行重複檢查
            
#             # 清理名稱
#             clean_name = re.sub(r'[^a-zA-Z0-9_]', '_', client.name.lower())
#             clean_name = re.sub(r'_+', '_', clean_name).strip('_')
            
#             # 清理 UUID - 移除 - 符號
#             clean_id = str(client.id).replace('-', '_')
            
#             dataset_id = f"{clean_name}_{clean_id}"
            
#             client.bigquery_dataset_id = dataset_id
#             client.save()
            
#             # 傳遞用戶 ID 給 task
#             client.save_client_setting(
#             user=self.request.user,
#             is_owner=True,
#             can_edit=True,
#             can_view_gcp=True,
#             can_manage_gcp=True
#             )
        
#             # 傳遞用戶 ID 給 task
#             client.create_bigquery_dataset_async(user_id=self.request.user.id)
#             messages.success(self.request, f'Client "{client.name}" was successfully created. BigQuery dataset "{dataset_id}" creation has been initiated.')
#             return redirect(self.success_url)
#         except ValueError as e:
#             # 處理重複客戶名稱的錯誤
#             form.add_error('name', str(e))
#             return self.form_invalid(form)
    
# class ClientDetailView(LoginRequiredMixin, DetailView):
#     model = Client
#     form_class = ClientForm
#     template_name = 'clients/client_form.html'
#     success_url = reverse_lazy('clients:client-list')

#     def form_valid(self, form):
#         client = form.save(commit=False)
#         client.save(request=self.request)
#         messages.success(self.request, f'Client "{client.name}" was successfully updated.')
#         return redirect(self.success_url)
    
#     def get_queryset(self):
#         """
#         覆寫這個方法，確保使用者只能編輯他們擁有編輯權限的客戶。
#         """
#         if self.request.user.is_superuser:
#             # 超級使用者可以編輯所有客戶
#             return Client.objects.all()
        
#         # 一般使用者只能編輯他們有 can_edit=True 權限的客戶
#         return Client.objects.filter(settings__user=self.request.user, settings__can_edit=True)

# class ClientDeleteView(LoginRequiredMixin, DeleteView):
#     model = Client
#     template_name = 'clients/client_confirm_delete.html'
#     success_url = reverse_lazy('clients:client-list')

#     def delete(self, request, *args, **kwargs):
#         client = self.get_object()
#         messages.info(request, f'Client "{client.name}" was successfully deleted. BigQuery dataset deletion has been initiated.')
#         return super().delete(request, *args, **kwargs)
    
#     def get_queryset(self):
#         """
#         覆寫這個方法，確保只有擁有者才能刪除客戶。
#         """
#         if self.request.user.is_superuser:
#             # 超級使用者可以刪除所有客戶
#             return Client.objects.all()
        
#         # 一般使用者只能刪除他們是擁有者 (is_owner=True) 的客戶
#         return Client.objects.filter(settings__user=self.request.user, settings__is_owner=True)



