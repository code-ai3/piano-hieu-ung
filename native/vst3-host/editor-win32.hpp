// MELORIX Stage 3B — Win32 host for actual VST3 IPlugView HWND.
// This window belongs to the MELORIX process group and shows vendor UI;
// it is NOT a re-created Vue Kontakt skin and NOT inside the web DOM.
// SPDX-License-Identifier: MIT
#pragma once
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <atomic>
#include <string>
#include <algorithm>
#include "pluginterfaces/gui/iplugview.h"
#include "pluginterfaces/vst/ivsteditcontroller.h"
#include "pluginterfaces/base/smartpointer.h"

namespace MelorixEditor {
using namespace Steinberg;
using namespace Steinberg::Vst;

class EditorWindow;

class HostFrame final : public IPlugFrame {
public:
 explicit HostFrame(EditorWindow* owner):owner_(owner){}
 tresult PLUGIN_API queryInterface(const TUID iid,void** obj) override;
 uint32 PLUGIN_API addRef() override {return ++refs_;}
 uint32 PLUGIN_API release() override {
  auto n=--refs_;
  if(n==0)delete this;
  return n;
 }
 tresult PLUGIN_API resizeView(IPlugView* view,ViewRect* size) override;
 void detach(){owner_=nullptr;}
private:
 ~HostFrame() override=default;
 std::atomic<uint32> refs_{1};
 EditorWindow* owner_{nullptr};
};

class EditorWindow {
public:
 HWND hwnd{nullptr};
 IPtr<IPlugView> view;
 HostFrame* frame{nullptr};
 bool attached{false};
 EditorWindow()=default;
 EditorWindow(const EditorWindow&)=delete;
 EditorWindow& operator=(const EditorWindow&)=delete;
 ~EditorWindow(){close();}
 static LRESULT CALLBACK windowProc(HWND hwnd,UINT message,WPARAM wParam,LPARAM lParam){
  auto* self=reinterpret_cast<EditorWindow*>(GetWindowLongPtrW(hwnd,GWLP_USERDATA));
  if(message==WM_CLOSE){
   if(self)self->close();
   else DestroyWindow(hwnd);
   return 0;
  }
  if(message==WM_NCDESTROY&&self){
   SetWindowLongPtrW(hwnd,GWLP_USERDATA,0);
   if(self->hwnd==hwnd)self->hwnd=nullptr;
   return DefWindowProcW(hwnd,message,wParam,lParam);
  }
  return DefWindowProcW(hwnd,message,wParam,lParam);
 }
 bool open(IEditController* controller,const std::wstring& title,HWND owner){
  if(hwnd){ShowWindow(hwnd,SW_RESTORE);SetForegroundWindow(hwnd);return true;}
  if(!controller)return false;
  view=owned(controller->createView(ViewType::kEditor));
  if(!view)return false;
  if(view->isPlatformTypeSupported(kPlatformTypeHWND)!=kResultTrue){
   view=nullptr;return false;
  }
  ViewRect rect(0,0,760,520);
  if(view->getSize(&rect)!=kResultOk)rect=ViewRect(0,0,760,520);
  const int cw=std::clamp(rect.right-rect.left,200,3200);
  const int ch=std::clamp(rect.bottom-rect.top,140,2400);
  static bool registered=[](){
   WNDCLASSEXW wc{};wc.cbSize=sizeof(wc);
   wc.lpfnWndProc=&EditorWindow::windowProc;
   wc.hInstance=GetModuleHandleW(nullptr);
   wc.lpszClassName=L"MELORIX_VST3_NATIVE_EDITOR";
   wc.hCursor=LoadCursorW(nullptr,IDC_ARROW);
   wc.hbrBackground=reinterpret_cast<HBRUSH>(COLOR_WINDOW+1);
   return RegisterClassExW(&wc)!=0||GetLastError()==ERROR_CLASS_ALREADY_EXISTS;
  }();
  if(!registered){view=nullptr;return false;}
  // Owned top-level HWND stays grouped with MELORIX; it is not a separate
  // Kontakt Standalone process. The plug-in itself paints the entire client area.
  const DWORD style=WS_OVERLAPPED|WS_CAPTION|WS_SYSMENU|WS_MINIMIZEBOX;
  RECT outside{0,0,cw,ch};
  AdjustWindowRectEx(&outside,style,FALSE,0);
  hwnd=CreateWindowExW(0,L"MELORIX_VST3_NATIVE_EDITOR",title.c_str(),
    style,CW_USEDEFAULT,CW_USEDEFAULT,
    outside.right-outside.left,outside.bottom-outside.top,
    owner,nullptr,GetModuleHandleW(nullptr),nullptr);
  if(!hwnd){view=nullptr;return false;}
  SetWindowLongPtrW(hwnd,GWLP_USERDATA,reinterpret_cast<LONG_PTR>(this));
  frame=new HostFrame(this); // caller retains one reference, plugin may retain another
  if(view->setFrame(frame)!=kResultOk){
   close();return false;
  }
  if(view->attached(hwnd,kPlatformTypeHWND)!=kResultOk){
   close();return false;
  }
  attached=true;
  ShowWindow(hwnd,SW_SHOWNORMAL);
  UpdateWindow(hwnd);
  return true;
 }
 void close(){
  // Always detach vendor-created HWND before destroying our parent.
  if(view&&attached){attached=false;view->removed();}
  if(view){view->setFrame(nullptr);view=nullptr;}
  if(frame){frame->detach();frame->release();frame=nullptr;}
  if(hwnd){
   auto h=hwnd;hwnd=nullptr;
   SetWindowLongPtrW(h,GWLP_USERDATA,0);
   DestroyWindow(h);
  }
 }
 bool resize(const ViewRect& requested){
  if(!hwnd||!view)return false;
  ViewRect rect=requested;
  if(view->checkSizeConstraint(&rect)!=kResultTrue)return false;
  const int width=rect.right-rect.left,height=rect.bottom-rect.top;
  if(width<100||height<100||width>5000||height>4000)return false;
  const DWORD style=static_cast<DWORD>(GetWindowLongPtrW(hwnd,GWL_STYLE));
  RECT outer{0,0,width,height};
  AdjustWindowRectEx(&outer,style,FALSE,0);
  SetWindowPos(hwnd,nullptr,0,0,outer.right-outer.left,outer.bottom-outer.top,
    SWP_NOMOVE|SWP_NOZORDER|SWP_NOACTIVATE);
  return view->onSize(&rect)==kResultOk;
 }
};

inline tresult PLUGIN_API HostFrame::queryInterface(const TUID iid,void** obj){
 if(!obj)return kInvalidArgument;
 *obj=nullptr;
 if(FUnknownPrivate::iidEqual(iid,IPlugFrame::iid)||
    FUnknownPrivate::iidEqual(iid,FUnknown::iid)){
  *obj=static_cast<IPlugFrame*>(this);
  addRef();
  return kResultOk;
 }
 return kNoInterface;
}
inline tresult PLUGIN_API HostFrame::resizeView(IPlugView* view,ViewRect* size){
 if(!owner_||!size||!view||owner_->view.get()!=view)return kInvalidArgument;
 return owner_->resize(*size)?kResultOk:kResultFalse;
}
} // namespace MelorixEditor
