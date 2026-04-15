#include <jni.h>
#include <android/log.h>
#include <mutex>
#include <string>
#include <vector>

#include "sherpa-onnx/c-api/c-api.h"

namespace {
std::mutex g_mutex;
const SherpaOnnxOfflineSpeakerDiarization *g_diarizer = nullptr;
int32_t g_last_num_speakers = 0;
SherpaOnnxOfflineSpeakerDiarizationConfig g_last_config;

void LogError(const char *msg) {
  __android_log_print(ANDROID_LOG_ERROR, "VibeVoiceDiarization", "%s", msg);
}
}

extern "C" JNIEXPORT jint JNICALL
Java_com_vibevoicenative_speaker_OfflineSpeakerDiarizationModule_initializeNative(
    JNIEnv *env,
    jobject /*thiz*/,
    jstring segmentationModelPath,
    jstring embeddingModelPath,
    jint segmentationThreads,
    jint embeddingThreads,
    jfloat threshold) {
  std::lock_guard<std::mutex> lock(g_mutex);

  if (g_diarizer) {
    SherpaOnnxDestroyOfflineSpeakerDiarization(g_diarizer);
    g_diarizer = nullptr;
  }

  const char *seg_path = env->GetStringUTFChars(segmentationModelPath, nullptr);
  const char *emb_path = env->GetStringUTFChars(embeddingModelPath, nullptr);

  SherpaOnnxOfflineSpeakerDiarizationConfig config;
  memset(&config, 0, sizeof(config));
  config.segmentation.pyannote.model = seg_path;
  config.segmentation.num_threads = segmentationThreads;
  config.segmentation.debug = 0;
  config.segmentation.provider = "cpu";

  config.embedding.model = emb_path;
  config.embedding.num_threads = embeddingThreads;
  config.embedding.debug = 0;
  config.embedding.provider = "cpu";

  config.clustering.num_clusters = 0;
  config.clustering.threshold = threshold;
  config.min_duration_on = 0.20f;
  config.min_duration_off = 0.15f;

  g_diarizer = SherpaOnnxCreateOfflineSpeakerDiarization(&config);

  env->ReleaseStringUTFChars(segmentationModelPath, seg_path);
  env->ReleaseStringUTFChars(embeddingModelPath, emb_path);

  if (!g_diarizer) {
    LogError("Failed to create offline speaker diarizer");
    return -1;
  }

  g_last_config = config;

  return SherpaOnnxOfflineSpeakerDiarizationGetSampleRate(g_diarizer);
}

extern "C" JNIEXPORT jfloatArray JNICALL
Java_com_vibevoicenative_speaker_OfflineSpeakerDiarizationModule_processNative(
    JNIEnv *env,
    jobject /*thiz*/,
    jfloatArray samples) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (!g_diarizer) {
    return nullptr;
  }

  const jsize sample_count = env->GetArrayLength(samples);
  std::vector<float> pcm(sample_count);
  env->GetFloatArrayRegion(samples, 0, sample_count, pcm.data());

  const auto *result = SherpaOnnxOfflineSpeakerDiarizationProcess(g_diarizer, pcm.data(), sample_count);
  if (!result) {
    LogError("Offline speaker diarization process failed");
    return nullptr;
  }

  g_last_num_speakers = SherpaOnnxOfflineSpeakerDiarizationResultGetNumSpeakers(result);
  const int32_t num_segments = SherpaOnnxOfflineSpeakerDiarizationResultGetNumSegments(result);
  const auto *segments = SherpaOnnxOfflineSpeakerDiarizationResultSortByStartTime(result);

  jfloatArray out = env->NewFloatArray(num_segments * 3);
  std::vector<float> flat(num_segments * 3);
  for (int32_t i = 0; i < num_segments; ++i) {
    flat[i * 3 + 0] = segments[i].start;
    flat[i * 3 + 1] = segments[i].end;
    flat[i * 3 + 2] = static_cast<float>(segments[i].speaker);
  }
  env->SetFloatArrayRegion(out, 0, num_segments * 3, flat.data());

  SherpaOnnxOfflineSpeakerDiarizationDestroySegment(segments);
  SherpaOnnxOfflineSpeakerDiarizationDestroyResult(result);
  return out;
}

extern "C" JNIEXPORT jint JNICALL
Java_com_vibevoicenative_speaker_OfflineSpeakerDiarizationModule_getLastNumSpeakersNative(
    JNIEnv * /*env*/,
    jobject /*thiz*/) {
  std::lock_guard<std::mutex> lock(g_mutex);
  return g_last_num_speakers;
}

extern "C" JNIEXPORT jboolean JNICALL
Java_com_vibevoicenative_speaker_OfflineSpeakerDiarizationModule_updateThresholdNative(
    JNIEnv * /*env*/,
    jobject /*thiz*/,
    jfloat threshold) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (!g_diarizer) return JNI_FALSE;

  g_last_config.clustering.num_clusters = 0;
  g_last_config.clustering.threshold = threshold;
  SherpaOnnxOfflineSpeakerDiarizationSetConfig(g_diarizer, &g_last_config);
  return JNI_TRUE;
}

extern "C" JNIEXPORT void JNICALL
Java_com_vibevoicenative_speaker_OfflineSpeakerDiarizationModule_unloadNative(
    JNIEnv * /*env*/,
    jobject /*thiz*/) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (g_diarizer) {
    SherpaOnnxDestroyOfflineSpeakerDiarization(g_diarizer);
    g_diarizer = nullptr;
  }
  g_last_num_speakers = 0;
  memset(&g_last_config, 0, sizeof(g_last_config));
}
