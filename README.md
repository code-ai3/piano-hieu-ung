# 特效钢琴 · Piano FX

> MIDI 驱动的音符掉落可视化钢琴，带「燃烧烟雾 / 扩散光环」粒子特效、音频转 MIDI、MP4 视频导出。纯前端实现，无需后端。

![tech](https://img.shields.io/badge/Vue-3-42b883) ![tech](https://img.shields.io/badge/Vite-5-646cff) ![tech](https://img.shields.io/badge/TypeScript-5-3178c6) ![license](https://img.shields.io/badge/license-MIT-blue)

## ✨ 功能

- **音符掉落可视化** —— 解析 MIDI，按音高着色，琴键同步点亮。
- **两种接触特效**
  - `燃烧烟雾`：音符接触琴键时点燃，沿本体自下而上燃尽，伴随白热前沿、解体碎片、烟雾、火星拖尾。
  - `扩散光环`：接触瞬间多彩扩散光环 + 持续激活色矩形。
- **音频转 MIDI** —— 上传任意音频（mp3/m4a/wav/ogg/flac），用 [Spotify Basic Pitch](https://github.com/spotify/basic-pitch) 实时转录为 MIDI 并播放。
- **MP4 导出** —— 离屏逐帧渲染 + 真实音频合成，导出 1080p 30fps 16:9 视频（支持流式写盘，省内存）。
- **可定制** —— 音符/钢琴键激活色、发光、不透明度、分割线、背景图/视频。
- **全屏播放** —— 沉浸式瀑布流，可隐藏操作区。
- **中英双语 + 深色模式**。

## 🚀 快速开始

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 生产构建
npm run preview  # 预览构建产物
```

> 需要 Node.js 18+。推荐 Chrome / Edge 浏览器（导出视频用到 WebCodecs 与 `showSaveFilePicker`）。

## 🎼 内置曲库

`public/midi/` 下附带三首示例 MIDI：Canon、Kiss The Rain、Rivers Flow In You。可自行替换或上传自己的 MIDI/音频文件。

## 📦 资源说明

本仓库为开箱即用，已内置运行所需资源（约 49MB）：

| 路径 | 说明 | 来源 |
| --- | --- | --- |
| `public/samples/sfzinstruments-splendid-grand-piano/` | 钢琴音色采样（smplr） | [smplr](https://github.com/djipco/smplr) / sfzinstruments |
| `public/models/basic-pitch/` | 音频转 MIDI 模型 | [Spotify Basic Pitch](https://github.com/spotify/basic-pitch) |
| `public/wallpaper/` | 背景图 / 视频 | — |
| `public/midi/` | 示例 MIDI | — |

> 钢琴采样文件名含 `#`，Vite 默认静态服务会失败，故 `vite.config.ts` 内置了一个 `/samples/` 中间件，dev 与 preview 均生效。

## 🙏 致谢

本项目站在巨人的肩膀上：

- [smplr](https://github.com/djipco/smplr) —— Web Audio 钢琴采样合成
- [@tonejs/midi](https://github.com/Tonejs/Midi) —— MIDI 解析
- [Spotify Basic Pitch](https://github.com/spotify/basic-pitch) —— 音频转 MIDI
- [mediabunny](https://github.com/codler/mediabunny) —— WebCodecs MP4 封装
- [TensorFlow.js](https://www.tensorflow.org/js) —— Basic Pitch 推理后端

## 📄 License

[MIT](./LICENSE)

钢琴采样与 Basic Pitch 模型各自遵循其原始许可。
