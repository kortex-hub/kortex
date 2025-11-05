# RamaLama Extension

Integrates RamaLama local AI models with Kortex. Automatically discovers and registers models running in containers.

## Requirements

- [RamaLama](https://ramalama.ai/) installed and running locally
- Container engine running (Podman or Docker)

## Usage

1. Start RamaLama and serve a model: `ramalama serve <model-name>`
2. Models will automatically appear in Kortex's models
3. Select any model to start chatting
