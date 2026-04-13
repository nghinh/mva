package example_feature

import (
	"context"

	"system_integration_management/features/example_feature/models"
)

// ExampleService defines the business logic contract.
type ExampleService interface {
	CreateEntity(ctx context.Context, req models.CreateExampleRequest) (*models.ExampleEntity, error)
	GetEntity(ctx context.Context, id string) (*models.ExampleEntity, error)
}
