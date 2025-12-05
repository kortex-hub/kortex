# Milvus RAG Provider Extension

This extension provides Milvus vector database integration for RAG (Retrieval-Augmented Generation) functionality in Kortex.

## Features

- **RAG Connection Factory**: Creates Milvus vector database instances
- **Container-based**: Runs Milvus in containers for easy management
- **Persistent Storage**: Each Milvus instance uses a dedicated folder in extension storage
- **Port Exposure**: Exposes Milvus API (19530)

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
   - Register the connection for use with RAG

## Configuration

The extension supports the following configuration parameter:

- **name**: (Required) The name of the Milvus RAG connection

## License

Apache-2.0
