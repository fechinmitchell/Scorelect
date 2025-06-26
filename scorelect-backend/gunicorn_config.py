# gunicorn_config.py
import os
import multiprocessing

# Reduce workers to save memory on Render's free tier
workers = 2  # Reduced from default

# Worker class - use sync for lower memory usage
worker_class = 'sync'

# Increase timeout for slow queries
timeout = 120  # 2 minutes

# Max requests per worker before restart (helps with memory leaks)
max_requests = 100
max_requests_jitter = 20

# Limit request size to prevent large uploads from crashing
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Preload app to save memory
preload_app = True

# Bind to the port Render provides
bind = f"0.0.0.0:{os.environ.get('PORT', '10000')}"

# Logging
accesslog = '-'
errorlog = '-'
loglevel = 'info'