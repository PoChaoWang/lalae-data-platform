# apps/connections/management/commands/update_facebook_ads_fields.py

import json
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.connections.models import FacebookAdsField

class Command(BaseCommand):
    help = 'Uploads Facebook Ads fields from facebook_fields.json to Supabase.'

    def handle(self, *args, **options):
        self.stdout.write("Starting to upload Facebook Ads fields metadata to Supabase...")

        json_file_path = 'apps/connections/apis/static_data/facebook_fields.json'

        try:
            with open(json_file_path, 'r', encoding='utf-8') as f:
                facebook_data = json.load(f)
        except FileNotFoundError:
            self.stderr.write(self.style.ERROR(f"Error: JSON file not found at {json_file_path}"))
            return
        except json.JSONDecodeError:
            self.stderr.write(self.style.ERROR(f"Error: Could not decode JSON from {json_file_path}"))
            return

        total_fields_processed = 0

        with transaction.atomic():
            # 可以選擇在這裡清空現有資料，如果結構大改或想重新整理數據
            FacebookAdsField.objects.all().delete()
            self.stdout.write(self.style.WARNING("Existing Facebook Ads fields cleared from database."))

            for insights_level, data in facebook_data.items(): # insights_level 將會是 "campaign", "ad_set", "ad"
                if "breakdowns" in data:
                    for field in data["breakdowns"]:
                        FacebookAdsField.objects.update_or_create(
                            name=field["name"],
                            insights_level=insights_level, # 將 insights_level 傳入
                            defaults={
                                'label': field["label"],
                                'field_type': "breakdown" # field_type 現在只表示類別
                            }
                        )
                        total_fields_processed += 1

                if "action_breakdowns" in data:
                    for field in data["action_breakdowns"]:
                        FacebookAdsField.objects.update_or_create(
                            name=field["name"],
                            insights_level=insights_level, # 將 insights_level 傳入
                            defaults={
                                'label': field["label"],
                                'field_type': "action_breakdown" # field_type 現在只表示類別
                            }
                        )
                        total_fields_processed += 1

                if "fields" in data:
                    for field in data["fields"]:
                        FacebookAdsField.objects.update_or_create(
                            name=field["name"],
                            insights_level=insights_level, # 將 insights_level 傳入
                            defaults={
                                'label': field["label"],
                                'field_type': "field" # field_type 現在只表示類別
                            }
                        )
                        total_fields_processed += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully uploaded {total_fields_processed} Facebook Ads fields to Supabase."))