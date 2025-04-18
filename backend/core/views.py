from .models import *
from .serializers import *
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.decorators import action
from django.shortcuts import render, get_object_or_404
from django.db.models import Q, OuterRef, Subquery, Max
from django_filters.rest_framework import DjangoFilterBackend
from datetime import datetime
import os

"""
This module contains all the Django Views and Viewsets that handle HTTP requests & responses.

They include functionality for:
- User registration, profile management, and authentication
- Tutor discovery and searching
- Session booking, management, and status updates
- Messaging
- Review submission and retrieval
- Tutor availability management
- Notification handling
"""
class CustomUserViewSet(viewsets.ModelViewSet):
    queryset = CustomUser.objects.all()
    serializer_class = CustomUserSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['GET'], permission_classes=[AllowAny])
    def topics(self, request, pk=None):
        user = self.get_object()
        topics = [t.topic.name for t in TutorTopic.objects.filter(tutor=user)]
        return Response(topics)

class CustomUserRegistrationAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = CustomUserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer

class UpdateRoleView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        roles_data = request.data.get('roles', [])
        if not isinstance(roles_data, list):
            return Response({'error': 'Invalid format for roles'}, status=400)

        for role_name in roles_data:
            role, created = Role.objects.get_or_create(name=role_name)
            if not request.user.roles.filter(name=role_name).exists():
                request.user.roles.add(role)

        return Response({'message': 'Roles updated successfully', 'roles': list(request.user.roles.values_list('name', flat=True))})

class TopicViewSet(viewsets.ModelViewSet):
    queryset = Topic.objects.all()
    serializer_class = TopicSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['name']

    def list(self, request):
        # Custom list method to handle name filtering
        queryset = self.filter_queryset(self.get_queryset())
        name = request.query_params.get('name', None)

        if name:
            # Case-insensitive name filtering
            queryset = queryset.filter(name__iexact=name)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

class TutorTopicViewSet(viewsets.ModelViewSet):
    queryset = TutorTopic.objects.all()
    serializer_class = TutorTopicSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        # Ensure the current user is creating the topic for themselves
        request_data = request.data.copy()
        request_data['tutor'] = request.user.id

        # Use the serializer with the modified data
        serializer = self.get_serializer(data=request_data)

        try:
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except serializers.ValidationError as e:
            print("Validation Error:", e)
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['DELETE'])
    def remove_by_name(self, request):
        topic_name = request.data.get('topic_name')
        if not topic_name:
            return Response(
                {"detail": "Topic name is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            topic = Topic.objects.get(name__iexact=topic_name)
        except Topic.DoesNotExist:
            return Response(
                {"detail": f"Topic '{topic_name}' not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            tutor_topic = TutorTopic.objects.get(
                tutor=request.user,
                topic=topic
            )

            tutor_topic.delete()
            return Response(
                {"detail": f"Topic '{topic_name}' removed successfully"},
                status=status.HTTP_200_OK
            )
        except TutorTopic.DoesNotExist:
            return Response(
                {"detail": f"No association found between you and topic '{topic_name}'"},
                status=status.HTTP_404_NOT_FOUND
            )

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()

            # Ensure the user is removing their own topic
            if instance.tutor != request.user:
                return Response(
                    {"detail": "You can only remove your own topics"},
                    status=status.HTTP_403_FORBIDDEN
                )

            self.perform_destroy(instance)

            return Response(status=status.HTTP_204_NO_CONTENT)

        except Exception as e:
            print(f"Error in topic deletion: {e}")
            return Response(
                {"detail": "Failed to remove topic"},
                status=status.HTTP_400_BAD_REQUEST
            )

class LanguageViewSet(viewsets.ModelViewSet):
    queryset = Language.objects.all()
    serializer_class = LanguageSerializer

class TutorLanguageViewSet(viewsets.ModelViewSet):
    queryset = TutorLanguage.objects.all()
    serializer_class = TutorLanguageSerializer

class SessionViewSet(viewsets.ModelViewSet):
    serializer_class = SessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        Session.auto_complete_sessions()

        user = self.request.user
        status_filter = self.request.query_params.get('status')
        tutor_id = self.request.query_params.get('tutor')

        queryset = Session.objects.filter(Q(student=user) | Q(tutor=user))

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if tutor_id:
            queryset = queryset.filter(tutor_id=tutor_id)

        return queryset.order_by('-date_time')

    def create(self, request, *args, **kwargs):
        tutor_id = request.data.get('tutor')
        tutor = CustomUser.objects.filter(
            id=tutor_id,
            roles__name__iexact='Tutor'
        ).first()

        if not tutor:
            return Response(
                {"error": "Invalid tutor ID or user is not a tutor"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Extract date_time from request data
        date_time_str = request.data.get('date_time')
        try:
            date_time = parse_datetime_safely(date_time_str)
            booking_date = date_time.date()
            booking_time_start = date_time.time()
            booking_time_end = None
            booking_weekday = booking_date.weekday()

            duration_str = request.data.get('duration', '01:00:00')
            if isinstance(duration_str, str):
                hours, minutes, seconds = map(int, duration_str.split(':'))
                duration = timedelta(hours=hours, minutes=minutes, seconds=seconds)
            else:
                duration = duration_str

            booking_time_end = (date_time + duration).time()
            start_time = date_time - timedelta(minutes=30)
            end_time = date_time + timedelta(minutes=30)

            rejected_session = Session.objects.filter(
                tutor_id=tutor_id,
                student=request.user,
                date_time__gte=start_time,
                date_time__lte=end_time,
                status='rejected'
            ).exists()

            if rejected_session:
                return Response(
                    {"error": "This booking request was previously denied by the tutor. Please select a different time slot."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            exact_match = Availability.objects.filter(
                tutor=tutor,
                available_date=booking_date,
                available_time_start__lte=booking_time_start,
                available_time_end__gte=booking_time_end
            ).exists()

            # If no direct match, check recurring availability
            if not exact_match:
                is_available = False
                recurring_slots = Availability.objects.filter(
                    tutor=tutor,
                    recurring=True,
                    available_time_start__lte=booking_time_start,
                    available_time_end__gte=booking_time_end
                )

                for slot in recurring_slots:
                    slot_weekday = slot.available_date.weekday()
                    if slot_weekday == booking_weekday:
                        # Create a one-time availability for this date to ensure validation
                        new_availability = Availability.objects.create(
                            tutor=tutor,
                            available_date=booking_date,
                            available_time_start=slot.available_time_start,
                            available_time_end=slot.available_time_end,
                            recurring=False
                        )
                        print(f"Created one-time availability {new_availability.id} from recurring slot")
                        is_available = True
                        break

                if not is_available:
                    return Response(
                        {"error": "Tutor is not available at this time. Please select a different time slot."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

        except Exception as e:
            print(f"Error processing session booking: {e}")

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        session = serializer.save(student=self.request.user)
        Notification.create_booking_request(session)

        return session

    @action(detail=True, methods=['post'])
    def reschedule(self, request, pk=None):
        session = self.get_object()
        new_date_time_str = request.data.get('date_time')

        # Validate that only the tutor can reschedule
        if request.user != session.tutor:
            return Response(
                {'error': 'Only the tutor can reschedule sessions'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Validate the session status
        if not session.is_confirmed:
            return Response(
                {'error': 'Only confirmed sessions can be rescheduled'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate the new date time
        try:
            new_date_time = parse_datetime_safely(new_date_time_str)

            # Check if date is in the past
            if new_date_time < timezone.now():
                return Response(
                    {'error': 'Cannot reschedule to a past date/time'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check for overlapping sessions
            overlapping_sessions = Session.objects.filter(
                tutor=session.tutor,
                date_time__lt=new_date_time + session.duration,
                date_time__gt=new_date_time - session.duration,
                status__in=['pending', 'confirmed', 'reschedule_pending']
            ).exclude(pk=session.pk)

            if overlapping_sessions.exists():
                return Response(
                    {'error': 'This time slot is already booked'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Store old session details
            old_date_time = session.date_time

            # Check for availability or create one if needed for the new time
            self._ensure_availability_exists(session.tutor, new_date_time, session.duration)

            # Store the proposed new date time in the notes field
            original_notes = session.notes or ""
            session.notes = f"{original_notes}\n[RESCHEDULE_REQUEST]{new_date_time_str}".strip()

            # Change status to reschedule_pending
            session.status = 'reschedule_pending'
            session.save()

            # Create notification for the student
            Notification.create_reschedule_request(
                session=session,
                old_datetime=old_date_time,
                new_datetime=new_date_time
            )

            return Response({
                'message': 'Session reschedule request sent to student',
                'session': SessionSerializer(session).data
            })

        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def _ensure_availability_exists(self, tutor, datetime_obj, duration):
        """Ensure availability exists for the given date and time, if not, create"""
        session_date = datetime_obj.date()
        session_start_time = datetime_obj.time()
        session_end_time = (datetime_obj + duration).time()

        availability_exists = Availability.objects.filter(
            tutor=tutor,
            available_date=session_date,
            available_time_start__lte=session_start_time,
            available_time_end__gte=session_end_time
        ).exists()

        if not availability_exists:
            # Create an availability entry if not found
            try:
                Availability.objects.create(
                    tutor=tutor,
                    available_date=session_date,
                    available_time_start=session_start_time,
                    available_time_end=session_end_time,
                    recurring=False
                )
                return True
            except Exception as e:
                print(f"Error creating availability: {e}")
                raise ValueError(f"Error creating availability: {str(e)}")

        return True

    @action(detail=True, methods=['post'])
    def reschedule_response(self, request, pk=None):
        session = self.get_object()
        response = request.data.get('response')  # 'accept' or 'reject'

        # Validate that only the student can respond to reschedule
        if request.user != session.student:
            return Response(
                {'error': 'Only the student can respond to reschedule requests'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Validate the session status
        if not session.is_reschedule_pending:
            return Response(
                {'error': 'This session is not pending reschedule'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Get the new datetime from the notes using the helper method
            new_date_time = session.get_reschedule_datetime()
            original_notes = session.get_original_notes()

            if not new_date_time:
                return Response(
                    {'error': 'Invalid reschedule request data'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Store old session details
            old_date_time = session.date_time

            if response == 'accept':
                # Update the session with new date time
                session.date_time = new_date_time
                session.status = 'confirmed'
                session.notes = original_notes
                session.save()

                # Create notification for the tutor
                Notification.create_reschedule_response(
                    session=session,
                    accepted=True,
                    old_datetime=old_date_time
                )

                return Response({
                    'message': 'Reschedule request accepted',
                    'session': SessionSerializer(session).data
                })

            elif response == 'reject':
                # Reset notes and change status to cancelled
                session.notes = original_notes
                session.status = 'cancelled'
                session.save()

                # Create notification for the tutor
                Notification.create_reschedule_response(
                    session=session,
                    accepted=False
                )

                return Response({
                    'message': 'Reschedule request rejected, session cancelled',
                    'session': SessionSerializer(session).data
                })
            else:
                return Response(
                    {'error': 'Invalid response. Must be "accept" or "reject"'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            print(f"Error processing reschedule response: {e}")
            return Response(
                {'error': f'Error processing reschedule response: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        session = self.get_object()
        new_status = request.data.get('status')

        # Validate the new status
        if new_status not in dict(Session.STATUS_CHOICES):
            return Response(
                {'error': 'Invalid status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check permissions
        if new_status in ['confirmed', 'rejected']:
            if request.user != session.tutor:
                return Response(
                    {'error': 'Only the tutor can confirm or reject sessions'},
                    status=status.HTTP_403_FORBIDDEN
                )
        elif new_status == 'cancelled':
            if request.user not in [session.student, session.tutor]:
                return Response(
                    {'error': 'Only the student or tutor can cancel sessions'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Update session status
        session.status = new_status

        # Bypass the full clean/validation when just changing status
        session.save(update_fields=['status'])

        # Create notification for completed sessions
        if new_status == 'completed':
            Notification.create_session_completed_notification(session)

        # Update existing booking request notification if it exists
        booking_notification = Notification.objects.filter(
            related_session=session,
            notification_type='booking_request'
        ).first()

        if booking_notification:
            booking_notification.session_status = new_status
            booking_notification.save()

        # Handle notifications for status updates
        if new_status == 'confirmed':
            # Create notification for confirmed sessions
            Notification.create_booking_response(session, accepted=True)

        elif new_status == 'rejected':
            # Create notification for rejected sessions
            Notification.create_booking_response(session, accepted=False)

        return Response(SessionSerializer(session).data)

class AvailabilityViewSet(viewsets.ModelViewSet):
    queryset = Availability.objects.all()
    serializer_class = AvailabilitySerializer

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        recipient_id = self.request.query_params.get('receiver')

        if recipient_id and recipient_id.isdigit():
            recipient_id = int(recipient_id)
            return Message.objects.filter(
                (Q(sender=user) & Q(receiver_id=recipient_id)) |
                (Q(sender_id=recipient_id) & Q(receiver=user))
            ).order_by('timestamp')

        return Message.objects.none()

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)

    @action(detail=False, methods=['GET'], url_path=r'conversations')
    def get_conversations(self, request):
        # Get the latest message for each conversation the user is part of
        latest_messages_subquery = Message.objects.filter(
            Q(sender_id=OuterRef('id'), receiver=request.user) |
            Q(sender=request.user, receiver_id=OuterRef('id'))
        ).order_by('-timestamp').values('timestamp')[:1]

        conversations = CustomUser.objects.annotate(
            last_message_timestamp=Subquery(latest_messages_subquery)
        ).filter(
            Q(sent_messages__receiver=request.user) |
            Q(received_messages__sender=request.user)
        ).distinct()

        conversation_details = []
        for user in conversations:
            # Get the last message between the current user and this conversation partner
            last_message = Message.objects.filter(
                Q(sender=user, receiver=request.user) |
                Q(sender=request.user, receiver=user)
            ).order_by('-timestamp').first()

            # Count unread messages from this user
            unread_count = Message.objects.filter(
                sender=user,
                receiver=request.user,
                is_read=False
            ).count()

            conversation_details.append({
                'user': CustomUserSerializer(user).data,
                'last_message': MessageSerializer(last_message).data if last_message else None,
                'unread_count': unread_count
            })

        # Sort conversations by most recent message
        conversation_details.sort(
            key=lambda x: x['last_message']['timestamp'] if x['last_message'] else None,
            reverse=True
        )

        return Response({
            'results': conversation_details
        })

    @action(detail=False, methods=['POST'], url_path='mark-read')
    def mark_messages_read(self, request):
        sender_id = request.data.get('sender_id')
        if not sender_id:
            return Response({'error': 'Sender ID is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Mark all unread messages from the specified sender as read
        Message.objects.filter(
            sender_id=sender_id,
            receiver=request.user,
            is_read=False
        ).update(is_read=True)

        return Response({'message': 'Messages marked as read'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['GET'], url_path='unread-count')
    def unread_messages_count(self, request):
        unread_count = Message.objects.filter(
            receiver=request.user,
            is_read=False
        ).count()

        return Response({
            'unread_count': unread_count
        }, status=status.HTTP_200_OK)

class UserProfileView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request, username=None):
        """Get user profile - either the current user or a specific username"""
        if username:
            # Retrieve specific user profile
            user = get_object_or_404(CustomUser, username=username)
        elif request.user.is_authenticated:
            # Return the current user's profile
            user = request.user
        else:
            return Response({"authenticated": False, "detail": "Not authenticated"}, status=200)

        serializer = CustomUserSerializer(user, context={'request': request})
        return Response(serializer.data)

    def put(self, request, username=None):
        """Update user profile"""
        if username and username != request.user.username:
            return Response({"detail": "You can only update your own profile"}, status=status.HTTP_403_FORBIDDEN)

        user = request.user

        # Create a serializer with the context including the request
        serializer = CustomUserUpdateSerializer(
            user,
            data=request.data,
            partial=True,
            context={'request': request}
        )

        if serializer.is_valid():
            instance = serializer.save()

            # Return the updated user with profile picture URL formatted
            response_serializer = CustomUserSerializer(instance, context={'request': request})
            return Response(response_serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, username=None):
        """Delete a user profile"""
        if username and username != request.user.username:
            return Response({"detail": "You can only delete your own profile"}, status=status.HTTP_403_FORBIDDEN)

        user = request.user
        user.delete()
        return Response({"message": "Your account has been deleted successfully."})

class TutorListView(ListAPIView):
    serializer_class = CustomUserSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return CustomUser.objects.filter(roles__name='Tutor')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        return context

class TutorSearchView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get('q', '')
        tutors = CustomUser.objects.filter(roles__name='tutor').filter(
            models.Q(username__icontains=query) |
            models.Q(tutortopic__topic__name__icontains=query)
        ).distinct()
        serializer = CustomUserSerializer(tutors, many=True)
        return Response(serializer.data)

class TutorReviewsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, tutor_id):
        try:
            reviews = Review.objects.filter(session__tutor_id=tutor_id)
            serializer = ReviewSerializer(reviews, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class ReviewedTutorsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Return a list of tutor IDs that the current user has already reviewed"""
        try:
            student = request.user
            # Find all sessions where the current user was a student
            student_sessions = Session.objects.filter(student=student)

            # Find all reviews made by this student
            reviews = Review.objects.filter(session__in=student_sessions)

            # Extract unique tutor IDs from those reviews
            tutor_ids = reviews.values_list('session__tutor', flat=True).distinct()

            return Response({'tutor_ids': list(tutor_ids)}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class SubmitReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        session_id = request.data.get('session_id')
        rating = request.data.get('rating')
        comment = request.data.get('comment', '')

        try:
            try:
                session = Session.objects.get(id=session_id, student=request.user, status='completed')
            except Session.DoesNotExist:
                return Response({'detail': 'Invalid session or session not completed.'}, status=status.HTTP_400_BAD_REQUEST)

            # Check if a review already exists for this session
            existing_review = Review.objects.filter(session=session).first()

            if existing_review:
                return Response({
                    'detail': 'A review already exists for this session.',
                    'review': ReviewSerializer(existing_review).data
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create a new review
            review = Review(session=session, rating=rating, comment=comment)
            review.save()

            # Update the tutor rating
            tutor = session.tutor
            avg_rating, total_ratings = tutor.update_rating()

            serializer = ReviewSerializer(review)
            return Response({
                'message': 'Review submitted successfully.',
                'review': serializer.data,
                'tutor_rating_updated': {
                    'username': tutor.username,
                    'average_rating': tutor.average_rating,
                    'total_ratings': tutor.total_ratings
                }
            }, status=status.HTTP_201_CREATED)

        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CheckReviewExistsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        try:
            # Check if the session exists and belongs to the current user
            session = get_object_or_404(Session, id=session_id, student=request.user)

            # Check if a review already exists for this session
            existing_review = Review.objects.filter(session=session).first()

            if existing_review:
                return Response({
                    'exists': True,
                    'review': {
                        'id': existing_review.id,
                        'rating': existing_review.rating,
                        'comment': existing_review.comment,
                        'created_at': existing_review.created_at
                    }
                })

            return Response({'exists': False})

        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class AvailabilityUpdateView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def post(self, request):
        tutor = request.user
        if not tutor.roles.filter(name='Tutor').exists():
            return Response({'detail': 'Only tutors can set availability.'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        for availability in data:
            serializer = AvailabilitySerializer(data=availability)
            if serializer.is_valid():
                new_availability = serializer.save(tutor=tutor)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        return Response(AvailabilitySerializer(new_availability).data, status=status.HTTP_200_OK)

    def get(self, request):
        tutor_id = request.query_params.get('tutor')
        if tutor_id:
            # If a specific tutor is requested, get their availabilities
            availabilities = Availability.objects.filter(tutor_id=tutor_id)
            serializer = AvailabilitySerializer(availabilities, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            if not request.user.is_authenticated:
                return Response({'detail': 'Please specify a tutor ID.'},
                        status=status.HTTP_400_BAD_REQUEST)
            # If no tutor specified and user is a tutor, get their own availabilities
            if not request.user.roles.filter(name='Tutor').exists():
                return Response({'detail': 'Only tutors can view availability.'},
                        status=status.HTTP_403_FORBIDDEN)
            availabilities = Availability.objects.filter(tutor=request.user)
            serializer = AvailabilitySerializer(availabilities, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, id):
        tutor = request.user
        if not tutor.roles.filter(name='Tutor').exists():
            return Response({'detail': 'Only tutors can edit availability.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            availability = Availability.objects.get(id=id, tutor=tutor)
        except Availability.DoesNotExist:
            return Response({'detail': 'Availability not found or permission denied.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AvailabilitySerializer(availability, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({'message': 'Availability updated successfully.', 'availability': serializer.data}, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request):
        tutor = request.user
        availability_id = request.data.get('id')

        if not tutor.roles.filter(name='Tutor').exists():
            return Response({'detail': 'Only tutors can delete availability.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            availability = Availability.objects.get(id=availability_id, tutor=tutor)
            availability.delete()
            return Response({'message': 'Availability deleted successfully.'}, status=status.HTTP_200_OK)
        except Availability.DoesNotExist:
            raise PermissionDenied("You do not have permission to delete this availability or it does not exist.")

    def update(self, request, *args, **kwargs):
        availability_id = kwargs.get('pk')
        try:
            availability = Availability.objects.get(id=availability_id, tutor=request.user)
            serializer = self.get_serializer(availability, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Availability.DoesNotExist:
            return Response({'detail': 'Availability not found or unauthorized.'}, status=status.HTTP_404_NOT_FOUND)

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        notifications = Notification.objects.filter(recipient=user)

        return notifications

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response({'status': 'notification marked as read'})

    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        self.get_queryset().update(is_read=True)
        return Response({'status': 'all notifications marked as read'})

    @action(detail=True, methods=['delete'])
    def delete_notification(self, request, pk=None):
        notification = self.get_object()
        notification.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data, context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(
                {"detail": "Password changed successfully"},
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
