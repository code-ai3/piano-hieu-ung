cmake_minimum_required(VERSION 3.25)
project(MelorixVst3Probe VERSION 0.1.0 LANGUAGES CXX)
if(NOT WIN32 OR NOT CMAKE_SIZEOF_VOID_P EQUAL 8)
 message(FATAL_ERROR "MELORIX VST3 host probe currently supports Windows x64 only")
endif()
if(NOT DEFINED VST3_SDK_ROOT OR NOT EXISTS "${VST3_SDK_ROOT}/CMakeLists.txt")
 message(FATAL_ERROR "Set -DVST3_SDK_ROOT to the pinned, recursive Steinberg VST3 SDK")
endif()

set(SMTG_ENABLE_VSTGUI_SUPPORT OFF CACHE BOOL "" FORCE)
set(SMTG_ENABLE_VST3_HOSTING_EXAMPLES OFF CACHE BOOL "" FORCE)
set(SMTG_ENABLE_VST3_PLUGIN_EXAMPLES OFF CACHE BOOL "" FORCE)
set(SMTG_CREATE_PLUGIN_LINK OFF CACHE BOOL "" FORCE)
set(SMTG_RUN_VST_VALIDATOR OFF CACHE BOOL "" FORCE)
set(SMTG_CREATE_MODULE_INFO OFF CACHE BOOL "" FORCE)
# Single-file Windows .vst3 DLLs avoid bundle paths that differ between Ninja
# and Visual Studio generators. Host loading still uses official Module::create.
set(SMTG_CREATE_BUNDLE_FOR_WINDOWS OFF CACHE BOOL "" FORCE)

# Uses the SDK's official hosting module (Module::create), not an invented
# factory ABI. MIT license; do not bundle Kontakt/NKI or load paid plugins in CI.
add_subdirectory("${VST3_SDK_ROOT}" "${CMAKE_CURRENT_BINARY_DIR}/steinberg")
# SDK CMake project variables are scoped in a subdirectory; make them
# available to the isolated test-only plugin targets.
set(SDK_ROOT "${VST3_SDK_ROOT}")
set(vstsdk_VERSION 3.8.1)
add_executable(melorix-vst3-probe
 probe.cpp
 "${VST3_SDK_ROOT}/public.sdk/source/vst/hosting/module_win32.cpp"
)
target_compile_features(melorix-vst3-probe PRIVATE cxx_std_17)
target_compile_definitions(melorix-vst3-probe PRIVATE UNICODE _UNICODE WIN32_LEAN_AND_MEAN NOMINMAX)
target_link_libraries(melorix-vst3-probe PRIVATE sdk_hosting ole32)
# Stage 2B offline renderer: event-driven PCM is written strictly from
# Steinberg IAudioProcessor::process() of the selected native VST3 plugin.
add_executable(melorix-vst3-render
 offline-render.cpp
 "${VST3_SDK_ROOT}/public.sdk/source/vst/hosting/module_win32.cpp"
)
target_compile_features(melorix-vst3-render PRIVATE cxx_std_17)
target_compile_definitions(melorix-vst3-render PRIVATE UNICODE _UNICODE WIN32_LEAN_AND_MEAN NOMINMAX)
target_link_libraries(melorix-vst3-render PRIVATE sdk_hosting ole32)
set_target_properties(melorix-vst3-render PROPERTIES
 RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")

# Stage 3A: persistent, process-isolated VST3 component instances per MIDI track.
# Audio and native editor support are explicitly out of scope for this milestone.
add_executable(melorix-vst3-session
 session.cpp
 "${VST3_SDK_ROOT}/public.sdk/source/vst/hosting/module_win32.cpp"
)
target_compile_features(melorix-vst3-session PRIVATE cxx_std_17)
target_compile_definitions(melorix-vst3-session PRIVATE UNICODE _UNICODE WIN32_LEAN_AND_MEAN NOMINMAX)
target_link_libraries(melorix-vst3-session PRIVATE sdk_hosting ole32 uuid)
set_target_properties(melorix-vst3-session PROPERTIES
 RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")

# Optional real Steinberg ADelay example plugin. It is a genuine VST3 DLL,
# unlike the fake directory fixture used in GĐ1, and belongs only to CI.
option(MELORIX_BUILD_VST3_TEST_PLUGIN "Build Steinberg ADelay for loader QA" OFF)
option(MELORIX_BUILD_VST3_TEST_SYNTH "Build true MIDI-to-PCM VST3 QA instrument" OFF)
if(MELORIX_BUILD_VST3_TEST_SYNTH)
 smtg_add_vst3plugin(melorix-test-synth test-synth.cpp)
 target_link_libraries(melorix-test-synth PRIVATE sdk)
 target_compile_features(melorix-test-synth PRIVATE cxx_std_17)
 smtg_add_vst3plugin(melorix-test-multibus test-synth.cpp)
 target_link_libraries(melorix-test-multibus PRIVATE sdk)
 target_compile_features(melorix-test-multibus PRIVATE cxx_std_17)
 target_compile_definitions(melorix-test-multibus PRIVATE MELORIX_TEST_MULTIBUS=1)
endif()

if(MELORIX_BUILD_VST3_TEST_PLUGIN)
 # CMake project() variables of the SDK remain scoped to its subdirectory.
 # The official ADelay sample expects the parent ${vstsdk_VERSION}.
 set(vstsdk_VERSION 3.8.1)
 set(SDK_ROOT "${VST3_SDK_ROOT}")
 set(public_sdk_SOURCE_DIR "${VST3_SDK_ROOT}/public.sdk")
 set(pluginterfaces_SOURCE_DIR "${VST3_SDK_ROOT}/pluginterfaces")
 # In the full SDK, this helper is defined in samples/vst/CMakeLists.txt.
 # We build only the isolated ADelay target, not the full demo catalogue.
 function(smtg_target_setup_as_vst3_example target)
  smtg_target_configure_version_file(${target})
  target_compile_features(${target} PUBLIC cxx_std_17)
  target_link_libraries(${target} PRIVATE sdk)
 endfunction()
 add_subdirectory("${VST3_SDK_ROOT}/public.sdk/samples/vst/adelay"
                  "${CMAKE_CURRENT_BINARY_DIR}/vst3-sample-adelay")
endif()
if(MSVC)
 target_compile_options(melorix-vst3-probe PRIVATE /W4 /EHsc /utf-8)
endif()
set_target_properties(melorix-vst3-probe PROPERTIES
 RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")
