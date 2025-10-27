#!/usr/bin/env python3
"""
FastAPI server for document chunking using Docling.
"""

import os
import logging
from pathlib import Path
from typing import List, Union

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.chunking import HybridChunker


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Docling Chunking Service")

# Base directory for document processing (will be mounted from host)
BASE_DIR = Path(os.getenv("DOCLING_WORKSPACE", "/workspace"))


class ConvertResponse(BaseModel):
    """Response model for document conversion."""
    success: bool
    chunk_count: int
    error: Union[str, None] = None


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/convert", response_model=ConvertResponse)
async def convert_document(folder_name: str):
    """
    Convert a document to chunks.

    The document should be located in BASE_DIR/folder_name/
    Chunks will be saved as chunk0.txt, chunk1.txt, etc. in the same folder.

    Args:
        folder_name: The name of the folder containing the document to convert
    """
    logger.info(f"Received conversion request for folder: {folder_name}")

    folder_path = BASE_DIR / folder_name

    if not folder_path.exists():
        logger.error(f"Folder not found: {folder_path}")
        raise HTTPException(status_code=404, detail=f"Folder not found: {folder_name}")

    # Find the document file in the folder
    document_files = list(folder_path.glob("*"))
    document_files = [f for f in document_files if f.is_file() and not f.name.startswith("chunk")]

    if not document_files:
        logger.error(f"No document found in folder: {folder_path}")
        raise HTTPException(status_code=404, detail="No document found in folder")

    if len(document_files) > 1:
        logger.warning(f"Multiple documents found in folder: {folder_path}. Using first one.")

    document_path = document_files[0]
    logger.info(f"Processing document: {document_path}")

    try:
        # Initialize Docling converter
        converter = DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=PdfPipelineOptions())})

        # Convert the document
        result = converter.convert(str(document_path))

        # Check conversion status
        if result.status.name != "SUCCESS":
            logger.error(f"Warning: Conversion status: {result.status.name}")
            raise HTTPException(status_code=500, detail=f"Error while converting document status: {result.status.name}")

        # Extract text chunks from the document
        # Docling returns a document with pages and elements
        chunks: List[str] = []

        # Initialize the chunker
        chunker = HybridChunker()

        # Chunk the document
        logger.info("Chunking document...")
        chunks = list(chunker.chunk(result.document))

        chunk_count = 0
        for i, chunk in enumerate(chunks, 0):
          chunk_file = folder_path / f"chunk{i}.txt"
          chunk_file.write_text(chunk.text, encoding="utf-8")
          logger.info(f"Saved chunk {i} to {chunk_file}")
          chunk_count += 1

        logger.info(f"Successfully created {chunk_count} chunks for {document_path}")

        return ConvertResponse(
            success=True,
            chunk_count=chunk_count,
            error=None
        )

    except Exception as e:
        logger.error(f"Error processing document: {e}", exc_info=True)
        return ConvertResponse(
            success=False,
            chunk_count=0,
            error=str(e)
        )


if __name__ == "__main__":
    import uvicorn

    # Get port from environment or use default
    port = int(os.getenv("PORT", "8000"))

    logger.info(f"Starting Docling service on port {port}")
    logger.info(f"Workspace directory: {BASE_DIR}")

    uvicorn.run(app, host="0.0.0.0", port=port)
