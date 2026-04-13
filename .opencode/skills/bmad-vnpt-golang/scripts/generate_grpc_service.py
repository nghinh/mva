#!/usr/bin/env python3
"""
Generate gRPC Service

Scaffolds a complete gRPC service implementation following Clean Architecture.
Generates proto file, server implementation, and client stub.

Usage:
    python generate_grpc_service.py --feature <feature_name> [--output <dir>]

Generated Files:
    - proto/<feature>.proto        - Protocol Buffer definition
    - models/grpc_models.go        - Proto-generated Go types
    - services/grpc_service.go     - gRPC service implementation
    - routers/grpc_router.go       - gRPC server registration

Author: Expert Go Backend Developer Skill
"""

import argparse
import os
import sys
from pathlib import Path
from datetime import datetime


GRPC_PROTO_TEMPLATE = '''syntax = "proto3";

package {package_name};

option go_package = "github.com/av-platform/features/{feature}/models;{package_name}";

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";

// {FeatureName} Service Definition
service {FeatureName}Service {{
    // Create a new {entity}
    rpc Create(Create{Entity}Request) returns ({Entity}Response);

    // Get {entity} by ID
    rpc GetByID(GetByIDRequest) returns ({Entity}Response);

    // List {entities} with pagination
    rpc List(List{Entity}Request) returns (List{Entity}Response);

    // Update an existing {entity}
    rpc Update(Update{Entity}Request) returns ({Entity}Response);

    // Delete {entity} by ID
    rpc Delete(DeleteRequest) returns (google.protobuf.Empty);
}}

// Request/Response Messages
message Create{Entity}Request {{
    string tenant_id = 1;
    string name = 2;
    string description = 3;
    map<string, string> metadata = 4;
}}

message GetByIDRequest {{
    string id = 1;
    string tenant_id = 2;
}}

message List{Entity}Request {{
    string tenant_id = 1;
    int32 page = 2;
    int32 page_size = 3;
    string filter = 4;
}}

message Update{Entity}Request {{
    string id = 1;
    string tenant_id = 2;
    string name = 3;
    string description = 4;
    map<string, string> metadata = 5;
}}

message DeleteRequest {{
    string id = 1;
    string tenant_id = 2;
}}

message {Entity}Response {{
    string id = 1;
    string tenant_id = 2;
    string name = 3;
    string description = 4;
    map<string, string> metadata = 5;
    google.protobuf.Timestamp created_at = 6;
    google.protobuf.Timestamp updated_at = 7;
}}

message List{Entity}Response {{
    repeated {Entity}Response items = 1;
    int32 total_count = 2;
    int32 page = 3;
    int32 page_size = 4;
}}
'''

GRPC_SERVICE_TEMPLATE = '''package {package_name}

import (
    "context"
    "fmt"

    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/status"
    "google.golang.org/protobuf/types/known/emptypb"
    "google.golang.org/protobuf/types/known/timestamppb"

    pb "github.com/av-platform/features/{feature}/models"
    "github.com/av-platform/utils/logging"
)

// GRPCService implements the gRPC {FeatureName}Service interface
type GRPCService struct {{
    pb.Unimplemented{FeatureName}ServiceServer
    service {Entity}ServiceInterface
}}

// NewGRPCService creates a new gRPC service instance
func NewGRPCService(service {Entity}ServiceInterface) *GRPCService {{
    return &GRPCService{{
        service: service,
    }}
}}

// Create handles the Create RPC
func (s *GRPCService) Create(ctx context.Context, req *pb.Create{Entity}Request) (*pb.{Entity}Response, error) {{
    logger.Info("gRPC Create called", "tenant_id", req.TenantId, "name", req.Name)

    // Validate request
    if req.TenantId == "" {{
        return nil, status.Error(codes.InvalidArgument, "tenant_id is required")
    }}
    if req.Name == "" {{
        return nil, status.Error(codes.InvalidArgument, "name is required")
    }}

    // Convert proto request to domain model
    input := &Create{Entity}Input{{
        TenantID:    req.TenantId,
        Name:        req.Name,
        Description: req.Description,
        Metadata:    req.Metadata,
    }}

    // Call domain service
    entity, err := s.service.Create(ctx, input)
    if err != nil {{
        logger.Error("Failed to create {entity}", "error", err)
        return nil, mapErrorToGRPCStatus(err)
    }}

    return toProtoResponse(entity), nil
}}

// GetByID handles the GetByID RPC
func (s *GRPCService) GetByID(ctx context.Context, req *pb.GetByIDRequest) (*pb.{Entity}Response, error) {{
    logger.Info("gRPC GetByID called", "id", req.Id, "tenant_id", req.TenantId)

    if req.Id == "" {{
        return nil, status.Error(codes.InvalidArgument, "id is required")
    }}

    entity, err := s.service.GetByID(ctx, req.Id, req.TenantId)
    if err != nil {{
        return nil, mapErrorToGRPCStatus(err)
    }}

    return toProtoResponse(entity), nil
}}

// List handles the List RPC
func (s *GRPCService) List(ctx context.Context, req *pb.List{Entity}Request) (*pb.List{Entity}Response, error) {{
    logger.Info("gRPC List called", "tenant_id", req.TenantId, "page", req.Page)

    params := &ListParams{{
        TenantID: req.TenantId,
        Page:     int(req.Page),
        PageSize: int(req.PageSize),
        Filter:   req.Filter,
    }}

    entities, total, err := s.service.List(ctx, params)
    if err != nil {{
        return nil, mapErrorToGRPCStatus(err)
    }}

    items := make([]*pb.{Entity}Response, len(entities))
    for i, entity := range entities {{
        items[i] = toProtoResponse(entity)
    }}

    return &pb.List{Entity}Response{{
        Items:      items,
        TotalCount: int32(total),
        Page:       req.Page,
        PageSize:   req.PageSize,
    }}, nil
}}

// Update handles the Update RPC
func (s *GRPCService) Update(ctx context.Context, req *pb.Update{Entity}Request) (*pb.{Entity}Response, error) {{
    logger.Info("gRPC Update called", "id", req.Id, "tenant_id", req.TenantId)

    if req.Id == "" {{
        return nil, status.Error(codes.InvalidArgument, "id is required")
    }}

    input := &Update{Entity}Input{{
        ID:          req.Id,
        TenantID:    req.TenantId,
        Name:        req.Name,
        Description: req.Description,
        Metadata:    req.Metadata,
    }}

    entity, err := s.service.Update(ctx, input)
    if err != nil {{
        return nil, mapErrorToGRPCStatus(err)
    }}

    return toProtoResponse(entity), nil
}}

// Delete handles the Delete RPC
func (s *GRPCService) Delete(ctx context.Context, req *pb.DeleteRequest) (*emptypb.Empty, error) {{
    logger.Info("gRPC Delete called", "id", req.Id, "tenant_id", req.TenantId)

    if req.Id == "" {{
        return nil, status.Error(codes.InvalidArgument, "id is required")
    }}

    if err := s.service.Delete(ctx, req.Id, req.TenantId); err != nil {{
        return nil, mapErrorToGRPCStatus(err)
    }}

    return &emptypb.Empty{{}}, nil
}}

// Helper functions

func toProtoResponse(entity *{Entity}) *pb.{Entity}Response {{
    return &pb.{Entity}Response{{
        Id:          entity.ID,
        TenantId:    entity.TenantID,
        Name:        entity.Name,
        Description: entity.Description,
        Metadata:    entity.Metadata,
        CreatedAt:   timestamppb.New(entity.CreatedAt),
        UpdatedAt:   timestamppb.New(entity.UpdatedAt),
    }}
}}

func mapErrorToGRPCStatus(err error) error {{
    if errors.Is(err, ErrEntityNotFound) {{
        return status.Error(codes.NotFound, err.Error())
    }}
    if errors.Is(err, ErrInvalidInput) {{
        return status.Error(codes.InvalidArgument, err.Error())
    }}
    if errors.Is(err, ErrDuplicate) {{
        return status.Error(codes.AlreadyExists, err.Error())
    }}
    return status.Error(codes.Internal, fmt.Sprintf("internal error: %v", err))
}}
'''

GRPC_ROUTER_TEMPLATE = '''package {package_name}

import (
    "net"

    "google.golang.org/grpc"
    "google.golang.org/grpc/reflection"

    pb "github.com/av-platform/features/{feature}/models"
    "github.com/av-platform/utils/logging"
)

// GRPCRouter manages gRPC server lifecycle
type GRPCRouter struct {{
    server   *grpc.Server
    port     int
    listener net.Listener
}}

// NewGRPCRouter creates a new gRPC router
func NewGRPCRouter(port int) *GRPCRouter {{
    return &GRPCRouter{{
        port: port,
    }}
}}

// RegisterServices registers all gRPC services
func (r *GRPCRouter) RegisterServices(svc *GRPCService) {{
    opts := []grpc.ServerOption{{
        grpc.UnaryInterceptor(loggingUnaryInterceptor),
        grpc.StreamInterceptor(loggingStreamInterceptor),
    }}

    r.server = grpc.NewServer(opts...)
    pb.Register{FeatureName}ServiceServer(r.server, svc)

    // Enable reflection for tools like grpcurl
    reflection.Register(r.server)
}}

// Start starts the gRPC server
func (r *GRPCRouter) Start() error {{
    lis, err := net.Listen("tcp", fmt.Sprintf(":%d", r.port))
    if err != nil {{
        return fmt.Errorf("failed to listen on port %d: %w", r.port, err)
    }}
    r.listener = lis

    logger.Info("gRPC server starting", "port", r.port)
    if err := r.server.Serve(lis); err != nil {{
        return fmt.Errorf("failed to serve gRPC: %w", err)
    }}
    return nil
}}

// Stop gracefully stops the gRPC server
func (r *GRPCRouter) Stop() {{
    if r.server != nil {{
        logger.Info("Stopping gRPC server")
        r.server.GracefulStop()
    }}
}}

// Interceptors

func loggingUnaryInterceptor(ctx context.Context, req interface{{}}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{{}}, error) {{
    logger.Debug("gRPC unary call", "method", info.FullMethod)
    resp, err := handler(ctx, req)
    if err != nil {{
        logger.Error("gRPC unary error", "method", info.FullMethod, "error", err)
    }}
    return resp, err
}}

func loggingStreamInterceptor(srv interface{{}}, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {{
    logger.Debug("gRPC stream call", "method", info.FullMethod)
    err := handler(srv, ss)
    if err != nil {{
        logger.Error("gRPC stream error", "method", info.FullMethod, "error", err)
    }}
    return err
}}
'''


def generate_grpc_service(feature: str, output_dir: Path) -> dict:
    """Generate gRPC service files for a feature."""
    feature_lower = feature.lower()
    feature_camel = ''.join(word.capitalize() for word in feature.split('_'))
    entity_camel = feature_camel  # Could be customized

    replacements = {
        '{feature}': feature_lower,
        '{package_name}': feature_lower,
        '{FeatureName}': feature_camel,
        '{Entity}': entity_camel,
        '{entity}': feature_lower,
    }

    files_created = []

    # Create proto file
    proto_dir = output_dir / 'proto'
    proto_dir.mkdir(parents=True, exist_ok=True)

    proto_content = GRPC_PROTO_TEMPLATE
    for key, value in replacements.items():
        proto_content = proto_content.replace(key, value)

    proto_file = proto_dir / f'{feature_lower}.proto'
    proto_file.write_text(proto_content)
    files_created.append(str(proto_file))

    # Create gRPC service
    services_dir = output_dir / 'services'
    services_dir.mkdir(parents=True, exist_ok=True)

    service_content = GRPC_SERVICE_TEMPLATE
    for key, value in replacements.items():
        service_content = service_content.replace(key, value)

    service_file = services_dir / f'grpc_service.go'
    service_file.write_text(service_content)
    files_created.append(str(service_file))

    # Create gRPC router
    routers_dir = output_dir / 'routers'
    routers_dir.mkdir(parents=True, exist_ok=True)

    router_content = GRPC_ROUTER_TEMPLATE
    for key, value in replacements.items():
        router_content = router_content.replace(key, value)

    router_file = routers_dir / 'grpc_router.go'
    router_file.write_text(router_content)
    files_created.append(str(router_file))

    return {
        'feature': feature,
        'files': files_created,
        'proto_file': str(proto_file),
        'commands': {
            'generate': f'protoc --go_out=. --go-grpc_out=. proto/{feature_lower}.proto',
            'install_protoc': 'go install google.golang.org/protobuf/cmd/protoc-gen-go@latest && go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest',
        }
    }


def main():
    parser = argparse.ArgumentParser(
        description='Generate gRPC service scaffolding'
    )
    parser.add_argument(
        '--feature',
        required=True,
        help='Feature name (e.g., workflow, vehicle_management)'
    )
    parser.add_argument(
        '--output',
        default='features',
        help='Output directory (default: features)'
    )

    args = parser.parse_args()
    output_dir = Path(args.output) / args.feature.lower()

    result = generate_grpc_service(args.feature, output_dir)

    print(f"\n✅ gRPC Service generated for '{args.feature}'")
    print(f"\n📁 Files created:")
    for f in result['files']:
        print(f"   - {f}")

    print(f"\n🔧 Next steps:")
    print(f"   1. Install protoc plugins:")
    print(f"      {result['commands']['install_protoc']}")
    print(f"   2. Generate Go code from proto:")
    print(f"      cd {output_dir} && {result['commands']['generate']}")
    print(f"   3. Implement business logic in services/")
    print(f"   4. Register service in main.go")


if __name__ == "__main__":
    main()
