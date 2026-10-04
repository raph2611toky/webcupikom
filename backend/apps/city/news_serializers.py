from urllib.parse import urlsplit
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from django.urls import reverse
from rest_framework import serializers
from drf_yasg.utils import swagger_serializer_method
from .models import NewsArticle, MunicipalService


class AudienceGuidanceSerializer(serializers.Serializer):
    audience = serializers.CharField(max_length=120)
    instructions = serializers.CharField(max_length=5000, required=False, allow_blank=True)


class AudienceGuidanceListField(serializers.Field):
    """Liste JSON rétrocompatible pour le guidage par public.

    Les premières données de démonstration stockaient parfois simplement des
    chaînes. On les normalise à la lecture et à l'écriture afin qu'une ancienne
    ligne ne puisse plus faire tomber toute la sérialisation d'une publication.
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
        if data in (None, ""):
            return []
        if not isinstance(data, list):
            raise serializers.ValidationError("Une liste de publics est attendue.")
        if len(data) > 20:
            raise serializers.ValidationError("Maximum 20 publics.")

        normalized = []
        for index, item in enumerate(data):
            if isinstance(item, str):
                audience = item.strip()
                instructions = ""
            elif isinstance(item, dict):
                audience = str(item.get("audience", "") or "").strip()
                instructions = str(item.get("instructions", "") or "").strip()
            else:
                raise serializers.ValidationError(f"Élément {index + 1} invalide.")

            if not audience:
                raise serializers.ValidationError(f"Le public de l'élément {index + 1} est requis.")
            if len(audience) > 120:
                raise serializers.ValidationError(f"Le public de l'élément {index + 1} dépasse 120 caractères.")
            if len(instructions) > 5000:
                raise serializers.ValidationError(f"Les instructions de l'élément {index + 1} dépassent 5000 caractères.")
            normalized.append({"audience": audience, "instructions": instructions})
        return normalized


PUBLIC_FIELDS = ('id', 'title', 'slug', 'category', 'excerpt', 'content', 'publication_type', 'severity',
    'published_at', 'expires_at', 'updated_at', 'is_pinned', 'is_important', 'target_districts',
    'affected_areas', 'instructions', 'audience_guidance', 'source_name', 'source_url', 'contact_phone',
    'action_label', 'action_url', 'service', 'cover_alt', 'cover_url', 'publication_state')


class PublicationSerializer(serializers.ModelSerializer):
    cover_url = serializers.SerializerMethodField()
    publication_state = serializers.SerializerMethodField()
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
