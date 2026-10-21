# MELORIX 4B — Sustain Pedal CC64 to Kontakt VST3

Date: 2026-10-22. QA branch only. Production/main remains unchanged.

Baseline: technical project log read first; user confirmed Kontakt 8 audible PCM peak 0.4845 in earlier Windows GĐ3D. Branch inherits 4A Auto Pedal three modes Light/Natural/Deep.

Implementation: native VST3 controller IMidiMapping maps kCtrlSustainOnOff (CC64) to ParamID. Live WASAPI processor receives normalized CC64 as ProcessData.inputParameterChanges, never as LegacyMIDICCOutEvent. Electron trusted IPC routes LIVE_CC for active track only, value 0..127.

Vst3PedalScheduler dispatches CC64 events at the playhead, releases pedal at Pause/Stop/Repeat/track changes or new MIDI. When controller lacks mapping, native host returns explicit error; NoteOn/Off audio remains intact.

Limitations: native edit controller currently established by opening native editor to choose NKI. No guaranteed half-pedal or sample-accurate timing; no native multitrack mix. A successful CI compile is not proof licensed Kontakt receives or sounds CC64. Explicit human listening QA needed.

QA: choose valid Kontakt 8 Piano NKI, enable WASAPI, in Piano Roll choose one of three pedal modes, view/apply CC64, play and compare sustain/no-sustain. Test Stop/Seek/Repeat, confirm no sustained stuck notes. Do not merge Production until owner approval.

No CMD, plugin/NKI copying or automatic edits to user's local drives.