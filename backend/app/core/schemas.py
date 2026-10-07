"""Base classes of the API's request and response models."""

from pydantic import BaseModel, ConfigDict


class Schema(BaseModel):
    """Every API model. In a response a field with a default is always sent, so its schema marks it required: the
    generated frontend client then types `alternatives: string[]`, not `alternatives?: string[]`. Request schemas
    are not affected (a client may still leave such a field out)."""

    model_config = ConfigDict(json_schema_serialization_defaults_required=True)


class ORM(Schema):
    """Response models that are built from ORM objects."""

    model_config = ConfigDict(from_attributes=True, json_schema_serialization_defaults_required=True)
