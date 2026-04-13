#!/usr/bin/env python3
"""
Go Feature Scaffolding Script
==============================
Alternative Python version for Windows compatibility.

Usage:
    python scaffold_feature.py <feature_name>
    python scaffold_feature.py notifications
"""

import os
import sys
import argparse
from pathlib import Path


def to_pascal_case(name: str) -> str:
    """Convert snake_case to PascalCase."""
    return ''.join(word.capitalize() for word in name.split('_'))


def to_lower(name: str) -> str:
    """Convert to lowercase with underscores."""
    return name.lower().replace('-', '_')


def create_file(path: Path, content: str):
    """Create a file with the given content."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')
    print(f"  ✓ Created: {path}")


def scaffold_feature(feature_name: str, base_path: str = "features"):
    """Scaffold a complete Go feature structure."""
    name_lower = to_lower(feature_name)
    name_pascal = to_pascal_case(name_lower)
    base_dir = Path(base_path) / name_lower
    module_path = "github.com/av-platform"  # TODO: Detect from go.mod

    if base_dir.exists():
        print(f"❌ Error: Feature directory already exists: {base_dir}")
        sys.exit(1)

    print(f"🚀 Creating feature: {name_pascal}")
    print()

    # models/entity.go
    create_file(base_dir / "models" / f"{name_lower}_model.go", f'''package {name_lower}

import (
	"time"
)

// {name_pascal} represents the core domain entity.
type {name_pascal} struct {{
	ID        string    `json:"id" bson:"_id"`
	Name      string    `json:"name" bson:"name"`
	Status    string    `json:"status" bson:"status"`
	CreatedAt time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt time.Time `json:"updated_at" bson:"updated_at"`
	TenantID  string    `json:"tenant_id" bson:"tenant_id"`
}}

// Create{name_pascal}Request represents the DTO for creating an entity.
type Create{name_pascal}Request struct {{
	Name string `json:"name" validate:"required,min=3"`
}}

// Update{name_pascal}Request represents the DTO for updating an entity.
type Update{name_pascal}Request struct {{
	Name   string `json:"name,omitempty"`
	Status string `json:"status,omitempty"`
}}

// {name_pascal}Filter represents query parameters.
type {name_pascal}Filter struct {{
	Status   string
	TenantID string
}}
''')

    # models/errors.go
    create_file(base_dir / "models" / "errors.go", f'''package {name_lower}

import "errors"

// Domain-specific errors for {name_pascal} feature.
var (
	Err{name_pascal}NotFound = errors.New("{name_lower} not found")
	ErrInvalidInput          = errors.New("invalid input parameters")
	ErrUnauthorized          = errors.New("unauthorized access")
)
''')

    # repositories/interface.go
    create_file(base_dir / "repositories" / "interface.go", f'''package {name_lower}

import (
	"context"
    {name_lower}_models "{module_path}/{base_path}/{name_lower}/models"
)

// {name_pascal}Repository defines the data access contract.
type {name_pascal}Repository interface {{
	Create(ctx context.Context, entity *{name_lower}_models.{name_pascal}) error
	FindByID(ctx context.Context, id string) (*{name_lower}_models.{name_pascal}, error)
	FindAll(ctx context.Context, filter {name_lower}_models.{name_pascal}Filter) ([]{name_lower}_models.{name_pascal}, error)
	Update(ctx context.Context, id string, entity *{name_lower}_models.{name_pascal}) error
	Delete(ctx context.Context, id string) error
}}
''')

    # repositories/mongo_repository.go
    create_file(base_dir / "repositories" / "mongo_repository.go", f'''package {name_lower}

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
    {name_lower}_models "{module_path}/{base_path}/{name_lower}/models"
)

const collectionName = "{name_lower}s"

type mongoRepository struct {{
	collection *mongo.Collection
}}

// NewMongoRepository creates a new MongoDB repository.
func NewMongoRepository(db *mongo.Database) {name_pascal}Repository {{
	return &mongoRepository{{
		collection: db.Collection(collectionName),
	}}
}}

func (r *mongoRepository) Create(ctx context.Context, entity *{name_lower}_models.{name_pascal}) error {{
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	_, err := r.collection.InsertOne(ctx, entity)
	if err != nil {{
		return fmt.Errorf("failed to insert {name_lower}: %w", err)
	}}
	return nil
}}

func (r *mongoRepository) FindByID(ctx context.Context, id string) (*{name_lower}_models.{name_pascal}, error) {{
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var entity {name_lower}_models.{name_pascal}
	err := r.collection.FindOne(ctx, bson.M{{"_id": id}}).Decode(&entity)
	if err != nil {{
		if err == mongo.ErrNoDocuments {{
			return nil, fmt.Errorf("id %s: %w", id, {name_lower}_models.Err{name_pascal}NotFound)
		}}
		return nil, fmt.Errorf("failed to find {name_lower}: %w", err)
	}}
	return &entity, nil
}}

func (r *mongoRepository) FindAll(ctx context.Context, filter {name_lower}_models.{name_pascal}Filter) ([]{name_lower}_models.{name_pascal}, error) {{
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	query := bson.M{{"tenant_id": filter.TenantID}}
	if filter.Status != "" {{
		query["status"] = filter.Status
	}}

	cursor, err := r.collection.Find(ctx, query)
	if err != nil {{
		return nil, fmt.Errorf("failed to find {name_lower}s: %w", err)
	}}
	defer cursor.Close(ctx)

	var results []{name_lower}_models.{name_pascal}
	if err := cursor.All(ctx, &results); err != nil {{
		return nil, fmt.Errorf("failed to decode results: %w", err)
	}}
	return results, nil
}}

func (r *mongoRepository) Update(ctx context.Context, id string, entity *{name_lower}_models.{name_pascal}) error {{
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	entity.UpdatedAt = time.Now()
	_, err := r.collection.UpdateOne(ctx, bson.M{{"_id": id}}, bson.M{{"$set": entity}})
	if err != nil {{
		return fmt.Errorf("failed to update {name_lower}: %w", err)
	}}
	return nil
}}

func (r *mongoRepository) Delete(ctx context.Context, id string) error {{
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	_, err := r.collection.DeleteOne(ctx, bson.M{{"_id": id}})
	if err != nil {{
		return fmt.Errorf("failed to delete {name_lower}: %w", err)
	}}
	return nil
}}
''')

    # services/interface.go
    create_file(base_dir / "services" / "interface.go", f'''package {name_lower}

import (
	"context"
    {name_lower}_models "{module_path}/{base_path}/{name_lower}/models"
)

// {name_pascal}Service defines the business logic contract.
type {name_pascal}Service interface {{
	Create(ctx context.Context, req {name_lower}_models.Create{name_pascal}Request) (*{name_lower}_models.{name_pascal}, error)
	GetByID(ctx context.Context, id string) (*{name_lower}_models.{name_pascal}, error)
	List(ctx context.Context, filter {name_lower}_models.{name_pascal}Filter) ([]{name_lower}_models.{name_pascal}, error)
	Update(ctx context.Context, id string, req {name_lower}_models.Update{name_pascal}Request) (*{name_lower}_models.{name_pascal}, error)
	Delete(ctx context.Context, id string) error
}}
''')

    # services/service_impl.go
    create_file(base_dir / "services" / "service_impl.go", f'''package {name_lower}

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	{name_lower}_models "{module_path}/{base_path}/{name_lower}/models"
	{name_lower}_repos "{module_path}/{base_path}/{name_lower}/repositories"
)

type {name_lower}ServiceImpl struct {{
	repo {name_lower}_repos.{name_pascal}Repository
}}

// New{name_pascal}Service creates a new service instance.
func New{name_pascal}Service(repo {name_lower}_repos.{name_pascal}Repository) {name_pascal}Service {{
	return &{name_lower}ServiceImpl{{
		repo: repo,
	}}
}}

func (s *{name_lower}ServiceImpl) Create(ctx context.Context, req {name_lower}_models.Create{name_pascal}Request) (*{name_lower}_models.{name_pascal}, error) {{
	tenantID, ok := ctx.Value("tenant_id").(string)
	if !ok || tenantID == "" {{
		return nil, fmt.Errorf("tenant_id missing: %w", {name_lower}_models.ErrUnauthorized)
	}}

	entity := &{name_lower}_models.{name_pascal}{{
		ID:        uuid.New().String(),
		Name:      req.Name,
		Status:    "active",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		TenantID:  tenantID,
	}}

	if err := s.repo.Create(ctx, entity); err != nil {{
		log.Printf("[ERROR] Failed to create {name_lower}: %v", err)
		return nil, err
	}}

	return entity, nil
}}

func (s *{name_lower}ServiceImpl) GetByID(ctx context.Context, id string) (*{name_lower}_models.{name_pascal}, error) {{
	return s.repo.FindByID(ctx, id)
}}

func (s *{name_lower}ServiceImpl) List(ctx context.Context, filter {name_lower}_models.{name_pascal}Filter) ([]{name_lower}_models.{name_pascal}, error) {{
	return s.repo.FindAll(ctx, filter)
}}

func (s *{name_lower}ServiceImpl) Update(ctx context.Context, id string, req {name_lower}_models.Update{name_pascal}Request) (*{name_lower}_models.{name_pascal}, error) {{
	entity, err := s.repo.FindByID(ctx, id)
	if err != nil {{
		return nil, err
	}}

	if req.Name != "" {{
		entity.Name = req.Name
	}}
	if req.Status != "" {{
		entity.Status = req.Status
	}}

	if err := s.repo.Update(ctx, id, entity); err != nil {{
		return nil, err
	}}

	return entity, nil
}}

func (s *{name_lower}ServiceImpl) Delete(ctx context.Context, id string) error {{
	return s.repo.Delete(ctx, id)
}}
''')

    # controllers/http_controller.go
    create_file(base_dir / "controllers" / "http_controller.go", f'''package {name_lower}

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
)

// {name_pascal}Controller handles HTTP requests.
type {name_pascal}Controller struct {{
	service {name_pascal}Service
}}

// New{name_pascal}Controller creates a new controller.
func New{name_pascal}Controller(service {name_pascal}Service) *{name_pascal}Controller {{
	return &{name_pascal}Controller{{service: service}}
}}

// Create handles POST /{name_lower}s
func (c *{name_pascal}Controller) Create(ctx echo.Context) error {{
	var req Create{name_pascal}Request
	if err := ctx.Bind(&req); err != nil {{
		return ctx.JSON(http.StatusBadRequest, map[string]string{{"error": "Invalid request body"}})
	}}

	result, err := c.service.Create(ctx.Request().Context(), req)
	if err != nil {{
		return c.handleError(ctx, err)
	}}

	return ctx.JSON(http.StatusCreated, result)
}}

// Get handles GET /{name_lower}s/:id
func (c *{name_pascal}Controller) Get(ctx echo.Context) error {{
	id := ctx.Param("id")
	result, err := c.service.GetByID(ctx.Request().Context(), id)
	if err != nil {{
		return c.handleError(ctx, err)
	}}
	return ctx.JSON(http.StatusOK, result)
}}

// List handles GET /{name_lower}s
func (c *{name_pascal}Controller) List(ctx echo.Context) error {{
	tenantID, _ := ctx.Request().Context().Value("tenant_id").(string)
	filter := {name_pascal}Filter{{
		Status:   ctx.QueryParam("status"),
		TenantID: tenantID,
	}}

	results, err := c.service.List(ctx.Request().Context(), filter)
	if err != nil {{
		return c.handleError(ctx, err)
	}}

	return ctx.JSON(http.StatusOK, results)
}}

// Update handles PUT /{name_lower}s/:id
func (c *{name_pascal}Controller) Update(ctx echo.Context) error {{
	id := ctx.Param("id")
	var req Update{name_pascal}Request
	if err := ctx.Bind(&req); err != nil {{
		return ctx.JSON(http.StatusBadRequest, map[string]string{{"error": "Invalid request body"}})
	}}

	result, err := c.service.Update(ctx.Request().Context(), id, req)
	if err != nil {{
		return c.handleError(ctx, err)
	}}

	return ctx.JSON(http.StatusOK, result)
}}

// Delete handles DELETE /{name_lower}s/:id
func (c *{name_pascal}Controller) Delete(ctx echo.Context) error {{
	id := ctx.Param("id")
	if err := c.service.Delete(ctx.Request().Context(), id); err != nil {{
		return c.handleError(ctx, err)
	}}
	return ctx.NoContent(http.StatusNoContent)
}}

func (c *{name_pascal}Controller) handleError(ctx echo.Context, err error) error {{
	switch {{
	case errors.Is(err, Err{name_pascal}NotFound):
		return ctx.JSON(http.StatusNotFound, map[string]string{{"error": "{name_pascal} not found"}})
	case errors.Is(err, ErrInvalidInput):
		return ctx.JSON(http.StatusBadRequest, map[string]string{{"error": err.Error()}})
	case errors.Is(err, ErrUnauthorized):
		return ctx.JSON(http.StatusUnauthorized, map[string]string{{"error": "Unauthorized"}})
	default:
		return ctx.JSON(http.StatusInternalServerError, map[string]string{{"error": "Internal server error"}})
	}}
}}
''')

    # routers/router.go
    create_file(base_dir / "routers" / "router.go", f'''package {name_lower}

import (
	"github.com/labstack/echo/v4"
)

// RegisterRoutes binds the controller handlers to the Echo group.
func RegisterRoutes(g *echo.Group, c *{name_pascal}Controller) {{
	group := g.Group("/{name_lower}s")

	group.POST("", c.Create)
	group.GET("", c.List)
	group.GET("/:id", c.Get)
	group.PUT("/:id", c.Update)
	group.DELETE("/:id", c.Delete)
}}
''')

    # adapters/external_adapter.go
    create_file(base_dir / "adapters" / "external_adapter.go", f'''package {name_lower}

// ExternalAdapter is a placeholder for external service adapters.
type ExternalAdapter interface {{
	// Define external service methods here
}}

type externalAdapterImpl struct {{
	// Add external client dependencies
}}

// NewExternalAdapter creates a new external adapter.
func NewExternalAdapter() ExternalAdapter {{
	return &externalAdapterImpl{{}}
}}
''')

    print()
    print(f"✅ Feature '{name_pascal}' scaffolded successfully!")
    print()
    print("Created structure:")
    print(f"  {base_dir}/")
    print(f"  ├── models/")
    print(f"  │   ├── {name_lower}_model.go")
    print(f"  │   └── errors.go")
    print(f"  ├── repositories/")
    print(f"  │   ├── interface.go")
    print(f"  │   └── mongo_repository.go")
    print(f"  ├── services/")
    print(f"  │   ├── interface.go")
    print(f"  │   └── service_impl.go")
    print(f"  ├── controllers/")
    print(f"  │   └── http_controller.go")
    print(f"  ├── adapters/")
    print(f"  │   └── external_adapter.go")
    print(f"  └── routers/")
    print(f"      └── router.go")
    print()
    print("Next steps:")
    print("1. Wire dependencies in routers/constant.go")
    print("2. Register routes in main router")
    print("3. Run 'go build ./...' to verify compilation")


def main():
    parser = argparse.ArgumentParser(
        description="Scaffold a new Go feature following Senior Backend Developer guidelines"
    )
    parser.add_argument("feature_name", help="Name of the feature (e.g., notifications, users)")
    parser.add_argument("--path", default="features", help="Base path for features directory")

    args = parser.parse_args()
    scaffold_feature(args.feature_name, args.path)


if __name__ == "__main__":
    main()
