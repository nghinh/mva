package example_feature

import (
	"context"
	"fmt"
	"time"

	"system_integration_management/features/example_feature/models"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

const (
	collectionName = "examples"
)

// mongoRepository is the concrete implementation of ExampleRepository.
type mongoRepository struct {
	collection *mongo.Collection
}

// NewMongoRepository creates a new instance of the repository.
func NewMongoRepository(db *mongo.Database) ExampleRepository {
	return &mongoRepository{
		collection: db.Collection(collectionName),
	}
}

func (r *mongoRepository) Create(ctx context.Context, entity *models.ExampleEntity) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	_, err := r.collection.InsertOne(ctx, entity)
	if err != nil {
		return fmt.Errorf("failed to insert entity: %w", err)
	}
	return nil
}

func (r *mongoRepository) FindByID(ctx context.Context, id string) (*models.ExampleEntity, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var entity models.ExampleEntity
	filter := bson.M{"_id": id}

	err := r.collection.FindOne(ctx, filter).Decode(&entity)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("entity %s: %w", id, models.ErrEntityNotFound)
		}
		return nil, fmt.Errorf("failed to find entity: %w", err)
	}

	return &entity, nil
}

func (r *mongoRepository) FindAll(ctx context.Context, tenantID string) ([]models.ExampleEntity, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// Ensure multi-tenancy by filtering by TenantID
	filter := bson.M{"tenant_id": tenantID}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, fmt.Errorf("failed to find all entities: %w", err)
	}
	defer cursor.Close(ctx)

	var results []models.ExampleEntity
	if err := cursor.All(ctx, &results); err != nil {
		return nil, fmt.Errorf("failed to decode results: %w", err)
	}

	return results, nil
}
