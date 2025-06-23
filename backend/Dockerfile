FROM python:3.9-slim-buster

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# 5. 複製整個 Django 專案到容器的工作目錄。
#    注意：你可能需要建立一個 .dockerignore 檔案來排除不必要的檔案（例如 .git, .env, __pycache__）。
COPY . .

# 6. 暴露端口：告訴 Docker 這個容器會監聽哪個端口。
#    Django 通常運行在 8000 端口，Cloud Run 預設會將請求轉發到此端口（或 $PORT 環境變數指定的端口）。
EXPOSE 8000

# 7. 定義啟動指令：當容器啟動時會執行的命令。
#    這裡我們使用 Gunicorn 作為生產環境的 WSGI 伺服器來運行 Django 應用程式。
#    你需要將 YOUR_PROJECT_NAME 替換成你的 Django 專案名 (例如：mysite.wsgi)。
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "YOUR_PROJECT_NAME.wsgi"]