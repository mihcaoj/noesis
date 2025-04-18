from .models import *
from rest_framework import serializers
from django.utils import timezone
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from datetime import timedelta
import time
import os

"""
This module contains Django REST Framework Serializers that transform Django Models to and from JSON for API communication.

The serializers handle:
- Data validation and type conversion
- Object serialization
- Nested relationships
- Custom field processing
- Request data parsing and validation
"""
class BaseUserSerializer(serializers.ModelSerializer):
    def get_profile_picture_url(self, obj, request=None):
        """Method to get and format profile picture URL"""
        if not obj.profile_picture:
            return None

        if request:
            url = request.build_absolute_uri(obj.profile_picture.url)

            return url.replace('/api/media/', '/media/') # clean up API prefix in URL
        return obj.profile_picture.url

class CustomUserSerializer(BaseUserSerializer):
    profile_picture = serializers.SerializerMethodField()
    roles = serializers.SlugRelatedField(
        many=True,
        slug_field='name',
        queryset=Role.objects.all(),
    )
    topics = serializers.SerializerMethodField()

    def get_profile_picture(self, obj):
        request = self.context.get('request')
        return self.get_profile_picture_url(obj, request)

    def get_topics(self, obj):
        if obj.roles.filter(name='Tutor').exists():
            return [topic.topic.name for topic in TutorTopic.objects.filter(tutor=obj)]
        return []

    class Meta:
        model = CustomUser
        # Fields to be serialized
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'roles', 'profile_picture', 'bio', 'preferred_mode', 'location',
            'lesson_description', 'hourly_rate', 'is_online', 'last_active', 'date_joined', 'topics'
        ]
        # Read-only fields
        read_only_fields = ['id', 'is_online', 'last_active', 'date_joined']

    def update(self, instance, validated_data):
        roles_data = validated_data.pop('roles', None)
        instance = super().update(instance, validated_data)

        if roles_data is not None:
            roles = Role.objects.filter(name__in=roles_data)
            instance.roles.set(roles)

        return instance

class CustomUserRegistrationSerializer(BaseUserSerializer):
    password = serializers.CharField(write_only=True)
    roles = serializers.SlugRelatedField(
        many=True,
        slug_field='name',
        queryset=Role.objects.all()
    )
    topics = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        write_only=True
    )
    hourly_rate = serializers.DecimalField(
            max_digits=10,
            decimal_places=2,
            required=False,
            allow_null=True
        )

    class Meta:
        model = CustomUser
        fields = ['username', 'email', 'password', 'first_name', 'last_name', 'roles', 'topics', 'hourly_rate']
        extra_kwargs = {
            'topics': {'write_only': True}
        }

    def validate(self, attrs):
        """Validation -> tutors must select at least one topic and have an hourly rate"""
        roles = attrs.get('roles', [])
        topics = attrs.get('topics', [])
        hourly_rate = attrs.get('hourly_rate')

        # Check if user is registering as a tutor
        is_tutor = any(role.name.lower() == 'tutor' for role in roles)

        if is_tutor:
            if not topics:
                raise serializers.ValidationError({"topics": "At least one topic is required for tutors"})
            if hourly_rate is None:
                raise serializers.ValidationError({"hourly_rate": "Hourly rate is required for tutors"})

        return attrs

    def create(self, validated_data):
        roles_data = validated_data.pop('roles', [])
        topics_data = validated_data.pop('topics', [])
        hourly_rate = validated_data.pop('hourly_rate', None)

        # Create the user
        user = CustomUser.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )

        # Assign roles to the user
        user.roles.set(roles_data)

        # If user is a tutor, assign topics and hourly rate
        if any(role.name.lower() == 'tutor' for role in roles_data):
            if hourly_rate is not None:
                user.hourly_rate = hourly_rate
                user.save()

            self._create_tutor_topics(user, topics_data)

        return user

    def _create_tutor_topics(self, user, topics_data):
        """Helper method to create tutor topics"""
        for topic_name in topics_data:
            try:
                # Try to get the topic with an exact match first
                topic = Topic.objects.filter(name__iexact=topic_name).first()

                # If no topic found, create a new one
                if not topic:
                    topic = Topic.objects.create(name=topic_name)

                # Create TutorTopic relationship
                TutorTopic.objects.create(tutor=user, topic=topic)

            except Exception as e:
                print(f"Error processing topic {topic_name}: {str(e)}")
                # Continue with other topics if one fails
                continue

class CustomUserUpdateSerializer(BaseUserSerializer):
    class Meta:
        model = CustomUser
        fields = [
            'username', 'email', 'first_name', 'last_name',
            'bio', 'profile_picture', 'preferred_mode', 'location',
            'lesson_description', 'hourly_rate'
        ]

    def update(self, instance, validated_data):
        if self._should_remove_profile_picture():
            self._remove_profile_picture(instance)

        return super().update(instance, validated_data)

    def _should_remove_profile_picture(self):
        """Check if profile picture should be removed"""
        request = self.context.get('request')
        return request and request.data.get('remove_profile_picture') == 'true'

    def _remove_profile_picture(self, instance):
        """Remove the profile picture and set to None"""
        if not instance.profile_picture:
            return

        file_path = instance.profile_picture.path
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                print(f"Deleted file at {file_path}")
            except Exception as e:
                print(f"Error deleting file: {e}")

        instance.profile_picture = None
        instance.save(update_fields=['profile_picture'])

        # Remove profile_picture from validated_data to prevent it from being set again
        if 'profile_picture' in self.validated_data:
            del self.validated_data['profile_picture']

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name']

class TopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ['id', 'name', 'description']

class TutorTopicSerializer(serializers.ModelSerializer):
    tutor = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.filter(roles__name__iexact='Tutor'),
        required=True
    )
    topic = serializers.PrimaryKeyRelatedField(
        queryset=Topic.objects.all(),
        required=True
    )

    class Meta:
        model = TutorTopic
        fields = ['id', 'tutor', 'topic']

    def validate(self, attrs):
        tutor = attrs.get('tutor')
        topic = attrs.get('topic')

        # Verify tutor exists and has Tutor role
        if not tutor:
            raise serializers.ValidationError({"tutor": "Tutor is required"})

        if not tutor.roles.filter(name__iexact='Tutor').exists():
            raise serializers.ValidationError({"tutor": "User must have the Tutor role"})

        # Check if the topic already exists for the tutor
        if TutorTopic.objects.filter(tutor=tutor, topic=topic).exists():
            raise serializers.ValidationError({"topic": "This topic already exists for the tutor"})

        return attrs

class LanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Language
        fields = ['id', 'name']

class TutorLanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = TutorLanguage
        fields = ['id', 'tutor', 'language']

class SessionSerializer(serializers.ModelSerializer):
    tutor_name = serializers.CharField(source='tutor.username', read_only=True)
    student_name = serializers.CharField(source='student.username', read_only=True)
    tutor = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.filter(roles__name__iexact='Tutor')
    )

    class Meta:
        model = Session
        fields = [
            'id', 'tutor', 'student', 'tutor_name', 'student_name',
            'date_time', 'duration', 'status', 'notes', 'topic', 'mode',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['student', 'created_at', 'updated_at']

    def validate(self, attrs):
        # Validate the booking time
        date_time = attrs.get('date_time')
        tutor = attrs.get('tutor')

        if date_time and date_time < timezone.now():
            raise serializers.ValidationError({
                "date_time": "Cannot book sessions in the past"
            })

        # Check tutor availability
        if date_time and tutor:
            duration = attrs.get('duration', timedelta(hours=1))
            if not Availability.objects.filter(
                tutor=tutor,
                available_date=date_time.date(),
                available_time_start__lte=date_time.time(),
                available_time_end__gte=(date_time + duration).time()
            ).exists():
                raise serializers.ValidationError({
                    "date_time": "Tutor is not available at this time"
                })

        return attrs

class AvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Availability
        fields = [
            'id', 'available_date', 'available_time_start',
            'available_time_end', 'recurring'
        ]

class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.PrimaryKeyRelatedField(read_only=True)
    receiver = serializers.PrimaryKeyRelatedField(queryset=CustomUser.objects.all())
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    receiver_name = serializers.CharField(source='receiver.username', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender', 'receiver', 'sender_name', 'receiver_name', 'message', 'timestamp', 'is_read']

    def create(self, validated_data):
        validated_data['sender'] = self.context['request'].user
        return super().create(validated_data)

class TutorWithTopicSerializer(serializers.ModelSerializer):
    topics = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'profile_picture', 'bio', 'hourly_rate', 'topics']

    def get_topics(self, obj):
        return [t.topic.name for t in obj.tutortopic_set.all()]

class ReviewSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='session.student.username', read_only=True)
    tutor_name = serializers.CharField(source='session.tutor.username', read_only=True)

    class Meta:
        model = Review
        fields = ['id', 'rating', 'comment', 'student_name', 'tutor_name', 'created_at']

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'notification_type', 'title', 'message', 'is_read', 'created_at', 'related_session', 'session_status']
        read_only_fields = ['created_at']

    def get_session_id(self, obj):
        return obj.related_session.id if obj.related_session else None


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect")
        return value

    def validate_new_password(self, value):
        try:
            validate_password(value, self.context['request'].user)
        except ValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user
