from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect

def home(request):
    return render(request, 'home.html') 

def about(request):
    return render(request, 'about.html')