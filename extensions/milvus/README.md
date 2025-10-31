# Milvus RAG Provider Extension

This extension provides Milvus vector database integration for RAG (Retrieval-Augmented Generation) functionality in Kortex.

## Features

- **RAG Connection Factory**: Creates Milvus vector database instances
- **Container-based**: Runs Milvus in containers for easy management
- **Persistent Storage**: Each Milvus instance uses a dedicated folder in extension storage
- **Port Exposure**: Exposes Milvus API (19530) and metrics (9091) ports

## Usage

1. Navigate to the RAG providers section in Kortex
2. Click "Create Milvus Connection"
3. Provide a name for your connection
4. The extension will:
   - Create a storage folder under `~/.local/share/containers/podman-desktop/extensions-storage/milvus/<name>`
   - Pull the `milvusdb/milvus:latest` image if not already available
   - Create and start a Milvus container with:
     - Volume mount to the storage folder at `/var/lib/milvus`
     - Port 19530 exposed for Milvus API
     - Port 9091 exposed for metrics
   - Register the connection for use with RAG

## Configuration

The extension supports the following configuration parameter:

- **name**: (Required) The name of the Milvus RAG connection

## Implementation Details

### RagProviderConnectionFactory

The factory implements the following:
- `creationDisplayName`: "Milvus Vector Database"
- `creationButtonTitle`: "Create Milvus Connection"
- `create(params, logger)`: Creates a new Milvus container with the specified name

### MilvusConnection

Each connection:
- Manages a Milvus container instance
- Provides lifecycle methods (start, stop, delete)
- Exposes connection credentials (empty for default Milvus setup)
- Integrates with MCP server for RAG operations

## Container Configuration

The Milvus container is created with:
- **Image**: `milvusdb/milvus:latest`
- **Environment**:
  - `ETCD_USE_EMBED=true` - Use embedded etcd
  - `COMMON_STORAGETYPE=local` - Use local storage
- **Volumes**: Storage folder mounted at `/var/lib/milvus`
- **Ports**:
  - `19530`: Milvus API endpoint
  - `9091`: Metrics endpoint

## License

Apache-2.0
