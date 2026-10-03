import re
from django.urls import reverse
from django.utils import timezone
from rest_framework import serializers
from .models import CitizenRequestAttachment
from .services.reports import normalize_image, MAX_UPLOAD_IMAGES


class NormalizedImageField(serializers.FileField):
    def to_internal_value(self, data):
        return normalize_image(super().to_internal_value(data))


class ImageUploadMixin(serializers.Serializer):
    images = serializers.ListField(child=NormalizedImageField(), max_length=MAX_UPLOAD_IMAGES,
                                   required=False, write_only=True, allow_empty=False)
    image = NormalizedImageField(required=False, write_only=True)
    image_captions = serializers.ListField(child=serializers.CharField(max_length=300, allow_blank=True),
                                         max_length=MAX_UPLOAD_IMAGES, required=False, write_only=True)

    def validate_images_payload(self, attrs):
        if attrs.get('image') and attrs.get('images'):
            raise serializers.ValidationError('Utilisez image ou images, pas les deux.')
        if attrs.get('image'):
            attrs['images'] = [attrs.pop('image')]
        if attrs.get('image_captions') and len(attrs['image_captions']) != len(attrs.get('images', [])):
            raise serializers.ValidationError({'image_captions': 'Une légende par image est requise.'})
        return attrs


class RequestAttachmentSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()
    uploader_name = serializers.SerializerMethodField()

    class Meta:
        model = CitizenRequestAttachment
        fields = ('id', 'caption', 'original_name', 'content_type', 'width', 'height', 'size_bytes',
                  'sha256', 'event', 'is_public', 'uploader_name', 'created_at', 'download_url')
        read_only_fields = fields

    def get_download_url(self, obj):
        url = reverse('city:report-image-download', kwargs={'pk': obj.pk})
        request = self.context.get('request')
        return request.build_absolute_uri(url) if request else url

    def get_uploader_name(self, obj):
        if not obj.uploader:
            return None
        return obj.uploader.get_full_name().strip() or 'Utilisateur'


class AttachmentUploadSerializer(ImageUploadMixin):
    is_public = serializers.BooleanField(default=True)

    def validate(self, attrs):
        attrs = self.validate_images_payload(attrs)
        if not attrs.get('images'):
            raise serializers.ValidationError({'images': 'Au moins une image est requise.'})
        return attrs


class AttachmentCaptionSerializer(serializers.Serializer):
    caption = serializers.CharField(max_length=300, allow_blank=True)


class CitizenReportMessageSerializer(ImageUploadMixin):
    message = serializers.CharField(max_length=10000, required=False, allow_blank=True)

    def validate(self, attrs):
        attrs = self.validate_images_payload(attrs)
        if not str(attrs.get('message', '')).strip() and not attrs.get('images'):
            raise serializers.ValidationError('Ajoutez un message ou une image.')
        return attrs


class ReportReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=2000, allow_blank=False)


class ReportFilterSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['submitted','pending','in_progress','action_required','completed','cancelled','rejected'], required=False)
    type = serializers.ChoiceField(choices=['procedure','report'], required=False)
    created_from = serializers.DateField(required=False)
    created_to = serializers.DateField(required=False)
    has_images = serializers.BooleanField(required=False)
    priority = serializers.ChoiceField(choices=['low','normal','high','urgent'], required=False)
    severity = serializers.ChoiceField(choices=['minor','moderate','major','critical'], required=False)
    ordering = serializers.ChoiceField(choices=['created_at','-created_at','updated_at','-updated_at'], required=False)
    incident_category = serializers.CharField(max_length=100, required=False)
    district = serializers.CharField(max_length=120, required=False)
    search = serializers.CharField(max_length=200, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs.get('created_from') and attrs.get('created_to') and attrs['created_from'] > attrs['created_to']:
            raise serializers.ValidationError('created_from doit précéder created_to.')
        return attrs
