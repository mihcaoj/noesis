from django.apps import AppConfig

"""
Django app configuration that registers the core app and connects signal handlers.
"""
class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        import core.signals
