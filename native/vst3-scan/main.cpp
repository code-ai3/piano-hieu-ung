// MELORIX VST3 discovery (phase 1): enumerate installed native bundles without executing DLLs.
// This is a scanner, NOT the VST3 audio engine. Real plugin loading is a separate milestone.
// Windows x64, C++17, MSVC. MIT license, no third-party dependencies.
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <filesystem>
#include <iostream>
#include <set>
#include <string>
#include <vector>
#include <algorithm>

namespace fs = std::filesystem;
struct Candidate {
  fs::path path;
  std::wstring name;
  bool hasBinary = false;
};
std::string utf8(const std::wstring& source) {
  if(source.empty()) return {};
  int size = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, source.data(),
    static_cast<int>(source.size()), nullptr, 0, nullptr, nullptr);
  if(size <= 0) return {};
  std::string output(static_cast<size_t>(size), '\0');
  WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, source.data(),
    static_cast<int>(source.size()), output.data(), size, nullptr, nullptr);
  return output;
}
std::string json(const std::string& value) {
  static const char* hex = "0123456789abcdef";
  std::string out;
  out.reserve(value.size()+4);
  out += '"';
  for(unsigned char c:value) {
    switch(c) {
      case '"': out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default:
        if(c<32){out+="\\u00";out+=hex[c>>4];out+=hex[c&15];}
        else out+=static_cast<char>(c);
    }
  }
  out += '"';
  return out;
}
std::wstring env(const wchar_t* key) {
  DWORD length = GetEnvironmentVariableW(key,nullptr,0);
  if(!length || length>32768) return L"";
  std::wstring value(static_cast<size_t>(length),L'\0');
  const DWORD received = GetEnvironmentVariableW(key,value.data(),length);
  if(!received || received>=length) return L"";
  value.resize(received);
  return value;
}
void scan(const fs::path& folder, int depth, std::vector<Candidate>& found, std::set<std::wstring>& seen){
  if(depth>5||found.size()>=512) return;
  std::error_code ec;
  if(!fs::is_directory(folder,ec)||ec) return;
  for(const auto& item:fs::directory_iterator(folder,fs::directory_options::skip_permission_denied,ec)) {
    if(ec||found.size()>=512) break;
    auto path=item.path();
    std::wstring extension=path.extension().wstring();
    std::transform(extension.begin(),extension.end(),extension.begin(),::towlower);
    const bool directory=item.is_directory(ec);
    const bool regular=item.is_regular_file(ec);
    if(ec) {ec.clear();continue;}
    if(extension==L".vst3"&&(directory||regular)) {
      // A bundle may be a folder or a direct .vst3 DLL. Do not LoadLibrary here.
      bool hasBinary=regular;
      if(directory) {
        auto binaries=path/L"Contents"/L"x86_64-win";
        if(fs::is_directory(binaries,ec)) {
          for(const auto& file:fs::directory_iterator(binaries,fs::directory_options::skip_permission_denied,ec)) {
            if(file.is_regular_file(ec)&&file.path().extension()==L".vst3"){hasBinary=true;break;}
            ec.clear();
          }
        }
      }
      const auto key=path.wstring();
      if(seen.insert(key).second){
        found.push_back({path,path.stem().wstring(),hasBinary});
      }
      continue;
    }
    // Don't descend into junctions/symlinks to avoid loops or network paths.
    if(directory&&!item.is_symlink(ec))scan(path,depth+1,found,seen);
    ec.clear();
  }
}
int wmain(int argc,wchar_t** argv) {
  std::vector<fs::path> roots;
  // --root is exclusively a local diagnostic for CI; electron passes no arguments.
  if(argc==3&&std::wstring(argv[1])==L"--root")roots.emplace_back(argv[2]);
  else if(argc==1) {
    auto common=env(L"CommonProgramFiles");
    auto local=env(L"LOCALAPPDATA");
    if(!common.empty())roots.emplace_back(fs::path(common)/L"VST3");
    if(!local.empty())roots.emplace_back(fs::path(local)/L"Programs"/L"Common"/L"VST3");
  } else {
    std::cerr << "Usage: melorix-vst3-scan.exe [--root <local-dir>]\n";
    return 2;
  }
  std::set<std::wstring> seen;
  std::vector<Candidate> found;
  for(const auto& root:roots)scan(root,0,found,seen);
  std::sort(found.begin(),found.end(),[](const Candidate&a,const Candidate&b){return a.name<b.name;});
  std::cout << "{\"schema\":1,\"engine\":\"discovery-only\",\"plugins\":[";
  for(size_t i=0;i<found.size();++i){
    if(i)std::cout<<',';
    const auto& x=found[i];
    std::cout << "{\"name\":"<<json(utf8(x.name))
      <<",\"path\":"<<json(utf8(x.path.wstring()))
      <<",\"hasBinary\":"<<(x.hasBinary?"true":"false")<<'}';
  }
  std::cout << "]}\n";
  return 0;
}
