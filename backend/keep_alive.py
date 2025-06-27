import time
import requests
import logging
import sys

# 設置日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """主程序循環"""
    logger.info("Keep-alive service started")
    
    while True:
        try:
            response = requests.get('http://localhost:8080/health', timeout=5)
            logger.info(f'Keep-alive ping: {response.status_code}')
        except requests.exceptions.RequestException as e:
            logger.error(f'Keep-alive request failed: {e}')
        except Exception as e:
            logger.error(f'Unexpected error in keep-alive: {e}')
        
        time.sleep(30)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Keep-alive service stopped")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error in keep-alive service: {e}")
        sys.exit(1)