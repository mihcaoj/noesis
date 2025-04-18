from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import *

"""
Custom admin configuration for the User model with enhanced display options & role management.
"""
class CustomUserAdmin(UserAdmin):
    # Fields to display in the admin panel's user list view
    list_display = ('username', 'email', 'first_name', 'last_name', 'get_roles',
                   'is_online', 'last_active', 'hourly_rate', 'average_rating',
                   'total_ratings', 'is_active')

    # Allow clicking on username or email to edit the user
    list_display_links = ('username', 'email')

    # Fields to filter by in the admin panel
    list_filter = ('roles', 'is_online', 'preferred_mode', 'is_staff', 'is_superuser', 'is_active', 'date_joined')

    # Fields to search for in the admin panel
    search_fields = ('username', 'email', 'first_name', 'last_name', 'location')

    # Add date hierarchy for quick date-based navigation
    date_hierarchy = 'date_joined'

    # Order by username in the admin panel
    ordering = ('username',)

    # Enable horizontal filter for roles
    filter_horizontal = ('roles', 'groups', 'user_permissions')

    # Fields to display on the user detail/edit page, grouped in collapsible sections
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'email')}),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
        ('Profile Information', {
            'fields': ('roles', 'profile_picture', 'bio', 'location'),
            'classes': ('collapse',),
        }),
        ('Tutor Settings', {
            'fields': ('preferred_mode', 'lesson_description', 'hourly_rate'),
            'classes': ('collapse',),
        }),
        ('Status', {
            'fields': ('is_online', 'last_active', 'average_rating', 'total_ratings'),
        }),
    )

    # Fields to display when creating a new user
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'password1', 'password2'),
        }),
        ('Profile Information', {
            'fields': ('roles', 'first_name', 'last_name', 'profile_picture', 'bio', 'location'),
        }),
        ('Tutor Settings', {
            'fields': ('preferred_mode', 'lesson_description', 'hourly_rate'),
        }),
    )

    # Add custom admin actions
    actions = ['add_tutor_role', 'add_student_role']

    def get_queryset(self, request):
        queryset = CustomUser.objects.all()
        return queryset

    def get_roles(self, obj):
        return ", ".join([role.name for role in obj.roles.all()])
    get_roles.short_description = 'Roles'

    def add_tutor_role(self, request, queryset):
        tutor_role, _ = Role.objects.get_or_create(name='Tutor')
        for user in queryset:
            user.roles.add(tutor_role)
    add_tutor_role.short_description = "Add Tutor role to selected users"

    def add_student_role(self, request, queryset):
        student_role, _ = Role.objects.get_or_create(name='Student')
        for user in queryset:
            user.roles.add(student_role)
    add_student_role.short_description = "Add Student role to selected users"

admin.site.register(CustomUser, CustomUserAdmin)

class ReviewAdmin(admin.ModelAdmin):
    list_display = ('id', 'session', 'rating', 'created_at')
    list_filter = ('rating', 'created_at')
    search_fields = ('comment', 'session__student__username', 'session__tutor__username')

admin.site.register(Review, ReviewAdmin)

class SessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'tutor', 'student', 'date_time', 'status', 'topic')
    list_filter = ('status', 'mode', 'date_time')
    search_fields = ('tutor__username', 'student__username', 'topic')
    date_hierarchy = 'date_time'

admin.site.register(Session, SessionAdmin)

class MessageAdmin(admin.ModelAdmin):
    list_display = ('sender', 'receiver', 'timestamp', 'is_read')
    list_filter = ('is_read', 'timestamp')
    search_fields = ('message', 'sender__username', 'receiver__username')

admin.site.register(Message, MessageAdmin)

admin.site.register(Role)
admin.site.register(Topic)
admin.site.register(TutorTopic)
admin.site.register(Language)
admin.site.register(TutorLanguage)
admin.site.register(Availability)
admin.site.register(Notification)
