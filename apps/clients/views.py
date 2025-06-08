from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import ListView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from django.contrib import messages
from .models import Client
from .forms import ClientForm

class ClientListView(LoginRequiredMixin, ListView):
    model = Client
    template_name = 'clients/client_list.html'
    context_object_name = 'clients'
    ordering = ['-created_at']

class ClientCreateView(LoginRequiredMixin, CreateView):
    model = Client
    form_class = ClientForm
    template_name = 'clients/client_form.html'
    success_url = reverse_lazy('clients:client-list')

    def form_valid(self, form):
        try:
            import re
            
            client = form.save(commit=False)
            client.created_by = self.request.user  # 設置創建者
            client.updated_by = self.request.user  # 設置更新者
            client.save(request=self.request)  # 傳入 request 以進行重複檢查
            
            # 清理名稱
            clean_name = re.sub(r'[^a-zA-Z0-9_]', '_', client.name.lower())
            clean_name = re.sub(r'_+', '_', clean_name).strip('_')
            
            # 清理 UUID - 移除 - 符號
            clean_id = str(client.id).replace('-', '_')
            
            dataset_id = f"{clean_name}_{clean_id}"
            
            client.bigquery_dataset_id = dataset_id
            client.save()
            
            # 傳遞用戶 ID 給 task
            client.save_client_setting(
            user=self.request.user,
            is_owner=True,
            can_edit=True,
            can_view_gcp=True,
            can_manage_gcp=True
            )
        
            # 傳遞用戶 ID 給 task
            client.create_bigquery_dataset_async(user_id=self.request.user.id)
            messages.success(self.request, f'Client "{client.name}" was successfully created. BigQuery dataset "{dataset_id}" creation has been initiated.')
            return redirect(self.success_url)
        except ValueError as e:
            # 處理重複客戶名稱的錯誤
            form.add_error('name', str(e))
            return self.form_invalid(form)
    
class ClientUpdateView(LoginRequiredMixin, UpdateView):
    model = Client
    form_class = ClientForm
    template_name = 'clients/client_form.html'
    success_url = reverse_lazy('clients:client-list')

    def form_valid(self, form):
        client = form.save(commit=False)
        client.save(request=self.request)
        messages.success(self.request, f'Client "{client.name}" was successfully updated.')
        return redirect(self.success_url)

class ClientDeleteView(LoginRequiredMixin, DeleteView):
    model = Client
    template_name = 'clients/client_confirm_delete.html'
    success_url = reverse_lazy('clients:client-list')

    def delete(self, request, *args, **kwargs):
        client = self.get_object()
        messages.info(request, f'Client "{client.name}" was successfully deleted. BigQuery dataset deletion has been initiated.')
        return super().delete(request, *args, **kwargs)
