from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.conf import settings
from django.conf.urls.static import static
from .views import *

"""
This module maps URL patterns to view functions or classes, defining all accessible API endpoints.
"""
# Create a router for the viewsets
router = DefaultRouter()
router.register(r'users', CustomUserViewSet, basename='user')
router.register(r'roles', RoleViewSet)
router.register(r'topics', TopicViewSet)
router.register(r'tutor-topics', TutorTopicViewSet)
router.register(r'languages', LanguageViewSet)
router.register(r'tutor-languages', TutorLanguageViewSet)
router.register(r'sessions', SessionViewSet, basename='session')
router.register(r'availabilities', AvailabilityViewSet)
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),  # router-generated URLs
    path('register/', CustomUserRegistrationAPIView.as_view(), name='user-register'),
    path('tutors/', TutorListView.as_view(), name='tutor-list'),
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('profile/<str:username>/', UserProfileView.as_view(), name='user-profile-by-username'),
    path('tutors/search/', TutorSearchView.as_view(), name='tutor-search'),
    path('update-role/', UpdateRoleView.as_view(), name='update-role'),
    path('reviews/<int:tutor_id>/', TutorReviewsView.as_view(), name='tutor-reviews'),
    path('submit-review/', SubmitReviewView.as_view(), name='submit-review'),
    path('reviews/check/<int:session_id>/', CheckReviewExistsView.as_view(), name='check-review-exists'),
    path('reviews/reviewed-tutors/', ReviewedTutorsView.as_view(), name='reviewed-tutors'),
    path('set-availability/', AvailabilityUpdateView.as_view(), name='set-availability'),
    path('change-password/', PasswordChangeView.as_view(), name='change-password'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
