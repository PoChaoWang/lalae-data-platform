from platform_backend.tasks import test_task

if __name__ == '__main__':
    # 執行任務
    result = test_task.delay(4, 4)
    print(f"Task ID: {result.id}")
    print(f"Task Result: {result.get()}")  # 等待任務完成並獲取結果 