from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from .forms import UserRegisterForm
from django.http import JsonResponse

def register(request):
    if request.method == 'POST':
        form = UserRegisterForm(request.POST)
        if form.is_valid():
            form.save()
            username = form.cleaned_data.get('username')
            messages.success(request, f'Account created for {username}! You can now log in.')
            return redirect('login')
    else:
        form = UserRegisterForm()
    return render(request, 'users/register.html', {'form': form})

@login_required
def profile(request):
    return render(request, 'users/profile.html')


def check_user_status(request):
    """
    一個 API 端點，用來讓 Next.js 檢查使用者的登入狀態。
    """
    if request.user.is_authenticated:
        # 如果使用者已登入，回傳詳細資訊
        return JsonResponse({
            'isAuthenticated': True,
            'username': request.user.username,
            'email': request.user.email,
        })
    else:
        # 如果未登入，回傳 false
        return JsonResponse({'isAuthenticated': False})
