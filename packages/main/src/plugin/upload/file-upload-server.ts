/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import { existsSync, mkdirSync } from 'node:fs';
import type * as http from 'node:http';
import { join } from 'node:path';

import type { Application } from 'express';
import express from 'express';
import { inject, injectable } from 'inversify';
import multer from 'multer';

import { Directories } from '/@/plugin/directories.js';

import { getFreePort } from '../util/port.js';

@injectable()
export class FileUploadServer {
  #app: Application;
  #instance: http.Server | undefined;
  #serverPort: number = 0;
  #uploadDir: string;

  constructor(@inject(Directories) private readonly directories: Directories) {
    this.#app = express();
    this.#uploadDir = this.directories.getUploadsDirectory();
    this.configureApp();
  }

  private configureApp(): void {
    this.#app.use(express.json());
    this.#app.use(express.urlencoded({ extended: true }));

    // Ensure upload directory exists
    if (!existsSync(this.#uploadDir)) {
      mkdirSync(this.#uploadDir, { recursive: true });
    }

    // Configure multer for file uploads
    // eslint-disable-next-line sonarjs/content-length
    const upload = multer({ dest: this.#uploadDir });

    // CORS middleware for chat window
    this.#app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });

    // File upload endpoint
    this.#app.post('/api/file/upload', upload.single('file'), (req, res) => {
      try {
        if (!req.file) {
          res.status(400).json({ message: 'No file uploaded' });
          return;
        }

        const response = {
          url: `http://localhost:${this.#serverPort}/api/file/download/${req.file.filename}`,
          pathname: req.file.originalname,
          contentType: req.file.mimetype,
        };

        res.json(response);
      } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ message: 'Failed to upload file' });
      }
    });

    // File download endpoint
    this.#app.get('/api/file/download/:filename', (req, res) => {
      try {
        const filename = req.params.filename;
        const filepath = join(this.#uploadDir, filename);

        if (!existsSync(filepath)) {
          res.status(404).json({ message: 'File not found' });
          return;
        }

        res.sendFile(filepath);
      } catch (error) {
        console.error('File download error:', error);
        res.status(500).json({ message: 'Failed to download file' });
      }
    });
  }

  async start(): Promise<void> {
    // Get a free port
    this.#serverPort = await getFreePort(46000);

    console.log('Starting file upload server on port', this.#serverPort);

    // Start the server
    await new Promise<void>((resolve, reject) => {
      this.#instance = this.#app
        .listen(this.#serverPort, () => {
          resolve();
        })
        .on('error', (err: unknown) => {
          reject(new Error(String(err)));
        });
    });
  }

  async stop(): Promise<void> {
    if (!this.#instance) {
      return;
    }
    return new Promise<void>((resolve, reject) => {
      this.#instance?.close((err: unknown) => {
        if (err) {
          reject(new Error(String(err)));
        } else {
          resolve();
        }
      });
    });
  }

  getServerPort(): number {
    return this.#serverPort;
  }
}
