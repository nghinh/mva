package example_feature

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"system_integration_management/features/example_feature/models"
	"system_integration_management/features/example_feature/repositories"
)

// exampleServiceImpl implements ExampleService.
type exampleServiceImpl struct {
	repo repositories.ExampleRepository
}

// NewExampleService creates a new service instance.
// Dependencies are injected via the constructor.
func NewExampleService(repo repositories.ExampleRepository) ExampleService {
	return &exampleServiceImpl{
		repo: repo,
	}
}

func (s *exampleServiceImpl) CreateEntity(ctx context.Context, req models.CreateExampleRequest) (*models.ExampleEntity, error) {
	// 1. Validate Input (Business Level)
	if req.Name == "" {
		return nil, models.ErrInvalidInput
	}

	// 2. Extract Tenant ID from Context (Multi-tenancy)
	// Assuming a middleware places "tenant_id" in context. In a real app, use a strongly typed key.
	tenantID, ok := ctx.Value("tenant_id").(string)
	if !ok || tenantID == "" {
		return nil, fmt.Errorf("tenant_id missing from context: %w", models.ErrUnauthorized)
	}

	// 3. Construct Entity
	entity := &models.ExampleEntity{
		ID:        uuid.New().String(),
		Name:      req.Name,
		Status:    "active",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		TenantID:  tenantID,
	}

	// 4. Persistence
	if err := s.repo.Create(ctx, entity); err != nil {
		log.Printf("[ERROR] Failed to create entity: %v", err)
		return nil, err
	}

	// 5. Return success
	return entity, nil
}

func (s *exampleServiceImpl) GetEntity(ctx context.Context, id string) (*models.ExampleEntity, error) {
	entity, err := s.repo.FindByID(ctx, id)
	if err != nil {
		// Log error but respect the wrapped error type
		log.Printf("[ERROR] GetEntity failed for ID %s: %v", id, err)
		return nil, err
	}
	return entity, nil
}
