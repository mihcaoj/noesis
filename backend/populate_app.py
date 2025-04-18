import os
import django
import random
import pytz
from datetime import timedelta, datetime, date, time
from django.utils import timezone

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'noesis.settings')
django.setup()

from django.contrib.auth import get_user_model
from core.models import (
    Role, CustomUser, Topic, TutorTopic,
    Language, TutorLanguage, Availability,
    Session, Review, Message, Notification
)
from django.db import transaction
from faker import Faker
from decimal import Decimal

fake = Faker()

# CONSTANTS
NUM_USERS = 40
NUM_TUTORS = 21
NUM_TOPICS = 15
NUM_LANGUAGES = 10
TIMEZONE = pytz.timezone('Europe/Zurich')

##### LISTS FOR GENERATING REALISTIC DATA #####
TOPIC_NAMES = [
    "Mathematics", "Spanish", "Singing", "English", "Piano",
    "Guitar", "Flute", "Violin", "Chemistry", "Programming",
    "French", "German", "Physics", "Biology", "History",
    "Art History", "Japanese", "Italian", "Chinese", "Saxophone",
    "Drums", "Trumpet", "Creative Writing", "Economics",
    "Psychology", "Sociology", "Cooking", "Computer Science"
]

LANGUAGE_NAMES = [
    "English", "French", "German", "Spanish", "Italian",
    "Portuguese", "Russian", "Chinese", "Japanese", "Arabic",
    "Hindi", "Dutch", "Swedish", "Norwegian", "Finnish"
]

BIO_TEMPLATES = [
    "Passionate about teaching {subject}. I have {years} years of experience and love helping students succeed.",
    "Graduated from {university} with a degree in {subject}. {years} years of tutoring experience.",
    "I believe learning should be enjoyable. Specializing in {subject} with a focus on making complex topics accessible.",
    "Former {profession} now dedicated to tutoring {subject}. I bring real-world experience to my lessons.",
    "PhD candidate at {university} researching {subject}. I enjoy breaking down complex ideas into simple concepts.",
    "Certified teacher with {years} years of classroom experience in {subject}. I tailor my approach to each student's learning style.",
    "I've helped over {number} students excel in {subject}. My teaching philosophy focuses on building confidence through understanding."
]

LESSON_DESCRIPTION_TEMPLATES = [
    "My {subject} lessons focus on {approach}. We'll work through concepts step-by-step, with plenty of practice problems.",
    "I structure my {subject} sessions to include theory, examples, and practical applications. Homework is provided between sessions.",
    "My teaching method for {subject} combines {method1} and {method2}. Sessions are interactive and tailored to your goals.",
    "I specialize in helping students overcome challenges with {subject}. We'll identify your weak points and strengthen them.",
    "My {subject} lessons are designed to build a strong foundation and then advance to more complex topics. Perfect for beginners and intermediate learners."
]

UNIVERSITIES = [
    "ETH Zurich", "University of Zurich", "EPFL", "University of Geneva",
    "University of Basel", "University of Bern", "University of Lausanne",
    "University of St. Gallen", "University of Fribourg", "University of Neuchâtel"
]

PROFESSIONS = [
    "teacher", "researcher", "professor", "industry professional", "consultant",
    "engineer", "scientist", "analyst", "programmer", "mathematician"
]

TEACHING_APPROACHES = [
    "problem-solving", "conceptual understanding", "practical applications",
    "visual learning", "interactive discussions", "structured practice"
]

TEACHING_METHODS = [
    "visual aids", "real-world examples", "systematic exercises",
    "mnemonic techniques", "guided discovery",
    "project-based learning", "gamification", "flipped classroom"
]

SESSION_NOTES_TEMPLATES = [
    "Would like to focus on {topic_aspect}. I'm preparing for an exam next month.",
    "Need help with {topic_aspect}. I'm struggling with the concepts.",
    "Looking forward to our session! I'd like to cover {topic_aspect} in detail.",
    "Could we review my recent homework on {topic_aspect}? I got stuck on a few problems.",
    "I have an essay due on {topic_aspect}. Would appreciate help with structure and arguments.",
    "I'm a beginner in {topic}. Please start with the basics.",
    "Advanced student looking to refine my skills in {topic_aspect}.",
    "Need help preparing for my {topic} presentation next week.",
    "Would like to practice conversational {topic} during our session.",
    "Having trouble with {topic_aspect} exercises in my textbook."
]

TOPIC_ASPECTS = {
    "Mathematics": ["calculus", "algebra", "trigonometry", "statistics", "geometry"],
    "Spanish": ["verb conjugation", "conversation practice", "grammar", "vocabulary", "writing"],
    "English": ["essay writing", "grammar", "literature analysis", "comprehension", "speaking"],
    "Chemistry": ["organic chemistry", "equations", "lab reports", "molecular structures", "periodic table"],
    "Programming": ["algorithms", "data structures", "debugging", "specific language syntax", "project planning"],
    "Physics": ["mechanics", "thermodynamics", "electromagnetism", "quantum physics", "problem-solving"],
    "Biology": ["cell biology", "genetics", "ecosystems", "human anatomy", "biochemistry"],
    "History": ["world wars", "ancient civilizations", "political movements", "specific time periods", "historical analysis"],
    "Economics": ["microeconomics", "macroeconomics", "market analysis", "economic policies", "financial concepts"]
}

DEFAULT_ASPECTS = ["fundamentals", "advanced concepts", "theory", "practical application", "exercises"]

MESSAGE_TEMPLATES = [
    # Initial contact
    "Hi, I'm interested in booking a session for {topic}. Are you available this week?",
    "Hello! I saw your profile and I think you could help me with {topic}. Do you have time to chat about it?",
    "I need help with {topic}, specifically {aspect}. What's your availability like?",

    # Replies
    "Yes, I'm available on {day} at {time}. Would that work for you?",
    "I'd be happy to help with {topic}! Could you tell me more about what you're struggling with?",
    "Thanks for reaching out. I specialize in {topic} and would be glad to assist. What's your goal for our sessions?",

    # Follow-ups
    "That time works perfectly. Looking forward to our session!",
    "Great! I'm specifically having trouble with {aspect}. Hope you can help me understand it better.",
    "I've booked our session. Should I prepare anything in advance?",
    "Could you recommend any resources I should look at before our session?",

    # Practical
    "Just checking if we're still on for tomorrow at {time}?",
    "Sorry, something came up. Can we reschedule our session to next {day}?",
    "I've uploaded some materials to review before our session. They should be in your dashboard.",
    "I might be 5 minutes late to our session today. Hope that's okay!",

    # Post-session
    "Thank you for today's session! It was really helpful.",
    "I'm still confused about {aspect}. Could we go over that again in our next session?",
    "The exercises you gave me were excellent. I feel like I'm making progress.",
    "Would you be available for a follow-up session next week?"
]

REVIEW_TEMPLATES = {
    5: [
        "Excellent tutor! {tutor_name} explained complex {topic} concepts clearly and with patience. I've improved significantly after just a few sessions!",
        "I'm extremely impressed with {tutor_name}'s teaching style. The {topic} lessons were engaging and tailored to my needs. Highly recommend!",
        "Best {topic} tutor I've had! {tutor_name} is knowledgeable, and makes learning very enjoyable. Will definitely book more sessions.",
        "{tutor_name} is an exceptional tutor. The structured approach to {topic} helped me understand concepts I've been struggling with for months.",
        "Amazing experience! {tutor_name} is passionate about {topic} and it shows in the quality of teaching. My grades have improved dramatically."
    ],
    4: [
        "Very good tutor. {tutor_name} is a class act and was helpful and knowledgeable about {topic}. The session was productive and I learned a lot.",
        "I enjoyed my {topic} session with {tutor_name}. Clear explanations and good teaching methods. Would book again!",
        "{tutor_name} is a solid {topic} tutor. Well-prepared and attentive to my learning needs. Just a few connection issues but overall great.",
        "Good experience learning {topic} with {tutor_name}. The session was well-structured and I gained new insights. Recommended.",
        "I'm pleased with {tutor_name}'s tutoring style. My understanding of {topic} has improved, though we did rush through some sections."
    ],
    3: [
        "Decent {topic} session with {tutor_name}. Some concepts were explained well while others could have used more clarity.",
        "{tutor_name} is knowledgeable about {topic}, but the teaching pace was a bit fast for me. Still helpful overall.",
        "Average experience. {tutor_name} knows {topic} well but could improve on his teaching methodology. Might try another session.",
        "The {topic} session was helpful. {tutor_name} answered my questions, though sometimes the explanations were too technical.",
        "{tutor_name} is punctual and prepared, but the session structure for {topic} could be better organized."
    ],
    2: [
        "The {topic} session with {tutor_name} was below expectations. Explanations were often confusing.",
        "{tutor_name} seemed knowledgeable but struggled to communicate {topic} concepts effectively. Disappointed.",
        "Not the best experience. {tutor_name} was often distracted during our {topic} session and didn't answer questions clearly.",
        "The tutoring style didn't work for me. {tutor_name}'s approach to {topic} was too disorganized.",
        "Expected more from the session. {tutor_name} wasn't well-prepared to teach {topic} at my level."
    ],
    1: [
        "Unfortunately, the {topic} session with {tutor_name} was not helpful at all. Very disappointed.",
        "Poor experience. {tutor_name} was late, unprepared, and couldn't answer basic {topic} questions.",
        "Would not recommend {tutor_name} for {topic}. The teaching approach was confusing and unhelpful.",
        "The session was a waste of time and money. {tutor_name} didn't seem to understand {topic} fundamentals.",
        "Very frustrated with this tutoring experience, {tutor_name} was unprofessional and the {topic} explanations turned out to be flat out incorrect."
    ]
}

@transaction.atomic
def create_roles():
    """Create default roles if they don't exist"""
    roles = []
    for role_name in ["Student", "Tutor"]:
        role, created = Role.objects.get_or_create(name=role_name)
        roles.append(role)
        if created:
            print(f"Created role: {role_name}")
    return roles

@transaction.atomic
def create_topics():
    """Create academic topics"""
    topics = []
    for i in range(min(NUM_TOPICS, len(TOPIC_NAMES))):
        topic_name = TOPIC_NAMES[i]
        topic, created = Topic.objects.get_or_create(
            name=topic_name,
            defaults={'description': fake.paragraph(nb_sentences=2)}
        )
        topics.append(topic)
        if created:
            print(f"Created topic: {topic_name}")
    return topics

@transaction.atomic
def create_languages():
    """Create languages for tutors"""
    languages = []
    for i in range(min(NUM_LANGUAGES, len(LANGUAGE_NAMES))):
        language_name = LANGUAGE_NAMES[i]
        language, created = Language.objects.get_or_create(name=language_name)
        languages.append(language)
        if created:
            print(f"Created language: {language_name}")
    return languages

def generate_username(first_name, last_name):
    """Generate a realistic username based on name"""
    formats = [
        f"{first_name.lower()}{last_name.lower()}",
        f"{first_name.lower()}.{last_name.lower()}",
        f"{first_name.lower()}_{last_name.lower()}",
        f"{first_name.lower()}{last_name[0].lower()}",
        f"{first_name[0].lower()}{last_name.lower()}"
    ]

    # Try username formats until finding a unique one
    for username_format in formats:
        username = username_format

        # add a random number to the username if needed
        if CustomUser.objects.filter(username=username).exists():
            username = f"{username}{random.randint(1, 999)}"

        if not CustomUser.objects.filter(username=username).exists():
            return username

    # Fallback to random if it fails
    return fake.user_name()

def generate_bio(topics):
    """Generate a realistic bio using templates"""
    template = random.choice(BIO_TEMPLATES)
    return template.format(
        subject=random.choice([t.name for t in topics]) if topics else "various subjects",
        years=random.randint(2, 15),
        university=random.choice(UNIVERSITIES),
        profession=random.choice(PROFESSIONS),
        number=random.randint(20, 150)
    )

def generate_lesson_description(topics):
    """Generate a realistic lesson description using templates"""
    template = random.choice(LESSON_DESCRIPTION_TEMPLATES)
    return template.format(
        subject=random.choice([t.name for t in topics]) if topics else "various subjects",
        approach=random.choice(TEACHING_APPROACHES),
        method1=random.choice(TEACHING_METHODS),
        method2=random.choice(TEACHING_METHODS)
    )

@transaction.atomic
def create_users(student_role, tutor_role, topics, languages):
    """Create users with different roles"""
    users = []
    tutors = []

    for i in range(NUM_USERS):
        first_name = fake.first_name()
        last_name = fake.last_name()
        username = generate_username(first_name, last_name)
        email = f"{first_name.lower()}.{last_name.lower()}@{fake.free_email_domain()}"

        # Create user
        user = CustomUser.objects.create_user(
            username=username,
            email=email,
            password="password123",
            first_name=first_name,
            last_name=last_name,
            bio=fake.paragraph(nb_sentences=3),
            location=fake.city()
        )

        # Add student role to all users
        user.roles.add(student_role)

        # Make some tutors
        is_tutor = i < NUM_TUTORS
        if is_tutor:
            user.roles.add(tutor_role)
            user.hourly_rate = Decimal(str(random.randint(20, 90)))
            user.preferred_mode = random.choice(['webcam', 'in-person', 'both'])

            # Add info for tutors
            user_topics = random.sample(topics, random.randint(1, 4))
            bio = generate_bio(user_topics)
            lesson_description = generate_lesson_description(user_topics)

            user.bio = bio
            user.lesson_description = lesson_description
            user.save()

            # Add topics to tutor
            for topic in user_topics:
                TutorTopic.objects.create(tutor=user, topic=topic)

            # Add languages to tutor
            user_languages = random.sample(languages, random.randint(1, 3))
            for language in user_languages:
                TutorLanguage.objects.create(tutor=user, language=language)

            # Add to tutors list
            tutors.append(user)

        users.append(user)
        print(f"Created user: {username} (Tutor: {is_tutor})")

    return users, tutors

@transaction.atomic
def create_availabilities(tutors):
    """Create availability slots for tutors"""
    availabilities = []
    today = timezone.now().date()

    for tutor in tutors:
        # Create 5-10 availability slots per tutor over the next 30 days
        for _ in range(random.randint(5, 10)):
            future_date = today + timedelta(days=random.randint(1, 30))

            # Generate random start time between 08:00 and 18:00
            hour = random.randint(8, 18)
            start_time = time(hour, 0)

            # Duration between 1-3 hours
            duration = random.randint(1, 3)
            end_time = time(hour + duration, 0)

            # Some availabilities are recurring
            recurring = random.choice([True, False])

            # Check if availability already exists to avoid duplicate key error
            existing = Availability.objects.filter(
                tutor=tutor,
                available_date=future_date,
                available_time_start=start_time
            ).exists()

            if not existing:
                try:
                    availability = Availability.objects.create(
                        tutor=tutor,
                        available_date=future_date,
                        available_time_start=start_time,
                        available_time_end=end_time,
                        recurring=recurring
                    )
                    availabilities.append(availability)
                except Exception as e:
                    print(f"Could not create availability: {e}")
            else:
                print(f"Skipping duplicate availability for {tutor.username} on {future_date} at {start_time}")

    print(f"Created {len(availabilities)} availability slots")
    return availabilities

@transaction.atomic
def create_sessions(users, tutors):
    """Create tutoring sessions between users and tutors"""
    sessions = []
    reviews_created = 0

    # Get students
    students = [user for user in users if "Student" in [role.name for role in user.roles.all()]]

    # Create ~3-5 sessions per tutor with different statuses
    for tutor in tutors:
        # Get tutor's availabilities
        tutor_availabilities = Availability.objects.filter(tutor=tutor)
        if not tutor_availabilities:
            continue

        # Get topics this tutor teaches
        tutor_topics = [tt.topic.name for tt in TutorTopic.objects.filter(tutor=tutor)]
        if not tutor_topics:
            tutor_topics = ["General Tutoring"]

        for _ in range(random.randint(2, 4)):
            # Choose a student different from the tutor
            student = random.choice([s for s in students if s != tutor])

            # Create a past session (1-30 days ago)
            days_ago = random.randint(1, 30)
            past_date = timezone.now() - timedelta(days=days_ago)

            # Force minutes to be exactly 00 or 30
            minute_options = [0, 30]
            fixed_minute = random.choice(minute_options)
            past_date = past_date.replace(minute=fixed_minute, second=0, microsecond=0)

            # Duration in 30-minute increments
            possible_durations = [60, 90, 120, 150, 180]
            duration_minutes = random.choice(possible_durations)
            duration = timedelta(minutes=duration_minutes)

            # Choose a topic
            topic = random.choice(tutor_topics)

            try:
                # Create session directly in the database, bypassing validation
                from django.db import connection
                with connection.cursor() as cursor:
                    cursor.execute("""
                    INSERT INTO core_session
                    (tutor_id, student_id, date_time, duration, topic, mode, status, notes, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """, [
                        tutor.id,
                        student.id,
                        past_date,
                        duration,
                        topic,
                        random.choice(['webcam', 'in-person']),
                        'completed',
                        fake.paragraph(nb_sentences=1) if random.choice([True, False]) else "",
                        timezone.now(),
                        timezone.now()
                    ])

                    session_id = cursor.fetchone()[0]

                # Fetch the created session
                session = Session.objects.get(id=session_id)
                sessions.append(session)

                # Create a review
                rating_weights = [1, 1, 2, 3, 4]
                rating_choices = [1, 2, 3, 4, 5]
                rating = random.choices(rating_choices, weights=rating_weights, k=1)[0]

                review_template = random.choice(REVIEW_TEMPLATES[rating])
                comment = review_template.format(tutor_name=tutor.username, topic=topic)

                Review.objects.create(
                    session=session,
                    rating=rating,
                    comment=comment
                )

                reviews_created += 1

            except Exception as e:
                print(f"Error creating past session/review for {tutor.username}: {str(e)}")

        # Create future sessions (pending, confirmed, etc.)
        for _ in range(random.randint(2, 5)):
            # Choose a student different from the tutor
            student = random.choice([s for s in students if s != tutor])

            # Create a future session date (1-30 days in the future)
            future_days = random.randint(1, 30)
            session_date = timezone.now().date() + timedelta(days=future_days)

            # Choose a time that's exactly 00 or 30
            minute_options = [0, 30]
            session_hour = random.randint(9, 17)
            session_minute = random.choice(minute_options)

            # Create the full session datetime
            session_datetime = timezone.make_aware(
                datetime(
                    session_date.year,
                    session_date.month,
                    session_date.day,
                    session_hour,
                    session_minute
                ),
                TIMEZONE
            )

            # Duration must be in 30-minute increments
            possible_durations = [60, 90, 120, 150, 180]
            duration_minutes = random.choice(possible_durations)
            duration = timedelta(minutes=duration_minutes)

            topic = random.choice(tutor_topics)

            # Different probabilities for different statuses
            status_choices = ['pending', 'confirmed', 'rejected', 'reschedule_pending']
            status_weights = [0.4, 0.4, 0.1, 0.1]
            status = random.choices(status_choices, weights=status_weights, k=1)[0]

            try:
                # Create future session directly in the database, bypassing validation
                from django.db import connection
                with connection.cursor() as cursor:
                    cursor.execute("""
                    INSERT INTO core_session
                    (tutor_id, student_id, date_time, duration, topic, mode, status, notes, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                    """, [
                        tutor.id,
                        student.id,
                        session_datetime,
                        duration,
                        topic,
                        random.choice(['webcam', 'in-person']),
                        status,
                        generate_session_notes(topic),
                        timezone.now(),
                        timezone.now()
                    ])

                    session_id = cursor.fetchone()[0]

                # Fetch the created session
                session = Session.objects.get(id=session_id)
                sessions.append(session)

                # Add reschedule information for reschedule_pending status
                if status == 'reschedule_pending':
                    reschedule_days = random.randint(1, 14)
                    new_date = session_datetime + timedelta(days=reschedule_days)

                    # Add the reschedule request to notes
                    notes = session.notes or ""
                    session.notes = f"{notes}\n[RESCHEDULE_REQUEST]{new_date.isoformat()}".strip()

                    # Update directly in DB
                    with connection.cursor() as cursor:
                        cursor.execute("""
                        UPDATE core_session SET notes = %s WHERE id = %s
                        """, [
                            session.notes,
                            session.id
                        ])

                print(f"Created future session: {tutor.username} with {student.username} on {session_datetime} ({status})")

            except Exception as e:
                print(f"Could not create future session: {e}")

    for tutor in tutors:
        tutor.update_rating()

    print(f"Created {len(sessions)} sessions and {reviews_created} reviews")
    return sessions

def generate_session_notes(topic):
    """Generate realistic session notes based on the topic"""
    if not topic or topic == "General Tutoring":
        return ""

    # 40% chance of having notes
    if random.random() > 0.4:
        return ""

    template = random.choice(SESSION_NOTES_TEMPLATES)

    # Get topic-specific aspects or use defaults
    aspects = TOPIC_ASPECTS.get(topic, DEFAULT_ASPECTS)
    topic_aspect = random.choice(aspects)

    return template.format(topic=topic, topic_aspect=topic_aspect)

@transaction.atomic
def create_messages(users):
    """Create message exchanges between users"""
    messages = []
    conversations = []

    tutors = [user for user in users if "Tutor" in [role.name for role in user.roles.all()]]
    students = [user for user in users if "Student" in [role.name for role in user.roles.all()]]

    for _ in range(min(15, len(tutors))):
        tutor = random.choice(tutors)
        student = random.choice([s for s in students if s != tutor])
        tutor_topics = [tt.topic.name for tt in TutorTopic.objects.filter(tutor=tutor)] or ["General Tutoring"]
        topic = random.choice(tutor_topics)

        # Get topic aspects
        aspects = TOPIC_ASPECTS.get(topic, DEFAULT_ASPECTS)
        aspect = random.choice(aspects)

        # Generate a short conversation thread
        message_count = random.randint(3, 8)
        conversation_messages = []

        # Initial message from student to tutor
        initial_template = random.choice(MESSAGE_TEMPLATES[:3])
        initial_message = Message.objects.create(
            sender=student,
            receiver=tutor,
            message=initial_template.format(topic=topic, aspect=aspect),
            is_read=True
        )
        conversation_messages.append(initial_message)

        # Create replies
        last_sender = student
        day = random.choice(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
        time = f"{random.randint(8, 20)}:{random.choice(['00', '30'])}"

        for i in range(1, message_count):
            sender = tutor if last_sender == student else student
            last_sender = sender

            # Select template based on position in conversation
            if i == 1:
                template_idx = random.randint(3, 5)
            elif i == message_count - 1:
                template_idx = random.randint(15, 18)
            else:
                template_idx = random.randint(6, 14)

            template = MESSAGE_TEMPLATES[min(template_idx, len(MESSAGE_TEMPLATES)-1)]
            message_text = template.format(topic=topic, aspect=aspect, day=day, time=time)

            message = Message.objects.create(
                sender=sender,
                receiver=tutor if sender == student else student,
                message=message_text,
                is_read=random.random() > 0.3  # 70% chance of being read
            )
            conversation_messages.append(message)
            messages.extend(conversation_messages)

        conversations.append(conversation_messages)

    print(f"Created {len(messages)} messages in {len(conversations)} conversations")
    return messages

def main():
    print("Starting data population...")

    roles = create_roles()
    student_role = next((role for role in roles if role.name == "Student"), None)
    tutor_role = next((role for role in roles if role.name == "Tutor"), None)
    topics = create_topics()
    languages = create_languages()

    # Create users and their relationships
    users, tutors = create_users(student_role, tutor_role, topics, languages)

    # Create availabilities for tutors
    availabilities = create_availabilities(tutors)

    # Create sessions between students and tutors
    sessions = create_sessions(users, tutors)

    # Create messages between users
    messages = create_messages(users)

    print("\nData population completed successfully!")
    print(f"Created {len(users)} users ({len(tutors)} tutors)")
    print(f"Created {len(topics)} topics")
    print(f"Created {len(languages)} languages")
    print(f"Created {len(availabilities)} availability slots")
    print(f"Created {len(sessions)} sessions")
    print(f"Created {Review.objects.count()} reviews")
    print(f"Created {len(messages)} messages")
    print(f"Created {Notification.objects.count()} notifications")

if __name__ == "__main__":
    main()
