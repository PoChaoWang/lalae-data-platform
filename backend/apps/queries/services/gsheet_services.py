# services/gsheet_services.py
from google.oauth2 import service_account
from googleapiclient.discovery import build
import os
import json

class GSheetService:
    def __init__(self):
        # try:
        #     cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        #     if not cred_path:
        #         cred_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
        #         if cred_json:
        #             info = json.loads(cred_json)
        #             self.credentials = service_account.Credentials.from_service_account_info(info, scopes=['https://www.googleapis.com/auth/spreadsheets'])
        #         else:
        #             raise ValueError("Google service account credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON.")
        #     else:
        #         self.credentials = service_account.Credentials.from_service_account_file(cred_path, scopes=['https://www.googleapis.com/auth/spreadsheets'])
        #     self.service = build('sheets', 'v4', credentials=self.credentials)
        # except Exception as e:
        #     raise RuntimeError(f"Failed to initialize Google Sheets Service: {str(e)}")
        try:
            self.service = build('sheets', 'v4')
        except Exception as e:    
            raise RuntimeError(f"Failed to initialize Google Sheets Service: {str(e)}")

    def write_to_sheet(self, sheet_id: str, tab_name: str, column_names: list, data: list, append_mode: bool):
        """
        將資料寫入 Google Sheet。
        :param sheet_id: Google Sheet ID
        :param tab_name: 工作表名稱
        :param column_names: 欄位名稱列表 (header)
        :param data: 數據列表，每個元素是行數據的列表
        :param append_mode: 如果為 True，則追加數據；否則覆蓋。
        """
        range_name = f"'{tab_name}'!A1" # 通常從 A1 開始寫入

        # 如果是覆蓋模式，則包含標題行
        values_to_write = []
        if not append_mode:
            values_to_write.append(column_names)
        values_to_write.extend(data)

        body = {
            'values': values_to_write
        }

        try:
            if append_mode:
                # 在追加模式下，數據會從現有數據的下一行開始寫入
                result = self.service.spreadsheets().values().append(
                    spreadsheetId=sheet_id,
                    range=range_name, # append 方法會自動找到最後一行
                    valueInputOption='RAW',
                    insertDataOption='INSERT_ROWS', # 插入新行
                    body=body
                ).execute()
                print(f"Appended {result.get('updates').get('updatedCells')} cells to Google Sheet.")
            else:
                # 覆蓋模式
                result = self.service.spreadsheets().values().update(
                    spreadsheetId=sheet_id,
                    range=range_name,
                    valueInputOption='RAW',
                    body=body
                ).execute()
                print(f"Updated {result.get('updatedCells')} cells in Google Sheet.")
        except Exception as e:
            raise RuntimeError(f"Failed to write to Google Sheet: {str(e)}")