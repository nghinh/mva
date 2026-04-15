cmake_minimum_required(VERSION 3.22.1)
project(vibevoice_diarization)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(APP_CPP_DIR ${CMAKE_CURRENT_SOURCE_DIR})
set(PROJECT_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/../../../..)
set(SHERPA_ANDROID_DIR ${PROJECT_ROOT}/node_modules/react-native-sherpa-onnx/android)
set(SHERPA_INCLUDE_DIR ${SHERPA_ANDROID_DIR}/src/main/cpp/include)
set(SHERPA_JNILIBS_DIR ${SHERPA_ANDROID_DIR}/src/main/jniLibs/${ANDROID_ABI})

add_library(vibevoice_diarization SHARED
    OfflineSpeakerDiarizationModule.cpp
)

target_include_directories(vibevoice_diarization PRIVATE
    ${APP_CPP_DIR}
    ${SHERPA_INCLUDE_DIR}
)

target_link_directories(vibevoice_diarization PRIVATE ${SHERPA_JNILIBS_DIR})
target_link_libraries(vibevoice_diarization
    PRIVATE
    sherpa-onnx-c-api
    log
    android
)
