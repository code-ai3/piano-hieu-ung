# MELORIX GĐ3C1 — Native VST3 one-track MIDI playback (experimental)
2026-10-21. Base b444f19; separate feature branch, main/Production untouched.

Once the Windows user binds VST3 and turns on WASAPI on that track, pressing Play forwards every MIDI NoteOn/NoteOff for that track to the persistent native VST3. Pause/Stop/Seek/Repeat resets active notes; browser synth is suppressed only on the active VST3 track. This is genuine VST3 DSP, not standalone Kontakt/loopMIDI.

Not sample-accurate: Vue playhead + Electron IPC can jitter, hidden tab may miss notes. ONLY one native track; other tracks remain browser audio, no native volume/mute/solo mixing, NKI state, ASIO, Kontakt 8 licensed QA or WAV/MP4 export of VST3 yet. No Kontakt binaries/NKI were copied. Windows CI success is NOT verification of actual Kontakt sound on the user's PC.
