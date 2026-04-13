package example_feature

import "errors"

// Define domain-specific errors here.
// These are used by services and controllers to handle logic flow matching.
var (
	ErrEntityNotFound = errors.New("entity not found")
	ErrInvalidInput   = errors.New("invalid input parameters")
	ErrInternalServer = errors.New("internal server error")
	ErrUnauthorized   = errors.New("unauthorized access")
)
