#!/bin/bash
# ============================================================
# Feature Scaffolding Script for Go Backend
# ============================================================
# Usage: ./scaffold_feature.sh <feature_name>
# Example: ./scaffold_feature.sh notifications
#
# This script creates a complete feature directory structure
# following the Senior Go Backend Developer skill guidelines.
# ============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validate input
if [ -z "$1" ]; then
    echo -e "${RED}Error: Feature name is required${NC}"
    echo "Usage: ./scaffold_feature.sh <feature_name>"
    echo "Example: ./scaffold_feature.sh notifications"
    exit 1
fi

FEATURE_NAME="$1"
FEATURE_NAME_LOWER=$(echo "$FEATURE_NAME" | tr '[:upper:]' '[:lower:]')
FEATURE_NAME_PASCAL=$(echo "$FEATURE_NAME" | sed -r 's/(^|_)([a-z])/\U\2/g')
BASE_DIR="features/${FEATURE_NAME_LOWER}"
MODULE_PATH="github.com/av-platform"

echo -e "${YELLOW}Creating feature: ${FEATURE_NAME_PASCAL}${NC}"

# Check if feature already exists
if [ -d "$BASE_DIR" ]; then
    echo -e "${RED}Error: Feature directory already exists: ${BASE_DIR}${NC}"
    exit 1
fi

# Create directory structure
mkdir -p "${BASE_DIR}/models"
mkdir -p "${BASE_DIR}/repositories"
mkdir -p "${BASE_DIR}/services"
mkdir -p "${BASE_DIR}/controllers"
mkdir -p "${BASE_DIR}/adapters"
mkdir -p "${BASE_DIR}/routers"

echo -e "${GREEN}✓ Created directory structure${NC}"

# Create models/entity.go
cat > "${BASE_DIR}/models/${FEATURE_NAME_LOWER}_model.go" << EOF
package ${FEATURE_NAME_LOWER}

import (
	"time"
)

// ${FEATURE_NAME_PASCAL} represents the core domain entity.
type ${FEATURE_NAME_PASCAL} struct {
	ID        string    \`json:"id" bson:"_id"\`
	Name      string    \`json:"name" bson:"name"\`
	Status    string    \`json:"status" bson:"status"\`
	CreatedAt time.Time \`json:"created_at" bson:"created_at"\`
	UpdatedAt time.Time \`json:"updated_at" bson:"updated_at"\`
	TenantID  string    \`json:"tenant_id" bson:"tenant_id"\`
}

// Create${FEATURE_NAME_PASCAL}Request represents the DTO for creating an entity.
type Create${FEATURE_NAME_PASCAL}Request struct {
	Name string \`json:"name" validate:"required,min=3"\`
}

// Update${FEATURE_NAME_PASCAL}Request represents the DTO for updating an entity.
type Update${FEATURE_NAME_PASCAL}Request struct {
	Name   string \`json:"name,omitempty"\`
	Status string \`json:"status,omitempty"\`
}

// ${FEATURE_NAME_PASCAL}Filter represents query parameters.
type ${FEATURE_NAME_PASCAL}Filter struct {
	Status   string
	TenantID string
}
EOF

# Create models/errors.go
cat > "${BASE_DIR}/models/errors.go" << EOF
package ${FEATURE_NAME_LOWER}

import "errors"

// Domain-specific errors for ${FEATURE_NAME_PASCAL} feature.
var (
	Err${FEATURE_NAME_PASCAL}NotFound  = errors.New("${FEATURE_NAME_LOWER} not found")
	ErrInvalidInput      = errors.New("invalid input parameters")
	ErrUnauthorized      = errors.New("unauthorized access")
)
EOF

# Create repositories/interface.go
cat > "${BASE_DIR}/repositories/interface.go" << EOF
package ${FEATURE_NAME_LOWER}

import (
	"context"
	${FEATURE_NAME_LOWER}_models "${MODULE_PATH}/features/${FEATURE_NAME_LOWER}/models"
)

// ${FEATURE_NAME_PASCAL}Repository defines the data access contract.
// Services MUST depend on this interface, not concrete implementations.
type ${FEATURE_NAME_PASCAL}Repository interface {
	Create(ctx context.Context, entity *${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}) error
	FindByID(ctx context.Context, id string) (*${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}, error)
	FindAll(ctx context.Context, filter ${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}Filter) ([]${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}, error)
	Update(ctx context.Context, id string, entity *${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}) error
	Delete(ctx context.Context, id string) error
}
EOF

# Create repositories/mongo_repository.go
cat > "${BASE_DIR}/repositories/mongo_repository.go" << EOF
package ${FEATURE_NAME_LOWER}

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	${FEATURE_NAME_LOWER}_models "${MODULE_PATH}/features/${FEATURE_NAME_LOWER}/models"
)

const collectionName = "${FEATURE_NAME_LOWER}s"

type mongoRepository struct {
	collection *mongo.Collection
}

// NewMongoRepository creates a new MongoDB repository.
func NewMongoRepository(db *mongo.Database) ${FEATURE_NAME_PASCAL}Repository {
	return &mongoRepository{
		collection: db.Collection(collectionName),
	}
}

func (r *mongoRepository) Create(ctx context.Context, entity *${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	_, err := r.collection.InsertOne(ctx, entity)
	if err != nil {
		return fmt.Errorf("failed to insert ${FEATURE_NAME_LOWER}: %w", err)
	}
	return nil
}

func (r *mongoRepository) FindByID(ctx context.Context, id string) (*${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var entity ${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&entity)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("id %s: %w", id, ${FEATURE_NAME_LOWER}_models.Err${FEATURE_NAME_PASCAL}NotFound)
		}
		return nil, fmt.Errorf("failed to find ${FEATURE_NAME_LOWER}: %w", err)
	}
	return &entity, nil
}

func (r *mongoRepository) FindAll(ctx context.Context, filter ${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}Filter) ([]${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	query := bson.M{"tenant_id": filter.TenantID}
	if filter.Status != "" {
		query["status"] = filter.Status
	}

	cursor, err := r.collection.Find(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to find ${FEATURE_NAME_LOWER}s: %w", err)
	}
	defer cursor.Close(ctx)

	var results []${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("failed to decode results: %w", err)
	}
	return results, nil
}

func (r *mongoRepository) Update(ctx context.Context, id string, entity *${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	entity.UpdatedAt = time.Now()
	_, err := r.collection.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"\$set": entity})
	if err != nil {
		return fmt.Errorf("failed to update ${FEATURE_NAME_LOWER}: %w", err)
	}
	return nil
}

func (r *mongoRepository) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	_, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return fmt.Errorf("failed to delete ${FEATURE_NAME_LOWER}: %w", err)
	}
	return nil
}
EOF

# Create services/interface.go
cat > "${BASE_DIR}/services/interface.go" << EOF
package ${FEATURE_NAME_LOWER}

import (
	"context"
)

// ${FEATURE_NAME_PASCAL}Service defines the business logic contract.
type ${FEATURE_NAME_PASCAL}Service interface {
	Create(ctx context.Context, req ${FEATURE_NAME_LOWER}_models.Create${FEATURE_NAME_PASCAL}Request) (*${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}, error)
	GetByID(ctx context.Context, id string) (*${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}, error)
	List(ctx context.Context, filter ${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}Filter) ([]${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}, error)
	Update(ctx context.Context, id string, req ${FEATURE_NAME_LOWER}_models.Update${FEATURE_NAME_PASCAL}Request) (*${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}, error)
	Delete(ctx context.Context, id string) error
}
EOF

# Create services/service_impl.go
cat > "${BASE_DIR}/services/service_impl.go" << EOF
package ${FEATURE_NAME_LOWER}

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	${FEATURE_NAME_LOWER}_models "${MODULE_PATH}/features/${FEATURE_NAME_LOWER}/models"
	${FEATURE_NAME_LOWER}_repos "${MODULE_PATH}/features/${FEATURE_NAME_LOWER}/repositories"
)

type ${FEATURE_NAME_LOWER}ServiceImpl struct {
	repo ${FEATURE_NAME_LOWER}_repos.${FEATURE_NAME_PASCAL}Repository
}

// New${FEATURE_NAME_PASCAL}Service creates a new service instance with injected dependencies.
func New${FEATURE_NAME_PASCAL}Service(repo ${FEATURE_NAME_LOWER}_repos.${FEATURE_NAME_PASCAL}Repository) ${FEATURE_NAME_PASCAL}Service {
	return &${FEATURE_NAME_LOWER}ServiceImpl{
		repo: repo,
	}
}

func (s *${FEATURE_NAME_LOWER}ServiceImpl) Create(ctx context.Context, req ${FEATURE_NAME_LOWER}_models.Create${FEATURE_NAME_PASCAL}Request) (*${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}, error) {
	// Extract Tenant ID from Context
	tenantID, ok := ctx.Value("tenant_id").(string)
	if !ok || tenantID == "" {
		return nil, fmt.Errorf("tenant_id missing: %w", ${FEATURE_NAME_LOWER}_models.ErrUnauthorized)
	}

	entity := &${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}{
		ID:        uuid.New().String(),
		Name:      req.Name,
		Status:    "active",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		TenantID:  tenantID,
	}

	if err := s.repo.Create(ctx, entity); err != nil {
		log.Printf("[ERROR] Failed to create ${FEATURE_NAME_LOWER}: %v", err)
		return nil, err
	}

	return entity, nil
}

func (s *${FEATURE_NAME_LOWER}ServiceImpl) GetByID(ctx context.Context, id string) (*${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}, error) {
	entity, err := s.repo.FindByID(ctx, id)
	if err != nil {
		log.Printf("[ERROR] GetByID failed for %s: %v", id, err)
		return nil, err
	}
	return entity, nil
}

func (s *${FEATURE_NAME_LOWER}ServiceImpl) List(ctx context.Context, filter ${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}Filter) ([]${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}, error) {
	return s.repo.FindAll(ctx, filter)
}

func (s *${FEATURE_NAME_LOWER}ServiceImpl) Update(ctx context.Context, id string, req ${FEATURE_NAME_LOWER}_models.Update${FEATURE_NAME_PASCAL}Request) (*${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}, error) {
	entity, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.Name != "" {
		entity.Name = req.Name
	}
	if req.Status != "" {
		entity.Status = req.Status
	}

	if err := s.repo.Update(ctx, id, entity); err != nil {
		return nil, err
	}

	return entity, nil
}

func (s *${FEATURE_NAME_LOWER}ServiceImpl) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}
EOF

# Create controllers/http_controller.go
cat > "${BASE_DIR}/controllers/http_controller.go" << EOF
package ${FEATURE_NAME_LOWER}

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
	${FEATURE_NAME_LOWER}_models "${MODULE_PATH}/features/${FEATURE_NAME_LOWER}/models"
)

// ${FEATURE_NAME_PASCAL}Controller handles HTTP requests.
type ${FEATURE_NAME_PASCAL}Controller struct {
	service ${FEATURE_NAME_PASCAL}Service
}

// New${FEATURE_NAME_PASCAL}Controller creates a new controller.
func New${FEATURE_NAME_PASCAL}Controller(service ${FEATURE_NAME_PASCAL}Service) *${FEATURE_NAME_PASCAL}Controller {
	return &${FEATURE_NAME_PASCAL}Controller{service: service}
}

// Create handles POST /${FEATURE_NAME_LOWER}s
func (c *${FEATURE_NAME_PASCAL}Controller) Create(ctx echo.Context) error {
	var req ${FEATURE_NAME_LOWER}_models.Create${FEATURE_NAME_PASCAL}Request
	if err := ctx.Bind(&req); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	result, err := c.service.Create(ctx.Request().Context(), req)
	if err != nil {
		return c.handleError(ctx, err)
	}

	return ctx.JSON(http.StatusCreated, result)
}

// Get handles GET /${FEATURE_NAME_LOWER}s/:id
func (c *${FEATURE_NAME_PASCAL}Controller) Get(ctx echo.Context) error {
	id := ctx.Param("id")
	if id == "" {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"error": "ID is required"})
	}

	result, err := c.service.GetByID(ctx.Request().Context(), id)
	if err != nil {
		return c.handleError(ctx, err)
	}

	return ctx.JSON(http.StatusOK, result)
}

// List handles GET /${FEATURE_NAME_LOWER}s
func (c *${FEATURE_NAME_PASCAL}Controller) List(ctx echo.Context) error {
	tenantID, _ := ctx.Request().Context().Value("tenant_id").(string)
	filter := ${FEATURE_NAME_LOWER}_models.${FEATURE_NAME_PASCAL}Filter{
		Status:   ctx.QueryParam("status"),
		TenantID: tenantID,
	}

	results, err := c.service.List(ctx.Request().Context(), filter)
	if err != nil {
		return c.handleError(ctx, err)
	}

	return ctx.JSON(http.StatusOK, results)
}

// Update handles PUT /${FEATURE_NAME_LOWER}s/:id
func (c *${FEATURE_NAME_PASCAL}Controller) Update(ctx echo.Context) error {
	id := ctx.Param("id")
	var req ${FEATURE_NAME_LOWER}_models.Update${FEATURE_NAME_PASCAL}Request
	if err := ctx.Bind(&req); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	result, err := c.service.Update(ctx.Request().Context(), id, req)
	if err != nil {
		return c.handleError(ctx, err)
	}

	return ctx.JSON(http.StatusOK, result)
}

// Delete handles DELETE /${FEATURE_NAME_LOWER}s/:id
func (c *${FEATURE_NAME_PASCAL}Controller) Delete(ctx echo.Context) error {
	id := ctx.Param("id")
	if err := c.service.Delete(ctx.Request().Context(), id); err != nil {
		return c.handleError(ctx, err)
	}
	return ctx.NoContent(http.StatusNoContent)
}

func (c *${FEATURE_NAME_PASCAL}Controller) handleError(ctx echo.Context, err error) error {
	switch {
	case errors.Is(err, ${FEATURE_NAME_LOWER}_models.Err${FEATURE_NAME_PASCAL}NotFound):
		return ctx.JSON(http.StatusNotFound, map[string]string{"error": "${FEATURE_NAME_PASCAL} not found"})
	case errors.Is(err, ${FEATURE_NAME_LOWER}_models.ErrInvalidInput):
		return ctx.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	case errors.Is(err, ${FEATURE_NAME_LOWER}_models.ErrUnauthorized):
		return ctx.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	default:
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
	}
}
EOF

# Create routers/router.go
cat > "${BASE_DIR}/routers/router.go" << EOF
package ${FEATURE_NAME_LOWER}

import (
	"github.com/labstack/echo/v4"
)

// RegisterRoutes binds the controller handlers to the Echo group.
func RegisterRoutes(g *echo.Group, c *${FEATURE_NAME_PASCAL}Controller) {
	group := g.Group("/${FEATURE_NAME_LOWER}s")

	group.POST("", c.Create)
	group.GET("", c.List)
	group.GET("/:id", c.Get)
	group.PUT("/:id", c.Update)
	group.DELETE("/:id", c.Delete)
}
EOF

# Create adapters/placeholder.go
cat > "${BASE_DIR}/adapters/external_adapter.go" << EOF
package ${FEATURE_NAME_LOWER}

// ExternalAdapter is a placeholder for external service adapters.
// Example: Wrapping a Redis client, third-party API, or message queue.
type ExternalAdapter interface {
	// Define external service methods here
}

type externalAdapterImpl struct {
	// Add external client dependencies
}

// NewExternalAdapter creates a new external adapter.
func NewExternalAdapter() ExternalAdapter {
	return &externalAdapterImpl{}
}
EOF

echo ""
echo -e "${GREEN}✅ Feature '${FEATURE_NAME_PASCAL}' scaffolded successfully!${NC}"
echo ""
echo "Created structure:"
echo "  ${BASE_DIR}/"
echo "  ├── models/"
echo "  │   ├── ${FEATURE_NAME_LOWER}_model.go"
echo "  │   └── errors.go"
echo "  ├── repositories/"
echo "  │   ├── interface.go"
echo "  │   └── mongo_repository.go"
echo "  ├── services/"
echo "  │   ├── interface.go"
echo "  │   └── service_impl.go"
echo "  ├── controllers/"
echo "  │   └── http_controller.go"
echo "  ├── adapters/"
echo "  │   └── external_adapter.go"
echo "  └── routers/"
echo "      └── router.go"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Wire dependencies in routers/constant.go"
echo "2. Register routes in main router"
echo "3. Run 'go build ./...' to verify compilation"
