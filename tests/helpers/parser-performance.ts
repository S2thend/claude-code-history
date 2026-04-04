import { vi } from 'vitest';
import * as parser from '../../src/lib/parser.js';

export interface HeapSampleResult<T> {
  result: T;
  peakHeapBytes: number;
}

export interface ParserScanCountResult<T> {
  result: T;
  scanCount: number;
}

type ScanJsonlFileFn = (filePath: string, ...args: unknown[]) => Promise<unknown>;

type ParserModuleWithScan = typeof parser & {
  parseSessionFileWithMetadata?: ScanJsonlFileFn;
};

export async function samplePeakHeapBytes<T>(
  run: () => Promise<T>,
  sampleIntervalMs = 10
): Promise<HeapSampleResult<T>> {
  let peakHeapBytes = process.memoryUsage().heapUsed;
  const sampleHeap = (): void => {
    peakHeapBytes = Math.max(peakHeapBytes, process.memoryUsage().heapUsed);
  };

  const timer = setInterval(sampleHeap, sampleIntervalMs);
  try {
    const result = await run();
    sampleHeap();
    return { result, peakHeapBytes };
  } finally {
    clearInterval(timer);
  }
}

export async function countTargetFileParserScans<T>(
  targetFilePath: string,
  run: () => Promise<T>
): Promise<ParserScanCountResult<T>> {
  let scanCount = 0;
  const originalParseSessionFile = parser.parseSessionFile;
  const parseSessionFileSpy = vi
    .spyOn(parser, 'parseSessionFile')
    .mockImplementation(async (filePath: string) => {
      if (filePath === targetFilePath) {
        scanCount++;
      }
      return originalParseSessionFile(filePath);
    });

  const originalParseSessionMetadata = parser.parseSessionMetadata;
  const parseSessionMetadataSpy = vi
    .spyOn(parser, 'parseSessionMetadata')
    .mockImplementation(async (filePath: string) => {
      if (filePath === targetFilePath) {
        scanCount++;
      }
      return originalParseSessionMetadata(filePath);
    });

  const originalParseSessionSummary = parser.parseSessionSummary;
  const parseSessionSummarySpy = vi
    .spyOn(parser, 'parseSessionSummary')
    .mockImplementation(async (filePath: string) => {
      if (filePath === targetFilePath) {
        scanCount++;
      }
      return originalParseSessionSummary(filePath);
    });

  const parserModule = parser as ParserModuleWithScan;
  const originalParseSessionFileWithMetadata = parserModule.parseSessionFileWithMetadata;
  const parseSessionFileWithMetadataSpy = originalParseSessionFileWithMetadata
    ? vi
        .spyOn(parserModule, 'parseSessionFileWithMetadata')
        .mockImplementation(async (filePath, ...args) => {
          if (filePath === targetFilePath) {
            scanCount++;
          }
          return originalParseSessionFileWithMetadata(filePath, ...args);
        })
    : null;

  try {
    const result = await run();
    return { result, scanCount };
  } finally {
    parseSessionFileWithMetadataSpy?.mockRestore();
    parseSessionSummarySpy.mockRestore();
    parseSessionMetadataSpy.mockRestore();
    parseSessionFileSpy.mockRestore();
  }
}
