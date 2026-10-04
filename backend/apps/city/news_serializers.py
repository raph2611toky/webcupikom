from urllib.parse import urlsplit
import re
import unicodedata
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from django.urls import reverse
from rest_framework import serializers
from drf_yasg.utils import swagger_serializer_method
from .models import NewsArticle, MunicipalService


class AudienceGuidanceSerializer(serializers.Serializer):
    audience = serializers.CharField(max_length=120)
    instructions = serializers.CharField(max_length=5000)


class AudienceGuidanceListField(serializers.Field):
    """Liste JSON rétrocompatible pour le guidage par public.

    Les premières données de démonstration stockaient parfois simplement des
    chaînes. On les normalise uniquement à la lecture afin qu'une ancienne ligne
    ne fasse pas tomber la sérialisation. Les écritures API restent strictes.
    """

    def to_representation(self, value):
        normalized = []
        for item in value or []:
            if isinstance(item, str):
                audience = item.strip()
                if audience:
                    normalized.append({"audience": audience, "instructions": ""})
                continue
            if isinstance(item, dict):
                audience = str(item.get("audience", "") or "").strip()[:120]
                instructions = str(item.get("instructions", "") or "").strip()[:5000]
                if audience:
                    normalized.append({"audience": audience, "instructions": instructions})
        return normalized

    def to_internal_value(self, data):
        # IMPORTANT : la rétrocompatibilité ne concerne que la LECTURE.
        # Les écritures API restent strictes afin de ne jamais stocker de
        # nouvelles valeurs legacy (chaînes seules, instructions absentes, etc.).
        if not isinstance(data, list):
            raise serializers.ValidationError("Une liste de publics est attendue.")
        if len(data) > 20:
            raise serializers.ValidationError("Maximum 20 publics.")

        nested = AudienceGuidanceSerializer(data=data, many=True)
        nested.is_valid(raise_exception=True)
        return list(nested.validated_data)


SPACE_WEATHER_CATEGORY_ALIASES = {
    "space_weather",
    "solar_storm",
    "tempete_solaire",
    "alerte_spatiale",
    "meteo_spatiale",
}


def normalize_publication_category(value):
    """Normalise une catégorie libre sans modifier la valeur stockée en base."""
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(char for char in text if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "_", text.casefold()).strip("_")


def is_space_weather_category(value):
    return normalize_publication_category(value) in SPACE_WEATHER_CATEGORY_ALIASES


PUBLIC_FIELDS = ('id', 'title', 'slug', 'category', 'excerpt', 'content', 'publication_type', 'crisis_type', 'severity',
    'published_at', 'expires_at', 'updated_at', 'is_pinned', 'is_important', 'target_districts',
    'affected_areas', 'instructions', 'audience_guidance', 'source_name', 'source_url', 'contact_phone',
    'action_label', 'action_url', 'service', 'cover_alt', 'cover_url', 'publication_state')


class PublicationSerializer(serializers.ModelSerializer):
    cover_url = serializers.SerializerMethodField()
    publication_state = serializers.SerializerMethodField()
    crisis_type = serializers.SerializerMethodField()
    audience_guidance = AudienceGuidanceListField(read_only=True)

    class Meta:
        model = NewsArticle
        fields = PUBLIC_FIELDS

    def get_cover_url(self, obj) -> str:
        if not obj.cover_image:
            return ''
        url = reverse('city:news-cover', kwargs={'slug': obj.slug})
        request = self.context.get('request')
        return request.build_absolute_uri(url) if request else url

    def get_publication_state(self, obj) -> str:
        if not obj.is_published:
            return 'draft'
        if obj.expires_at and obj.expires_at <= timezone.now():
            return 'expired'
        return 'scheduled' if obj.published_at > timezone.now() else 'published'

    def get_crisis_type(self, obj):
        # F104 : indicateur uniquement dérivé des données existantes. Aucun
        # nouveau modèle ni nouvelle branche de diffusion n'est introduit.
        if obj.publication_type == 'alert' and is_space_weather_category(obj.category):
            return 'space_weather'
        return None


class PublicationAdminSerializer(PublicationSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True, max_length=240)
    is_published = serializers.BooleanField(default=False)
    notify_residents = serializers.BooleanField(default=True)
    target_districts = serializers.ListField(child=serializers.CharField(max_length=120), max_length=50, required=False)
    audience_guidance = AudienceGuidanceListField(required=False)
    service = serializers.PrimaryKeyRelatedField(queryset=MunicipalService.objects.filter(is_active=True), allow_null=True, required=False)

    class Meta:
        model = NewsArticle
        fields = PUBLIC_FIELDS + ('is_published', 'notify_residents', 'created_at', 'author', 'delivery_started_at', 'delivery_completed_at')
        read_only_fields = ('id', 'created_at', 'updated_at', 'author', 'delivery_started_at', 'delivery_completed_at')

    def get_cover_url(self, obj) -> str:
        if not obj.cover_image:
            return ''
        url = reverse('city:admin-news-cover', kwargs={'slug': obj.slug})
        request = self.context.get('request')
        return request.build_absolute_uri(url) if request else url

    def validate(self, attrs):
        get = lambda key, default=None: attrs.get(key, getattr(self.instance, key, default))

        # F104 — tempête solaire / météo spatiale. On réutilise strictement le
        # pipeline d'alerte existant (broadcast + email) au lieu d'en créer un
        # second. Les valeurs sûres sont proposées par défaut à la création,
        # mais une publication explicitement incohérente est refusée.
        if is_space_weather_category(get('category', '')):
            if self.instance is None:
                attrs.setdefault('publication_type', 'alert')
                attrs.setdefault('severity', 'critical')
                attrs.setdefault('is_important', True)
                attrs.setdefault('is_pinned', True)
                attrs.setdefault('notify_residents', True)

            get = lambda key, default=None: attrs.get(key, getattr(self.instance, key, default))
            if get('is_published', False):
                errors = {}
                if get('publication_type', 'news') != 'alert':
                    errors['publication_type'] = 'Une alerte spatiale publiée doit utiliser le type alert.'
                if get('severity', 'info') != 'critical':
                    errors['severity'] = 'Une alerte spatiale publiée doit être critique.'
                if not get('is_important', False):
                    errors['is_important'] = 'Une alerte spatiale publiée doit rester importante.'
                if not get('is_pinned', False):
                    errors['is_pinned'] = 'Une alerte spatiale publiée doit rester mise en avant.'
                if not get('notify_residents', True):
                    errors['notify_residents'] = 'F104 exige la diffusion aux habitants.'
                if errors:
                    raise serializers.ValidationError(errors)
        for field, maximum in (('content', 100000), ('instructions', 20000), ('affected_areas', 5000)):
            if len(get(field, '') or '') > maximum:
                raise serializers.ValidationError({field: f'Maximum {maximum} caractères.'})
        if len(get('audience_guidance', []) or []) > 20:
            raise serializers.ValidationError({'audience_guidance': 'Maximum 20 publics.'})
        published = get('published_at') or timezone.now()
        expires = get('expires_at')
        if expires and expires <= published:
            raise serializers.ValidationError({'expires_at': 'La fin doit être postérieure à la publication.'})
        if get('publication_type', 'news') == 'alert' and get('is_published', False):
            missing = [f for f in ('instructions', 'affected_areas', 'source_name') if not str(get(f, '')).strip()]
            if not expires:
                missing.append('expires_at')
            if missing:
                raise serializers.ValidationError({f: 'Requis pour publier une alerte.' for f in missing})
        for field in ('source_url', 'action_url'):
            value = get(field, '')
            if value and (urlsplit(value).scheme != 'https' or urlsplit(value).username or urlsplit(value).password):
                raise serializers.ValidationError({field: 'Utilisez une URL HTTPS sans identifiants.'})
        if bool(get('action_label', '')) != bool(get('action_url', '')):
            raise serializers.ValidationError({'action_url': 'Le libellé et le lien doivent être renseignés ensemble.'})
        if self.instance and self.instance.delivery_started_at:
            for field in ('slug', 'target_districts', 'published_at', 'notify_residents'):
                if field in attrs and attrs[field] != getattr(self.instance, field):
                    raise serializers.ValidationError({field: 'Diffusion commencée : créer une nouvelle publication pour modifier ce champ.'})
        if 'target_districts' in attrs:
            attrs['target_districts'] = list(dict.fromkeys(v.strip().casefold() for v in attrs['target_districts']))
        if 'slug' in attrs and not attrs['slug']:
            attrs.pop('slug')
        if attrs.get('slug'):
            qs = NewsArticle.objects.filter(slug=attrs['slug'])
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({'slug': 'Ce slug est déjà utilisé.'})
        return attrs

    def create(self, validated_data):
        if not validated_data.get('slug'):
            import uuid
            validated_data['slug'] = (slugify(validated_data['title'])[:220] or 'publication') + '-' + uuid.uuid4().hex[:12]
        return super().create(validated_data)


class NewsFilterSerializer(serializers.Serializer):
    category = serializers.CharField(required=False, max_length=100)
    search = serializers.CharField(required=False, max_length=200)
    district = serializers.CharField(required=False, max_length=120)
    publication_type = serializers.ChoiceField(choices=['news', 'announcement', 'alert'], required=False)
    severity = serializers.ChoiceField(choices=['info', 'warning', 'critical'], required=False)
    important = serializers.BooleanField(required=False)
    published = serializers.BooleanField(required=False)
    state = serializers.ChoiceField(choices=['draft', 'scheduled', 'published', 'expired'], required=False)


class NewsCoverUploadSerializer(serializers.Serializer):
    from .report_serializers import NormalizedImageField
    image = NormalizedImageField()
    cover_alt = serializers.CharField(max_length=300)


class NewsDeliveryStatusSerializer(serializers.Serializer):
    started_at = serializers.DateTimeField(allow_null=True)
    completed_at = serializers.DateTimeField(allow_null=True)
    recipients = serializers.IntegerField()
    read = serializers.IntegerField()
    emails_sent = serializers.IntegerField()
    emails_pending = serializers.IntegerField()
    emails_failed = serializers.IntegerField()
