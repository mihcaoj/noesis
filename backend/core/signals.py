from django.db.models.signals import post_migrate, post_save
from django.dispatch import receiver
from django.utils import timezone
from datetime import timedelta
from core.models import Role, Session, Review, Notification

"""
This module contains Signal handlers that respond to Model events.
These handlers maintain data integrity, trigger notifications & perform automated tasks when specific events occur.

Signal handlers include:
- Creating default roles after database migrations
- Managing notifications for session status changes
- Updating tutor ratings when reviews are created
- Processing session reminders for upcoming appointments
"""
@receiver(post_migrate)
def create_default_roles(sender, **kwargs):
    default_roles = ['Student', 'Tutor']
    for role in default_roles:
        Role.objects.get_or_create(name=role)

@receiver(post_save, sender=Session)
def handle_session_updates(sender, instance, created, **kwargs):
    # Check if status changed to 'completed'
    if not created and instance.status == 'completed':
        # Check if a notification already exists for this session
        existing_notification = Notification.objects.filter(
            related_session=instance,
            notification_type='session_completed',
            recipient=instance.student
        ).exists()

        # Only create a notification if one doesn't already exist
        if not existing_notification:
            Notification.create_session_completed_notification(instance)

    # Check if session is tomorrow and create reminder
    if instance.status == 'confirmed':
        session_date = instance.date_time.date()
        tomorrow = timezone.now().date() + timedelta(days=1)
        if session_date == tomorrow:
            student_notified = Notification.objects.filter(
                recipient=instance.student,
                notification_type='session_reminder',
                related_session=instance
            ).exists()

            tutor_notified = Notification.objects.filter(
                recipient=instance.tutor,
                notification_type='session_reminder',
                related_session=instance
            ).exists()

            if not student_notified or not tutor_notified:
                Notification.create_session_reminder(instance)

@receiver(post_save, sender=Review)
def handle_review_created(sender, instance, created, **kwargs):
    if created:
        Notification.create_new_review_notification(instance)

@receiver(post_save, sender=Review)
def update_tutor_rating_on_review(sender, instance, created, **kwargs):
    if instance.session and instance.session.tutor:
        tutor = instance.session.tutor
        avg_rating, total_ratings = tutor.update_rating()
