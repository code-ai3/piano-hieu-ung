cmake_minimum_required(VERSION 3.25)
project(MelorixVst3Probe LANGUAGES CXX)
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

# Uses the SDK's official hosting module (Module::create), not an invented
# factory ABI. MIT license; do not bundle Kontakt/NKI or load paid plugins in CI.
add_subdirectory("${VST3_SDK_ROOT}" "${CMAKE_CURRENT_BINARY_DIR}/steinberg")
add_executable(melorix-vst3-probe
 probe.cpp
 "${VST3_SDK_ROOT}/public.sdk/source/vst/hosting/module_win32.cpp"
)
target_compile_features(melorix-vst3-probe PRIVATE cxx_std_17)
target_compile_definitions(melorix-vst3-probe PRIVATE UNICODE _UNICODE WIN32_LEAN_AND_MEAN NOMINMAX)
target_link_libraries(melorix-vst3-probe PRIVATE sdk_hosting ole32)
if(MSVC)
 target_compile_options(melorix-vst3-probe PRIVATE /W4 /EHsc /utf-8)
endif()
set_target_properties(melorix-vst3-probe PROPERTIES
 RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")
