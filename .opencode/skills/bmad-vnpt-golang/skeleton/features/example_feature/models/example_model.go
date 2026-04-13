package example_feature

import (
	"time"
)

// ExampleEntity represents a core domain entity.
// It is pure Go and does not depend on database tags (unless using direct binding, but pure domain is better).
type ExampleEntity struct {
	ID        string    `json:"id" bson:"_id"`
	Name      string    `json:"name" bson:"name"`
	Status    string    `json:"status" bson:"status"`
	CreatedAt time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt time.Time `json:"updated_at" bson:"updated_at"`
	TenantID  string    `json:"tenant_id" bson:"tenant_id"` // Multi-tenancy support
}

// CreateExampleRequest represents the DTO for creating an entity.
type CreateExampleRequest struct {
	Name string `json:"name" validate:"required,min=3"`
}

// ExampleFilter represents query parameters.
type ExampleFilter struct {
	Status string
}
