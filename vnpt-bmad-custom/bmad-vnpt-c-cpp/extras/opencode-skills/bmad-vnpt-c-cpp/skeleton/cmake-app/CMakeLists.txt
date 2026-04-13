cmake_minimum_required(VERSION 3.25)
project(vnpt_native_app VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_C_STANDARD 17)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS OFF)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(VNPT_ENABLE_WARNINGS "Enable strict warnings" ON)
option(VNPT_ENABLE_SANITIZERS "Enable ASan/UBSan for debug-like builds" OFF)
option(BUILD_TESTING "Build tests" ON)

add_library(vnpt_native_lib
    src/example.cpp
)

target_include_directories(vnpt_native_lib PUBLIC include)
target_compile_features(vnpt_native_lib PUBLIC cxx_std_20)

if(VNPT_ENABLE_WARNINGS)
    if(MSVC)
        target_compile_options(vnpt_native_lib PRIVATE /W4 /permissive-)
    else()
        target_compile_options(vnpt_native_lib PRIVATE -Wall -Wextra -Wpedantic -Wconversion -Wsign-conversion)
    endif()
endif()

if(VNPT_ENABLE_SANITIZERS AND NOT MSVC)
    target_compile_options(vnpt_native_lib PRIVATE -fsanitize=address,undefined -fno-omit-frame-pointer)
    target_link_options(vnpt_native_lib PRIVATE -fsanitize=address,undefined)
endif()

add_executable(vnpt_native_app src/main.cpp)
target_link_libraries(vnpt_native_app PRIVATE vnpt_native_lib)

include(CTest)
if(BUILD_TESTING)
    find_package(GTest CONFIG QUIET)
    if(GTest_FOUND)
        add_executable(vnpt_native_tests tests/example_test.cpp)
        target_link_libraries(vnpt_native_tests PRIVATE vnpt_native_lib GTest::gtest_main)
        include(GoogleTest)
        gtest_discover_tests(vnpt_native_tests)
    endif()
endif()
