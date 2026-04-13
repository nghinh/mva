package example_feature

import (
	"context"

	"system_integration_management/features/example_feature/models"
)

// ExampleRepository defines the contract for data access.
// Services MUST depend on this interface, not the concrete implementation.
type ExampleRepository interface {
	Create(ctx context.Context, entity *models.ExampleEntity) error
	FindByID(ctx context.Context, id string) (*models.ExampleEntity, error)
	FindAll(ctx context.Context, tenantID string) ([]models.ExampleEntity, error)
}
