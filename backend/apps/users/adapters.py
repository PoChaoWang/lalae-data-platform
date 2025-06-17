# backend/apps/users/adapters.py

from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.models import EmailConfirmationHMAC
from django.db import transaction
import logging

# 取得 logger 物件，這樣日誌會跟著 Django 的設定走
logger = logging.getLogger(__name__)

class CustomAccountAdapter(DefaultAccountAdapter):

    def send_confirmation_mail(self, request, emailconfirmation, signup):
        logger.info("=== CustomAdapter: Creating confirmation mail ===")
        logger.info(f"Key: {emailconfirmation.key}")
        logger.info(f"Email: {emailconfirmation.email_address}")
        logger.info(f"Type: {type(emailconfirmation)}")
        
        if isinstance(emailconfirmation, EmailConfirmationHMAC):
            logger.info("Using HMAC-based confirmation (not stored in DB)")
        else:
            logger.info(f"Using DB-based confirmation, Created: {emailconfirmation.created}")
            
            # 檢查是否真的保存到資料庫
            from allauth.account.models import EmailConfirmation
            try:
                db_confirmation = EmailConfirmation.objects.get(key=emailconfirmation.key)
                logger.info(f"Confirmation found in DB: {db_confirmation.key}")
            except EmailConfirmation.DoesNotExist:
                logger.error(f"Confirmation NOT found in DB for key: {emailconfirmation.key}")
        
        # 最後記得呼叫父類別的原始方法，郵件才會真的被處理
        return super().send_confirmation_mail(request, emailconfirmation, signup)

    def send_mail(self, template_prefix, email, context):
        msg = self.render_mail(template_prefix, email, context)
        transaction.on_commit(msg.send)

    def add_message(self, request, level, message_template, message_context=None, extra_tags=""):
        pass