from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.contrib import messages

# Create your views here.

@login_required
def dashboard(request):
    messages.info(request, f'Welcome to dashboard, {request.user.username}!')
    return render(request, 'dashboard/dashboard.html')
