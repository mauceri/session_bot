import Ajv, { ValidateFunction } from 'ajv';
import { ChunkPayload, FullMessagePayload } from './types';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load JSON schemas at runtime (avoiding JSON module import issues)
const schemaDir = join(__dirname, 'schemas');
const schemaChunk = JSON.parse(
  readFileSync(join(schemaDir, 'chunk_payload.json'), 'utf-8')
) as object;
const schemaFull = JSON.parse(
  readFileSync(join(schemaDir, 'full_message_payload.json'), 'utf-8')
) as object;

const ajv = new Ajv();

/** Validate a single chunk payload against the JSON Schema */
export const validateChunkPayload: ValidateFunction<ChunkPayload> = ajv.compile(schemaChunk);

/** Validate a full message payload against the JSON Schema */
export const validateFullMessagePayload: ValidateFunction<FullMessagePayload> = ajv.compile(schemaFull);