package example_feature

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
	"system_integration_management/features/example_feature/models"
	"system_integration_management/features/example_feature/services"
)

// ExampleController handles HTTP requests.
type ExampleController struct {
	service services.ExampleService
}

// NewExampleController creates a new controller.
func NewExampleController(service services.ExampleService) *ExampleController {
	return &ExampleController{
		service: service,
	}
}

// Create handles POST /examples
func (c *ExampleController) Create(ctx echo.Context) error {
	var req models.CreateExampleRequest
	if err := ctx.Bind(&req); err != nil {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
	}

	// Helper to extract context (with timeout/tracing if needed already in echo context)
	// Important: Pass ctx.Request().Context() to service, NOT echo.Context directly
	result, err := c.service.CreateEntity(ctx.Request().Context(), req)
	if err != nil {
		return c.handleError(ctx, err)
	}

	return ctx.JSON(http.StatusCreated, result)
}

// Get handles GET /examples/:id
func (c *ExampleController) Get(ctx echo.Context) error {
	id := ctx.Param("id")
	if id == "" {
		return ctx.JSON(http.StatusBadRequest, map[string]string{"error": "ID is required"})
	}

	result, err := c.service.GetEntity(ctx.Request().Context(), id)
	if err != nil {
		return c.handleError(ctx, err)
	}

	return ctx.JSON(http.StatusOK, result)
}

// handleError maps domain errors to HTTP status codes
func (c *ExampleController) handleError(ctx echo.Context, err error) error {
	switch {
	case errors.Is(err, models.ErrEntityNotFound):
		return ctx.JSON(http.StatusNotFound, map[string]string{"error": "Entity not found"})
	case errors.Is(err, models.ErrInvalidInput):
		return ctx.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	case errors.Is(err, models.ErrUnauthorized):
		return ctx.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	default:
		// Don't expose internal errors to client
		return ctx.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
	}
}
