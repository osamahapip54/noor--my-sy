import * as ort from 'mixdeck://app/node_modules/onnxruntime-web/dist/ort.bundle.min.mjs';
import { DemucsProcessor } from 'mixdeck://app/node_modules/demucs-web/src/index.js';

const sampleRate = 44100;
let processor;

ort.env.wasm.wasmPaths = 'mixdeck://app/node_modules/onnxruntime-web/dist/';
ort.env.wasm.numThreads = window.crossOriginIsolated
  ? Math.max(1, Math.min(4, navigator.hardwareConcurrency || 4))
  : 1;

async function createProcessor(modelUrl, onProgress) {
  let providers = ['wasm'];
  if (navigator.gpu) {
    try {
      if (await navigator.gpu.requestAdapter()) providers = ['webgpu', 'wasm'];
    } catch (error) {
      onProgress({ message: `GPU unavailable; using local CPU processing: ${error.message}` });
      providers = ['wasm'];
    }
  }

  const create = (executionProviders) => new DemucsProcessor({
    ort,
    sessionOptions: { executionProviders, graphOptimizationLevel: 'basic' },
    onProgress,
    onLog: (_phase, message) => onProgress({ message })
  });

  const candidate = create(providers);
  try {
    await candidate.loadModel(modelUrl);
    return candidate;
  } catch (error) {
    if (providers.length === 1) throw error;
    onProgress({ message: `GPU session unavailable; retrying with local CPU: ${error.message}` });
    const cpuProcessor = create(['wasm']);
    await cpuProcessor.loadModel(modelUrl);
    return cpuProcessor;
  }
}

export async function separateTrack(trackUrl, modelUrl, onProgress) {
  if (!processor) processor = await createProcessor(modelUrl, onProgress);

  const response = await fetch(trackUrl);
  if (!response.ok) throw new Error(`تعذر قراءة المسار الصوتي (HTTP ${response.status}).`);

  const decoder = new AudioContext({ sampleRate });
  try {
    const audioBuffer = await decoder.decodeAudioData(await response.arrayBuffer());
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.numberOfChannels > 1
      ? audioBuffer.getChannelData(1)
      : left;
    return await processor.separate(left, right);
  } finally {
    await decoder.close();
  }
}
