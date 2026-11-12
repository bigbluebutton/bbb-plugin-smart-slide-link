import { existsSync } from 'fs';
import path from 'path';

const ENV_FILE = path.resolve(__dirname, '../../.env');
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

export const CI = process.env.CI === 'true';
const TIMEOUT_MULTIPLIER = Number(process.env.TIMEOUT_MULTIPLIER);
const MULTIPLIER = CI ? TIMEOUT_MULTIPLIER || 2 : TIMEOUT_MULTIPLIER || 1;

// GLOBAL TESTS VARS
export const ELEMENT_WAIT_TIME: number = 5000 * MULTIPLIER;
export const ELEMENT_WAIT_LONGER_TIME: number = 10000 * MULTIPLIER;
export const ELEMENT_WAIT_EXTRA_LONG_TIME: number = 15000 * MULTIPLIER;
// The uploaded presentation has to be converted (pdf → svg/png/txt) before its pages show.
export const PRESENTATION_CONVERSION_WAIT_TIME: number = 60000 * MULTIPLIER;
