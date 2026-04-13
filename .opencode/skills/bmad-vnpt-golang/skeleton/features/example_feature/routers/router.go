package example_feature

import (
	"github.com/labstack/echo/v4"
	"system_integration_management/features/example_feature/controllers"
)

// RegisterRoutes binds the controller handlers to the Echo group.
func RegisterRoutes(g *echo.Group, c *controllers.ExampleController) {
	examples := g.Group("/examples")

	examples.POST("", c.Create)
	examples.GET("/:id", c.Get)
}
