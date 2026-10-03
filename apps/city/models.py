import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


def make_reference(prefix):
    return f"{prefix}-{timezone.now():%Y}-{uuid.uuid4().hex[:8].upper()}"


class MunicipalService(models.Model):
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True)
    category = models.CharField(max_length=100, blank=True)
    short_description = models.CharField(max_length=280)
    description = models.TextField(blank=True)
    opening_hours = models.CharField(max_length=160, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    actions = models.JSONField(default=list, blank=True)
    required_documents = models.JSONField(default=list, blank=True)
    faq = models.JSONField(default=list, blank=True)
    translations = models.JSONField(default=dict, blank=True)
    is_featured = models.BooleanField(default=False)
    priority_order = models.PositiveIntegerField(default=0)
    usage_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("sort_order", "name")
        verbose_name = "service municipal"
        verbose_name_plural = "services municipaux"

    def __str__(self):
        return self.name


class NewsArticle(models.Model):
    title = models.CharField(max_length=220)
    slug = models.SlugField(max_length=240, unique=True)
    category = models.CharField(max_length=100, blank=True)
    excerpt = models.CharField(max_length=320, blank=True)
    content = models.TextField()
    is_published = models.BooleanField(default=True)
    published_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-published_at",)
        verbose_name = "actualité"
        verbose_name_plural = "actualités"

    def __str__(self):
        return self.title


class ContactMessage(models.Model):
    class Status(models.TextChoices):
        RECEIVED = "received", "Reçu"
        READ = "read", "Lu"
        CLOSED = "closed", "Clôturé"

    reference = models.CharField(max_length=32, unique=True, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="contact_messages",
    )
    name = models.CharField(max_length=160)
    email = models.EmailField()
    service = models.ForeignKey(
        MunicipalService,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="contact_messages",
    )
    subject = models.CharField(max_length=220)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RECEIVED)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_contact_messages",
    )
    read_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "message citoyen"
        verbose_name_plural = "messages citoyens"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = make_reference("NT-C")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference} — {self.subject}"


class CitizenRequest(models.Model):
    class RequestType(models.TextChoices):
        PROCEDURE = "procedure", "Démarche"
        REPORT = "report", "Signalement"

    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Envoyée"
        PENDING = "pending", "À traiter"
        IN_PROGRESS = "in_progress", "En traitement"
        ACTION_REQUIRED = "action_required", "Action requise"
        COMPLETED = "completed", "Terminée"

    class Priority(models.TextChoices):
        LOW = "low", "Basse"
        NORMAL = "normal", "Normale"
        HIGH = "high", "Haute"
        URGENT = "urgent", "Urgente"

    reference = models.CharField(max_length=32, unique=True, editable=False)
    citizen = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="citizen_requests",
    )
    service = models.ForeignKey(
        MunicipalService,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="citizen_requests",
    )
    request_type = models.CharField(
        max_length=20, choices=RequestType.choices, default=RequestType.PROCEDURE
    )
    incident_category = models.CharField(max_length=100, blank=True)
    title = models.CharField(max_length=220)
    description = models.TextField()
    location_text = models.CharField(max_length=255, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING)
    priority = models.CharField(max_length=12, choices=Priority.choices, default=Priority.NORMAL)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_citizen_requests",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at", "-created_at")
        verbose_name = "demande citoyenne"
        verbose_name_plural = "demandes citoyennes"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = make_reference("NT-R")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference} — {self.title}"


class CitizenPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="city_preference",
    )
    screen_reader_mode = models.BooleanField(default=False)
    high_contrast = models.BooleanField(default=False)
    font_scale = models.PositiveSmallIntegerField(default=100)
    onboarding_step = models.CharField(max_length=32, default="welcome")
    onboarding_completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "préférence citoyenne"
        verbose_name_plural = "préférences citoyennes"

    def __str__(self):
        return f"Préférences — {self.user_id}"


class CitizenRequestEvent(models.Model):
    class EventType(models.TextChoices):
        CREATED = "created", "Création"
        STATUS = "status", "Changement de statut"
        NOTE = "note", "Étape / note"

    request = models.ForeignKey(
        CitizenRequest,
        on_delete=models.CASCADE,
        related_name="timeline_events",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="citizen_request_events",
    )
    event_type = models.CharField(max_length=20, choices=EventType.choices, default=EventType.NOTE)
    status = models.CharField(max_length=24, choices=CitizenRequest.Status.choices, blank=True)
    title = models.CharField(max_length=220)
    message = models.TextField(blank=True)
    is_public = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "id")
        verbose_name = "étape de demande citoyenne"
        verbose_name_plural = "étapes de demandes citoyennes"

    def __str__(self):
        return f"{self.request.reference} — {self.title}"


class CitizenAppointment(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "requested", "Demandé"
        CONFIRMED = "confirmed", "Confirmé"
        DECLINED = "declined", "Refusé"
        CANCELLED = "cancelled", "Annulé"
        COMPLETED = "completed", "Terminé"

    reference = models.CharField(max_length=32, unique=True, editable=False)
    citizen = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="citizen_appointments",
    )
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="agent_appointments",
    )
    service = models.ForeignKey(
        MunicipalService,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="appointments",
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    reason = models.CharField(max_length=220)
    details = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    preparation_instructions = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.REQUESTED,
    )
    reminder_enabled = models.BooleanField(default=True)
    reminder_minutes_before = models.PositiveIntegerField(default=60)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("starts_at", "id")
        verbose_name = "rendez-vous citoyen"
        verbose_name_plural = "rendez-vous citoyens"
        indexes = [
            models.Index(fields=("agent", "starts_at"), name="city_appt_agent_start_idx"),
            models.Index(fields=("citizen", "starts_at"), name="city_appt_cit_start_idx"),
        ]

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = make_reference("NT-A")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference} — {self.citizen_id} / {self.agent_id}"


class CitizenNotification(models.Model):
    class Kind(models.TextChoices):
        REQUEST = "request", "Demande"
        CONTACT = "contact", "Contact"
        NEWS = "news", "Actualité"
        APPOINTMENT = "appointment", "Rendez-vous"
        SYSTEM = "system", "Système"

    class Scope(models.TextChoices):
        GLOBAL = "global", "Globale"
        TARGETED = "targeted", "Ciblée"
        AUTOMATED = "automated", "Automatique"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="city_notifications",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_city_notifications",
    )
    scope = models.CharField(
        max_length=20,
        choices=Scope.choices,
        default=Scope.AUTOMATED,
    )
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.SYSTEM)
    title = models.CharField(max_length=220)
    message = models.TextField(blank=True)
    action_label = models.CharField(max_length=120, blank=True)
    action_url = models.CharField(max_length=500, blank=True)
    notification_code = models.CharField(max_length=80, blank=True, db_index=True)
    visible_from = models.DateTimeField(default=timezone.now, db_index=True)
    related_request = models.ForeignKey(
        CitizenRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )
    related_contact = models.ForeignKey(
        ContactMessage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )
    related_appointment = models.ForeignKey(
        CitizenAppointment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="notifications",
    )
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "notification citoyenne"
        verbose_name_plural = "notifications citoyennes"

    def __str__(self):
        return f"{self.user_id} — {self.title}"


class WebCupRequestSnapshot(models.Model):
    external_id = models.PositiveIntegerField(null=True, blank=True)
    request_code = models.CharField(max_length=32, unique=True)
    requester_name = models.CharField(max_length=220, blank=True)
    requester_type = models.CharField(max_length=100, blank=True)
    message_public = models.TextField(blank=True)
    difficulty = models.CharField(max_length=50, blank=True)
    difficulty_level = models.PositiveSmallIntegerField(default=0)
    xp_base = models.IntegerField(default=0)
    xp_time_bonus = models.IntegerField(default=0)
    xp_total = models.IntegerField(default=0)
    xp_available = models.IntegerField(default=0)
    is_ai_related = models.BooleanField(default=False)
    arrival_type = models.CharField(max_length=50, blank=True)
    wave_number = models.IntegerField(null=True, blank=True)
    arrival_time = models.CharField(max_length=100, blank=True)
    group_name = models.CharField(max_length=120, blank=True)
    sort_order = models.IntegerField(default=0)
    is_initial = models.BooleanField(default=False)
    is_ai_request = models.BooleanField(default=False)
    visible_since_wave = models.IntegerField(default=0)
    is_visible = models.BooleanField(default=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    first_seen_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("sort_order", "external_id", "request_code")
        verbose_name = "demande WebCup"
        verbose_name_plural = "demandes WebCup"

    def __str__(self):
        return self.request_code


class WebCupSyncState(models.Model):
    key = models.CharField(max_length=32, primary_key=True, default="requests", editable=False)
    api_version = models.CharField(max_length=32, blank=True)
    session = models.JSONField(default=dict, blank=True)
    last_success_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "état de synchronisation WebCup"
        verbose_name_plural = "états de synchronisation WebCup"

    def __str__(self):
        return self.key
