from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db.models import F
import os

"""
This module defines the Data Models that represent the database tables and relationships.

The models include:
- User and user related: CustomUser (extending Django AbstractUser), Role
- Tutoring specific: Topic, TutorTopic, Language, TutorLanguage, Availability
- Session management: Session, Review
- Communication: Message, Notification
"""
class Role(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def save(self, *args, **kwargs):
        # Always capitalize the role name before saving
        self.name = self.name.capitalize()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class CustomUser(AbstractUser):
    email = models.EmailField(max_length=255, unique=True)
    roles = models.ManyToManyField(Role, blank=True)

    # Custom fields
    profile_picture = models.ImageField(upload_to='profile_pictures/', blank=True, null=True)
    bio = models.TextField(blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    lesson_description = models.TextField(blank=True, null=True)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_online = models.BooleanField(default=False)
    last_active = models.DateTimeField(blank=True, null=True)

    preferred_mode = models.CharField(
        max_length=20,
        choices=[('webcam', 'Webcam'), ('in-person', 'In-Person'), ('both', 'Both')],
        default='both'
    )

    average_rating = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    total_ratings = models.PositiveIntegerField(default=0)

    def update_rating(self):
        """Update the user's average rating based on reviews they've received"""
        # Find all sessions where this user is a tutor
        tutor_sessions = self.sessions_as_tutor.all()

        # Get all reviews for these sessions
        reviews = Review.objects.filter(session__in=tutor_sessions)
        total_reviews = reviews.count()

        if total_reviews > 0:
            # Calculate average rating
            total_rating = sum(review.rating for review in reviews)
            self.average_rating = total_rating / total_reviews
            self.total_ratings = total_reviews
            self.save(update_fields=['average_rating', 'total_ratings'])
        else:
            self.average_rating = None
            self.total_ratings = 0
            self.save(update_fields=['average_rating', 'total_ratings'])

        return self.average_rating, self.total_ratings

    def save(self, *args, **kwargs):
        # If this instance already exists in the DB, get it
        if self.pk:
            try:
                old_instance = CustomUser.objects.get(pk=self.pk)
                # If profile picture has changed and old one exists, delete it
                if old_instance.profile_picture and (not self.profile_picture or
                                                    old_instance.profile_picture != self.profile_picture):
                    if os.path.exists(old_instance.profile_picture.path):
                        try:
                            os.remove(old_instance.profile_picture.path)
                            print(f"Deleted old profile picture: {old_instance.profile_picture.path}")
                        except Exception as e:
                            print(f"Error deleting old profile picture: {e}")
            except CustomUser.DoesNotExist:
                pass

        super().save(*args, **kwargs)

    def __str__(self):
        return self.username

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

class Topic(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

class TutorTopic(models.Model):
    tutor = models.ForeignKey(CustomUser, on_delete=models.CASCADE, limit_choices_to={'roles__name': 'tutor'})
    topic = models.ForeignKey(Topic, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('tutor', 'topic')

    def __str__(self):
        return f"{self.tutor.username} teaches {self.topic.name}"

class Language(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name

class TutorLanguage(models.Model):
    tutor = models.ForeignKey(CustomUser, on_delete=models.CASCADE, limit_choices_to={'roles__name': 'tutor'})
    language = models.ForeignKey(Language, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('tutor', 'language')

    def __str__(self):
        return f"{self.tutor.username} speaks {self.language.name}"

def parse_datetime_safely(datetime_string):
    """Parse a datetime string in various formats"""
    from datetime import datetime

    if not datetime_string:
        raise ValueError("Empty datetime string")

    try:
        if 'T' in datetime_string:
            # ISO format
            cleaned_datetime = datetime_string.replace('Z', '')
            if '+' in cleaned_datetime:
                cleaned_datetime = cleaned_datetime.split('+')[0]

            dt = datetime.fromisoformat(cleaned_datetime)
        else:
            # Handle simpler date+time format
            dt = datetime.fromisoformat(datetime_string)

        # Make timezone-aware
        if dt.tzinfo is None:
            dt = timezone.make_aware(dt)

        return dt
    except Exception as e:
        raise ValueError(f"Invalid date format: {str(e)}")

class Session(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('rejected', 'Rejected'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('reschedule_pending', 'Reschedule Pending')
    ]

    MODE_CHOICES = [
        ('webcam', 'Webcam'),
        ('in-person', 'In-Person')
    ]

    tutor = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sessions_as_tutor', limit_choices_to={'roles__name__iexact': 'tutor'})
    student = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sessions_as_student', limit_choices_to={'roles__name__iexact': 'student'})
    date_time = models.DateTimeField()
    duration = models.DurationField()
    topic = models.CharField(max_length=100, blank=True, null=True)
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Properties for status checks
    @property
    def is_pending(self):
        return self.status == 'pending'

    @property
    def is_confirmed(self):
        return self.status == 'confirmed'

    @property
    def is_completed(self):
        return self.status == 'completed'

    @property
    def is_cancelled(self):
        return self.status == 'cancelled'

    @property
    def is_rejected(self):
        return self.status == 'rejected'

    @property
    def is_reschedule_pending(self):
        return self.status == 'reschedule_pending'

    @property
    def can_be_rescheduled(self):
        return self.is_confirmed and self.date_time > timezone.now()

    @property
    def can_be_cancelled(self):
        return self.is_confirmed or self.is_pending or self.is_reschedule_pending

    @property
    def formatted_date_time(self):
        """Return a nicely formatted date/time string"""
        return self.date_time.strftime("%A, %d %B %Y at %H:%M")

    def get_reschedule_datetime(self):
        """Extract new date_time from reschedule request in notes"""
        if not self.notes or '[RESCHEDULE_REQUEST]' not in self.notes:
            return None

        try:
            reschedule_parts = self.notes.split('[RESCHEDULE_REQUEST]')
            new_date_time_str = reschedule_parts[-1].strip()
            return parse_datetime_safely(new_date_time_str)
        except Exception:
            return None

    def get_original_notes(self):
        """Get original notes without reschedule request data"""
        if not self.notes or '[RESCHEDULE_REQUEST]' not in self.notes:
            return self.notes

        reschedule_parts = self.notes.split('[RESCHEDULE_REQUEST]')
        return reschedule_parts[0].strip()

    def update_status_only(self, new_status):
        """Update just the status field, bypassing validation"""
        self._only_updating_status = True
        self.status = new_status
        self.save(update_fields=['status'])
        delattr(self, '_only_updating_status')
        return self

    def clean(self):
        # Skip validation if only updating the status - used to allow marking past sessions as completed
        if self.pk and hasattr(self, '_only_updating_status') and self._only_updating_status:
            return

        if self.date_time < timezone.now():
            if not self.pk or hasattr(self, '_date_time_changed'):
                raise ValidationError("Cannot book sessions in the past")

        # Skip this check when just updating the status
        if not self.pk or self._state.adding or hasattr(self, '_date_time_changed'):
            booking_date = self.date_time.date()
            booking_time_start = self.date_time.time()
            booking_time_end = (self.date_time + self.duration).time()
            booking_weekday = booking_date.weekday()  # 0 = Monday, 6 = Sunday in Python

            exact_date_available = Availability.objects.filter(
                tutor=self.tutor,
                available_date=booking_date,
                available_time_start__lte=booking_time_start,
                available_time_end__gte=booking_time_end
            ).exists()

            recurring_available = Availability.objects.filter(
                tutor=self.tutor,
                recurring=True,
                available_time_start__lte=booking_time_start,
                available_time_end__gte=booking_time_end
            ).extra(
                where=["EXTRACT(DOW FROM available_date) = %s"],
                params=[(booking_weekday + 1) % 7]  # Convert from Python weekday to PostgreSQL DOW
            ).exists()

            if not (exact_date_available or recurring_available):
                raise ValidationError("Tutor is not available at this time")

            # Check for overlapping sessions
            overlapping_sessions = Session.objects.filter(
                tutor=self.tutor,
                date_time__lt=self.date_time + self.duration,
                date_time__gt=self.date_time - self.duration,
                status__in=['pending', 'confirmed']
            ).exclude(pk=self.pk)

            if overlapping_sessions.exists():
                raise ValidationError("This time slot is already booked")

    @classmethod
    def auto_complete_sessions(cls):
        """Automatically mark past confirmed sessions as completed"""
        now = timezone.now()

        # Find sessions that have ended
        confirmed_sessions = cls.objects.filter(status='confirmed')

        completed_count = 0
        for session in confirmed_sessions:
            end_time = session.date_time + session.duration

            # If session has ended, mark it completed
            if end_time < now:
                # Direct update to bypass validation
                session.update_status_only('completed')
                completed_count += 1

        return completed_count

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Session on {self.date_time} ({self.status})"

class Review(models.Model):
    session = models.OneToOneField(
        Session,
        on_delete=models.CASCADE,
        related_name='review'
    )
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        """Ensure that the review can only be created for completed sessions"""
        if self.session.status != 'completed':
            raise ValidationError("You can only review a completed session.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

        # Update the tutor's rating
        tutor = self.session.tutor
        avg_rating, total_ratings = tutor.update_rating()


class Availability(models.Model):
    tutor = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='availabilities', limit_choices_to={'roles__name': 'tutor'})
    available_date = models.DateField()
    available_time_start = models.TimeField()
    available_time_end = models.TimeField()
    recurring = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if not self.tutor.roles.filter(name='Tutor').exists():
            raise ValidationError("Only tutors can set availability.")
        super().save(*args, **kwargs)

    class Meta:
        unique_together = ('tutor', 'available_date', 'available_time_start')

    def __str__(self):
        return f"{self.tutor.username} available on {self.available_date} from {self.available_time_start} to {self.available_time_end}"

class Message(models.Model):
    sender = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sent_messages')
    receiver = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='received_messages')
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"Message from {self.sender.username} to {self.receiver.username} at {self.timestamp}"

class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('booking_request', 'Booking Request'),
        ('booking_confirmed', 'Booking Confirmed'),
        ('booking_cancelled', 'Booking Cancelled'),
        ('session_reminder', 'Session Reminder'),
        ('new_review', 'New Review'),
        ('session_rescheduled', 'Session Rescheduled'),
        ('reschedule_accepted', 'Reschedule Accepted'),
        ('reschedule_rejected', 'Reschedule Rejected'),
    ]

    recipient = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=255)
    message = models.TextField()
    related_session = models.ForeignKey(Session, on_delete=models.CASCADE, null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    session_status = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.notification_type} for {self.recipient.username}"

    @classmethod
    def create_notification(cls, recipient, notification_type, title, message, related_session=None, session_status=None):
        """Create notification with the given parameters"""
        return cls.objects.create(
            recipient=recipient,
            notification_type=notification_type,
            title=title,
            message=message,
            related_session=related_session,
            session_status=session_status
        )

    @classmethod
    def create_session_notification(cls, session, recipient, notification_type, title, message, session_status=None):
        """Create notification related to a session"""
        return cls.create_notification(
            recipient=recipient,
            notification_type=notification_type,
            title=title,
            message=message,
            related_session=session,
            session_status=session_status or session.status
        )

    @classmethod
    def create_booking_request(cls, session):
        """Create notification for a new booking request"""
        session_datetime = session.formatted_date_time
        notification_message = f'{session.student.username} has requested to book a session with you on {session_datetime}.'

        # Add optional notes if there are any
        if session.notes and session.notes.strip():
            notification_message += f'\nNotes: {session.notes}'

        return cls.create_session_notification(
            session=session,
            recipient=session.tutor,
            notification_type='booking_request',
            title='New Booking Request',
            message=notification_message
        )

    @classmethod
    def create_booking_response(cls, session, accepted=True):
        """Create notification for a booking response"""
        session_datetime = session.formatted_date_time

        if accepted:
            title = 'Booking Request Accepted'
            message = f'{session.tutor.username} has accepted your booking request for {session_datetime}.'
        else:
            title = 'Booking Request Rejected'
            message = f'{session.tutor.username} has rejected your booking request for {session_datetime}.'

        return cls.create_session_notification(
            session=session,
            recipient=session.student,
            notification_type='booking_response',
            title=title,
            message=message
        )

    @classmethod
    def create_session_cancelled(cls, session, cancelled_by):
        """Create notification when a session is cancelled"""
        session_datetime = session.formatted_date_time

        # Determine recipient based on who cancelled
        if cancelled_by == session.tutor:
            recipient = session.student
            message = f'Your session on {session_datetime} has been cancelled by {session.tutor.username}.'
        else:
            recipient = session.tutor
            message = f'Your session on {session_datetime} has been cancelled by {session.student.username}.'

        return cls.create_session_notification(
            session=session,
            recipient=recipient,
            notification_type='session_cancelled',
            title='Session Cancelled',
            message=message
        )

    @classmethod
    def create_reschedule_request(cls, session, old_datetime, new_datetime):
        """Create notification for a reschedule request"""
        old_formatted_date = old_datetime.strftime("%A, %d %B %Y at %H:%M")
        new_formatted_date = new_datetime.strftime("%A, %d %B %Y at %H:%M")
        message = f'{session.tutor.username} has requested to reschedule your session from {old_formatted_date} to {new_formatted_date}.'

        return cls.create_session_notification(
            session=session,
            recipient=session.student,
            notification_type='session_rescheduled',
            title='Session Reschedule Request',
            message=message,
            session_status='reschedule_pending'
        )

    @classmethod
    def create_reschedule_response(cls, session, accepted=True, old_datetime=None):
        """Create notification for a reschedule response"""
        if accepted:
            title = 'Reschedule Request Accepted'
            old_formatted_date = old_datetime.strftime("%A, %d %B %Y at %H:%M")
            new_formatted_date = session.formatted_date_time
            message = f'{session.student.username} has accepted your request to reschedule the session from {old_formatted_date} to {new_formatted_date}.'
            status = 'confirmed'
        else:
            title = 'Reschedule Request Rejected'
            session_time = session.formatted_date_time
            message = f'{session.student.username} has rejected your request to reschedule the session on {session_time}.'
            status = 'cancelled'

        return cls.create_session_notification(
            session=session,
            recipient=session.tutor,
            notification_type='reschedule_accepted' if accepted else 'reschedule_rejected',
            title=title,
            message=message,
            session_status=status
        )

    @classmethod
    def create_session_reminder(cls, session):
        """Create reminder notifications for an upcoming session"""
        session_time = session.formatted_date_time

        # Check if notifications already exists
        student_notified = cls.objects.filter(
            recipient=session.student,
            notification_type='session_reminder',
            related_session=session
        ).exists()

        tutor_notified = cls.objects.filter(
            recipient=session.tutor,
            notification_type='session_reminder',
            related_session=session
        ).exists()

        if not student_notified:
            cls.create_session_notification(
                session=session,
                recipient=session.student,
                notification_type='session_reminder',
                title='Upcoming Session Reminder',
                message=f'You have a session with {session.tutor.username} tomorrow at {session_time}.'
            )

        if not tutor_notified:
            cls.create_session_notification(
                session=session,
                recipient=session.tutor,
                notification_type='session_reminder',
                title='Upcoming Session Reminder',
                message=f'You have a session with {session.student.username} tomorrow at {session_time}.'
            )

        return True

    @classmethod
    def create_session_completed_notification(cls, session):
        """Create notification when a session is completed"""
        return cls.create_session_notification(
            session=session,
            recipient=session.student,
            notification_type='session_completed',
            title='Session Completed - Leave a Review',
            message=f'Your session with {session.tutor.username} is now complete. Please take a moment to leave a review.'
        )

    @classmethod
    def create_new_review_notification(cls, review):
        """Create notification when a new review is submitted"""
        session = review.session
        return cls.create_session_notification(
            session=session,
            recipient=session.tutor,
            notification_type='new_review',
            title='New Review Received',
            message=f'{session.student.username} left you a {review.rating}-star review.'
        )
