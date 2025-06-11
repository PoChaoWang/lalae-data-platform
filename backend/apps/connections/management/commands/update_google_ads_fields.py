# apps/connections/management/commands/update_google_ads_fields.py

from django.core.management.base import BaseCommand
from django.conf import settings
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException
from ...models import GoogleAdsField
from django.db import transaction

class Command(BaseCommand):
    help = 'Fetches all fields and their relationships from the Google Ads API and updates the database.'

    def handle(self, *args, **options):
        self.stdout.write("Starting to update Google Ads fields metadata...")

        try:
            # Client initialization remains the same
            config = {
                "developer_token": settings.GOOGLE_ADS_DEVELOPER_TOKEN,
                "json_key_file_path": settings.GOOGLE_APPLICATION_CREDENTIALS,
                "login_customer_id": "2588826907", # Manager account for authentication
                "use_proto_plus": True,
            }
            google_ads_client = GoogleAdsClient.load_from_dict(config)
            self.stdout.write(self.style.SUCCESS("Google Ads Client initialized successfully using Service Account."))

        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Failed to initialize Google Ads Client: {e}"))
            return

        field_service = google_ads_client.get_service("GoogleAdsFieldService")
        
        try:
            # ✨ 最終修正：查詢只包含 SELECT 子句，不包含 FROM 子句 ✨
            query = """
                SELECT
                    name,
                    category,
                    selectable,
                    filterable,
                    sortable,
                    data_type,
                    is_repeated,
                    attribute_resources,
                    metrics,
                    segments
            """
            self.stdout.write(f"Fetching all field metadata from Google Ads API with query: '{query.strip()}'...")
            
            # Execute the query
            response = field_service.search_google_ads_fields(query=query)
            all_api_fields = list(response)
            
            self.stdout.write(self.style.SUCCESS(f"Successfully fetched {len(all_api_fields)} fields from API."))

            with transaction.atomic():
                # Pass 1: Create or update all GoogleAdsField objects
                self.stdout.write("Pass 1: Creating or updating all field objects...")
                field_map = {}
                for field_data in all_api_fields:
                    obj, created = GoogleAdsField.objects.update_or_create(
                        field_name=field_data.name,
                        defaults={
                            'display_name': field_data.name,
                            'category': field_data.category.name,
                            'data_type': field_data.data_type.name,
                            'is_selectable': field_data.selectable,
                        }
                    )
                    field_map[field_data.name] = obj
                self.stdout.write(self.style.SUCCESS("Pass 1 complete."))

                # Pass 2: Build compatibility relationships
                self.stdout.write("Pass 2: Building compatibility relationships...")
                for field_data in all_api_fields:
                    current_field_obj = field_map.get(field_data.name)
                    if not current_field_obj:
                        continue

                    compatible_names = []
                    # The API returns the full object with these attributes even if not explicitly selected
                    compatible_names.extend(field_data.attribute_resources)
                    compatible_names.extend(field_data.metrics)
                    compatible_names.extend(field_data.segments)
                    
                    compatible_ids = [field_map[name].id for name in compatible_names if name in field_map]
                    
                    if compatible_ids:
                        current_field_obj.compatible_fields.set(compatible_ids)
                
                self.stdout.write(self.style.SUCCESS("Pass 2 complete. Field relationships updated."))

        except GoogleAdsException as ex:
            self.stderr.write(self.style.ERROR(f"Google Ads API request failed: {ex}"))
            for error in ex.failure.errors:
                self.stderr.write(self.style.ERROR(f"\tError: {error.message}"))
            self.stderr.write(f"\tRequest ID: {ex.request_id}")
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"An unexpected error occurred: {e}"))

