"""Schémas des signalements : aucune dépendance vers les vues."""
from drf_yasg import openapi
from drf_yasg.utils import swagger_auto_schema
from rest_framework import serializers
from helpers.swagger import ManualFormAutoSchema
from .serializers import CitizenRequestSerializer, CitizenRequestDetailSerializer, CitizenRequestEventSerializer, AgentCitizenRequestDetailSerializer
from .report_serializers import RequestAttachmentSerializer, ReportReasonSerializer

JWT = [{'Bearer': []}]


class ReportErrorSerializer(serializers.Serializer):
    detail = serializers.CharField()
    errors = serializers.JSONField(required=False)


class ReportConfirmationSerializer(serializers.Serializer):
    received = serializers.BooleanField()
    message = serializers.CharField()
    next_step = serializers.ChoiceField(choices=["triage", "processing", "emergency"])
    reference = serializers.CharField()
    status = serializers.CharField()
    created_at = serializers.DateTimeField()
    service = serializers.IntegerField(allow_null=True)
    needs_triage = serializers.BooleanField()
    handling_route = serializers.ChoiceField(choices=["standard", "priority", "emergency"])
    alert_status = serializers.ChoiceField(choices=["none", "pending", "dispatched", "acknowledged"])


class ReportCreatedSerializer(CitizenRequestSerializer):
    confirmation = ReportConfirmationSerializer(read_only=True)

    class Meta(CitizenRequestSerializer.Meta):
        fields = CitizenRequestSerializer.Meta.fields + ('confirmation',)


class ReportPageSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = CitizenRequestSerializer(many=True)


class ReportAttachmentPageSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = RequestAttachmentSerializer(many=True)


class ReportEventPageSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = CitizenRequestEventSerializer(many=True)


class UploadedAttachmentsSerializer(serializers.Serializer):
    attachments = RequestAttachmentSerializer(many=True)


class ReportCategorySerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()
    suggested_service = serializers.IntegerField(allow_null=True)
    suggested_service_name = serializers.CharField(allow_null=True)
    needs_triage = serializers.BooleanField()
    alerting = serializers.ChoiceField(choices=["standard", "emergency"])
    emergency = serializers.BooleanField()


class ReportLimitsSerializer(serializers.Serializer):
    images_per_upload = serializers.IntegerField()
    images_per_request = serializers.IntegerField()
    image_max_bytes = serializers.IntegerField()
    image_max_pixels = serializers.IntegerField()
    accepted_formats = serializers.ListField(child=serializers.CharField())


class ReportCategoriesResponseSerializer(serializers.Serializer):
    categories = ReportCategorySerializer(many=True)
    limits = ReportLimitsSerializer()
    location_rule = serializers.CharField()
    danger_guidance = serializers.CharField()


class ReportSummarySerializer(serializers.Serializer):
    total = serializers.IntegerField()
    open = serializers.IntegerField()
    by_status = serializers.DictField(child=serializers.IntegerField())
    needs_information = serializers.IntegerField()
    needs_triage = serializers.IntegerField()
    emergency_open = serializers.IntegerField()
    emergency_acknowledged = serializers.IntegerField()


def responses(success=None, code=200):
    errors = {400:ReportErrorSerializer, 401:ReportErrorSerializer, 403:ReportErrorSerializer,
              404:ReportErrorSerializer, 429:ReportErrorSerializer, 500:ReportErrorSerializer}
    errors[code] = success if success is not None else openapi.Response('Opération réalisée')
    return errors


def form(name, description, type='string', required=False, format=None):
    return openapi.Parameter(name, openapi.IN_FORM, type=type, description=description, required=required, format=format)


IMAGE_PARAMETERS = [
    form('image','Photo unique JPEG/PNG/WebP (alternative à images)', type='file'),
    form('images','Photos multiples : répéter la clé images en multipart ; 10 par envoi, 20 par dossier', type='file'),
    openapi.Parameter('image_captions', openapi.IN_FORM, type='array', items=openapi.Items(type='string'),
                      collection_format='multi', description='Une légende par image ; répéter ce champ dans le même ordre.'),
]
RICH_PARAMETERS = [
    form('district','Quartier, 120 caractères'), form('street','Rue, 160 caractères'),
    form('building','Bâtiment ou numéro, 120 caractères'), form('landmark','Point de repère, 255 caractères'),
    form('location_accuracy','Précision GPS en mètres, 0 à 10 000', type='number'),
    form('occurred_at','Date d’observation ISO 8601, non future', format='date-time'),
    form('frequency','once, recurring ou ongoing'), form('infrastructure_id','Référence de l’équipement'),
    form('severity','minor, moderate, major ou critical'), form('danger_present','Danger déclaré', type='boolean'),
    form('people_affected','Nombre de personnes affectées', type='integer'),
    form('impacts_accessibility','Impact sur l’accessibilité', type='boolean'),
    form('accessibility_details','Précisions sur l’accessibilité, 2 000 caractères maximum'),
    form('allow_contact','Autorisation de contacter, true par défaut', type='boolean'),
    form('preferred_contact','platform, email ou phone'), form('contact_phone','Téléphone facultatif ; requis pour contact phone si absent du profil'),
    *IMAGE_PARAMETERS,
]
FILTER_PARAMETERS = [
    openapi.Parameter(name, openapi.IN_QUERY, type=kind, description=description)
    for name, kind, description in [
        ('type','string','procedure ou report'), ('status','string','submitted, pending, in_progress, action_required, completed, cancelled, rejected'),
        ('incident_category','string','Code ou catégorie libre'), ('priority','string','low, normal, high, urgent'),
        ('handling_route','string','standard, priority ou emergency'), ('alert_status','string','none, pending, dispatched ou acknowledged'),
        ('severity','string','minor, moderate, major, critical'), ('district','string','Quartier exact, sans distinction de casse'),
        ('search','string','Référence, titre, description, lieu ou service'), ('has_images','boolean','Au moins une image visible pour cet utilisateur'),
        ('created_from','string','Date minimale YYYY-MM-DD incluse'), ('created_to','string','Date maximale YYYY-MM-DD incluse'),
        ('ordering','string','created_at, -created_at, updated_at ou -updated_at'),
        ('page','integer','Page, 1 par défaut'), ('page_size','integer','50 par défaut, 100 maximum'),
    ]
]

report_list_schema = swagger_auto_schema(tags=['Signalements et historique'], security=JWT,
    operation_summary='Historique personnel filtrable', manual_parameters=FILTER_PARAMETERS,
    responses=responses(ReportPageSerializer))
report_categories_schema = swagger_auto_schema(tags=['Signalements'], security=JWT,
    responses=responses(ReportCategoriesResponseSerializer))
report_summary_schema = swagger_auto_schema(tags=['Signalements'], security=JWT,
    responses=responses(ReportSummarySerializer))
report_detail_schema = swagger_auto_schema(tags=['Signalements'], security=JWT,
    responses=responses(CitizenRequestDetailSerializer))
report_edit_schema = swagger_auto_schema(auto_schema=ManualFormAutoSchema, tags=['Signalements'], security=JWT,
    operation_description='Correction avant traitement : les champs omis sont conservés. Le type et les champs administratifs sont immuables.',
    manual_parameters=[form('title','Titre'),form('description','Description'),form('incident_category','Catégorie'),
        form('service','Service actif choisi, ou vide pour triage',type='integer'),form('location_text','Lieu en texte'),
        form('latitude','Latitude -90 à 90',type='number'),form('longitude','Longitude -180 à 180',type='number'),*RICH_PARAMETERS],
    responses=responses(CitizenRequestDetailSerializer))
report_reason_schema = swagger_auto_schema(auto_schema=ManualFormAutoSchema, tags=['Signalements'], security=JWT,
    manual_parameters=[form('reason','Motif obligatoire, 2 000 caractères maximum',required=True)],
    responses=responses(CitizenRequestDetailSerializer))
agent_report_reopen_schema = swagger_auto_schema(auto_schema=ManualFormAutoSchema, tags=['Agent - Signalements'], security=JWT,
    manual_parameters=[form('reason','Motif obligatoire de réouverture',required=True)],
    responses=responses(AgentCitizenRequestDetailSerializer))
report_messages_get_schema = swagger_auto_schema(tags=['Signalements - Suivi'], security=JWT,
    responses=responses(ReportEventPageSerializer))
report_messages_post_schema = swagger_auto_schema(auto_schema=ManualFormAutoSchema, tags=['Signalements - Suivi'], security=JWT,
    manual_parameters=[form('message','Complément de 10 000 caractères maximum, ou au moins une image'),*IMAGE_PARAMETERS],
    responses=responses(CitizenRequestEventSerializer,201))
report_attachments_get_schema = swagger_auto_schema(tags=['Signalements - Photos'], security=JWT,
    responses=responses(ReportAttachmentPageSerializer))
report_attachments_post_schema = swagger_auto_schema(auto_schema=ManualFormAutoSchema, tags=['Signalements - Photos'], security=JWT,
    manual_parameters=[*IMAGE_PARAMETERS, form('is_public','Visible par le citoyen. Réservé aux agents ; forcé à true côté citoyen.',type='boolean')],
    responses=responses(UploadedAttachmentsSerializer,201))
report_attachment_get_schema = swagger_auto_schema(tags=['Signalements - Photos'], security=JWT,
    responses=responses(RequestAttachmentSerializer))
report_attachment_patch_schema = swagger_auto_schema(auto_schema=ManualFormAutoSchema, tags=['Signalements - Photos'], security=JWT,
    manual_parameters=[form('caption','Légende, 300 caractères',required=True)], responses=responses(RequestAttachmentSerializer))
report_attachment_delete_schema = swagger_auto_schema(tags=['Signalements - Photos'], security=JWT,
    responses=responses(code=204))
report_image_download_schema = swagger_auto_schema(tags=['Signalements - Photos'], security=JWT,
    operation_description='Téléchargement privé avec JWT Bearer. Faire fetch avec Authorization, puis afficher le Blob dans le frontend.',
    responses=responses(openapi.Response('Image normalisée',schema=openapi.Schema(type='file'))))
