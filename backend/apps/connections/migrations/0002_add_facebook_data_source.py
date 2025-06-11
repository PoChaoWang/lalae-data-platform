from django.db import migrations

def add_facebook_ads_source(apps, schema_editor):
    DataSource = apps.get_model('connections', 'DataSource')
    DataSource.objects.create(
        name='FACEBOOK_ADS',
        display_name='Facebook Ads',
        oauth_required=False,  # Facebook 使用自己的認證方式
        required_scopes=[]
    )

def remove_facebook_ads_source(apps, schema_editor):
    DataSource = apps.get_model('connections', 'DataSource')
    DataSource.objects.filter(name='FACEBOOK_ADS').delete()

class Migration(migrations.Migration):
    dependencies = [
        ('connections', '0001_initial'),  # 確保這裡指向正確的前一個遷移
    ]

    operations = [
        migrations.RunPython(add_facebook_ads_source, remove_facebook_ads_source),
    ]